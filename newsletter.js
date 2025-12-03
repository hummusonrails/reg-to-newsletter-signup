function getHeader(headers, key) {
  if (!headers || !key) return null;

  if (typeof headers.get === 'function') {
    return headers.get(key);
  }

  const lowerKey = key.toLowerCase();
  const headerEntry = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === lowerKey
  );

  return headerEntry ? headerEntry[1] : null;
}

export async function handleNewsletter(requestLike, env) {
  const { method, headers, body } = requestLike || {};

  if (method !== 'POST') {
    return { status: 405, body: 'Method Not Allowed' };
  }

  if (!env?.SHARED_SECRET || !env?.GHOST_ADMIN_KEY || !env?.GHOST_URL) {
    return { status: 500, body: 'Server not configured' };
  }

  const authHeaderValue = getHeader(headers, 'authorization') || '';
  const authHeader = Array.isArray(authHeaderValue) ? authHeaderValue[0] : authHeaderValue;
  const expected = `Bearer ${env.SHARED_SECRET}`;

  if (authHeader !== expected) {
    return { status: 401, body: 'Unauthorized' };
  }

  if (!body || typeof body !== 'object') {
    return { status: 400, body: 'Invalid JSON' };
  }

  const email = body.email;
  const name = body.name || null;

  if (!email) {
    return { status: 400, body: 'Missing email' };
  }

  try {
    const jwt = await createGhostAdminToken(env.GHOST_ADMIN_KEY);

    const ghostUrl = env.GHOST_URL.replace(/\/$/, '');
    const memberPayload = {
      email,
      labels: [{ name: 'Builder' }]
    };

    if (name) {
      memberPayload.name = name;
    }

    const ghostRes = await fetch(`${ghostUrl}/ghost/api/admin/members/`, {
      method: 'POST',
      headers: {
        'Authorization': `Ghost ${jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        members: [memberPayload]
      })
    });

    if (!ghostRes.ok && ghostRes.status !== 409 && ghostRes.status !== 422) {
      const text = await ghostRes.text();
      return { status: 500, body: `Ghost error ${ghostRes.status}: ${text}` };
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    return {
      status: 500,
      body: `Internal error: ${err.message || String(err)}`
    };
  }
}

async function createGhostAdminToken(adminKey) {
  const [id, secretHex] = adminKey.split(':');

  if (!id || !secretHex) {
    throw new Error('Invalid GHOST_ADMIN_KEY format');
  }

  const secretBytes = hexToArrayBuffer(secretHex);

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const header = {
    alg: 'HS256',
    typ: 'JWT',
    kid: id
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + 5 * 60,
    aud: '/admin/'
  };

  const encoder = new TextEncoder();
  const encodedHeader = encoder.encode(JSON.stringify(header));
  const encodedPayload = encoder.encode(JSON.stringify(payload));

  const headerBase = base64urlFromBytes(encodedHeader);
  const payloadBase = base64urlFromBytes(encodedPayload);
  const data = `${headerBase}.${payloadBase}`;

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );

  const sigBase = base64urlFromBytes(new Uint8Array(signature));

  return `${data}.${sigBase}`;
}

function hexToArrayBuffer(hex) {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

function base64urlFromBytes(bytes) {
  const normalized = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;

  let base64;
  if (typeof Buffer !== 'undefined') {
    base64 = Buffer.from(normalized).toString('base64');
  } else {
    let binary = '';
    for (let i = 0; i < normalized.length; i++) {
      binary += String.fromCharCode(normalized[i]);
    }
    base64 = btoa(binary);
  }

  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
