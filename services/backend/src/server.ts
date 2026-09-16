import { createApp } from './app.js';
import { env } from './config/env.js';
import { ensureDatabaseSchema } from './db/ensure-schema.js';

const app = createApp();

await ensureDatabaseSchema();

app.listen(env.port, () => {
  console.log(`Backend running on http://localhost:${env.port}`);
});
