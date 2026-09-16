import { pool } from './pool.js';
import { SCHEMA_SQL } from './schema.js';

/** Applies the idempotent PostgreSQL schema on startup (works locally and on serverless). */
export async function ensureDatabaseSchema() {
  await pool.query(SCHEMA_SQL);
}
