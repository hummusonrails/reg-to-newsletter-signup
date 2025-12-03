import express from 'express';
import { handleNewsletter } from './newsletter.js';

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

app.post('/', async (req, res) => {
  const result = await handleNewsletter(
    {
      method: req.method,
      headers: req.headers,
      body: req.body
    },
    {
      SHARED_SECRET: process.env.SHARED_SECRET,
      GHOST_ADMIN_KEY: process.env.GHOST_ADMIN_KEY,
      GHOST_URL: process.env.GHOST_URL
    }
  );

  if (result.headers) {
    Object.entries(result.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  }

  res.status(result.status).send(result.body);
});

app.get('/health', (_req, res) => {
  res.status(200).send('ok');
});

app.all('*', (_req, res) => {
  res.status(405).send('Method Not Allowed');
});

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError) {
    return res.status(400).send('Invalid JSON');
  }

  res.status(500).send('Internal Server Error');
});

app.listen(port, () => {
  console.log(`Newsletter signup listening on port ${port}`);
});
