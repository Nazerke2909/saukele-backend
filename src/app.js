import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import './config/env.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = parseInt(process.env.PORT, 10) || 3000;

app.listen(PORT, () => {
  console.log(`[INFO] Server listening on port ${PORT}`);
});

export default app;
