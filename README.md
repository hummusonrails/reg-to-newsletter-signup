# Newsletter Signup Service

Express service for Cloud Run that accepts newsletter signups and syncs them to Ghost with the `Builder` label.

## Environment

- `SHARED_SECRET` – bearer token required on incoming requests.
- `GHOST_ADMIN_KEY` – Ghost Admin API key (`{id}:{secret}` format).
- `GHOST_URL` – base Ghost URL (e.g., `https://your-ghost-site.com`).

## Endpoints

- `POST /` – Create or update a member in Ghost. Requires `Authorization: Bearer $SHARED_SECRET`. Body: `{"email":"user@example.com","name":"Optional Name"}`.
- `GET /health` – Health check endpoint.

## Run locally

```bash
npm ci
SHARED_SECRET=... GHOST_ADMIN_KEY=... GHOST_URL=... npm start
```

## Container

- Node 20 slim base
- `PORT=8080`, `CMD ["node", "server.js"]`
- Build: `docker build -t newsletter-signup:dev .`
- Run: `docker run -e SHARED_SECRET=... -e GHOST_ADMIN_KEY=... -e GHOST_URL=... -p 8080:8080 newsletter-signup:dev`

Images are published by CI to `${REGION}-docker.pkg.dev/${PROJECT_ID_DEV}/applications/newsletter-signup` with `latest` and commit SHA tags.

## License
[MIT](LICENSE)
