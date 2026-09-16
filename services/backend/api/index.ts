// Ponto de entrada serverless para a Vercel.
// Reaproveita o mesmo app Express (compilado em dist/) usado localmente, e garante
// que o schema do banco seja aplicado uma vez por "cold start".
import { createApp } from '../dist/app.js';
import { ensureDatabaseSchema } from '../dist/db/ensure-schema.js';

const app = createApp();
let schemaReady: Promise<void> | null = null;

export default async function handler(req: unknown, res: any) {
  try {
    if (!schemaReady) {
      schemaReady = ensureDatabaseSchema().catch((error) => {
        // Permite nova tentativa na próxima requisição se a inicialização falhar.
        schemaReady = null;
        throw error;
      });
    }
    await schemaReady;
  } catch (error) {
    console.error('Falha ao inicializar o banco:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'Database initialization error' }));
    return;
  }

  return (app as unknown as (req: unknown, res: unknown) => void)(req, res);
}
