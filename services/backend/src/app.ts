import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { notFound } from './middlewares/notFound.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  // Permite o frontend em qualquer porta local (o Vite pode subir em 5173, 5174, ...)
  // e os domínios públicos configurados em CORS_ORIGINS (ex.: o site publicado).
  const isLocalOrigin = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const allowedOrigins = new Set(env.corsOrigins.map((origin) => origin.replace(/\/$/, '')));
  app.use(
    cors({
      origin: (origin, callback) => {
        const normalized = origin?.replace(/\/$/, '');
        if (!normalized || allowedOrigins.has(normalized) || isLocalOrigin(normalized)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
    })
  );
  app.use(express.json({ limit: '10mb' }));

  app.get('/', (_req, res) => {
    res.json({
      name: 'PetHelp API',
      version: '0.0.1',
    });
  });

  app.use('/api', apiRouter);
  app.use(notFound);

  return app;
}