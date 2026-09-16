import { Pool, types, type PoolClient } from 'pg';
import { env } from '../config/env.js';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from './types.js';

// Keep JSON as text so existing route normalizers can parse it consistently.
types.setTypeParser(114, (value) => value);
types.setTypeParser(3802, (value) => value);

function toPostgresPlaceholders(sql: string) {
  let index = 0;
  let quoted = false;
  let result = '';

  for (let position = 0; position < sql.length; position += 1) {
    const character = sql[position];
    if (character === "'") {
      if (quoted && sql[position + 1] === "'") {
        result += "''";
        position += 1;
        continue;
      }
      quoted = !quoted;
    }
    result += character === '?' && !quoted ? `$${++index}` : character;
  }

  return result;
}

function createConnection(client: PoolClient): PoolConnection {
  return {
    async query<T = RowDataPacket[]>(sql: string, values: unknown[] = []) {
      const result = await client.query(toPostgresPlaceholders(sql), values);
      return [result.rows as T];
    },
    async execute<T = ResultSetHeader>(sql: string, values: unknown[] = []) {
      const result = await client.query(toPostgresPlaceholders(sql), values);
      return [{ affectedRows: result.rowCount ?? 0 } as T];
    },
    beginTransaction: () => client.query('BEGIN').then(() => undefined),
    commit: () => client.query('COMMIT').then(() => undefined),
    rollback: () => client.query('ROLLBACK').then(() => undefined),
    release: () => client.release(),
  };
}

const sslConfig = env.database.ssl ? { rejectUnauthorized: false } : undefined;

// In production a single DATABASE_URL (Render/Neon/Supabase) is used; locally we
// fall back to the individual POSTGRES_* fields.
const pgPool = env.database.url
  ? new Pool({ connectionString: env.database.url, ssl: sslConfig, max: 10 })
  : new Pool({
      host: env.postgres.host,
      port: env.postgres.port,
      user: env.postgres.user,
      password: env.postgres.password,
      database: env.postgres.database,
      ssl: sslConfig,
      max: 10,
    });

export const pool = {
  async query<T = RowDataPacket[]>(sql: string, values: unknown[] = []) {
    const result = await pgPool.query(toPostgresPlaceholders(sql), values);
    return [result.rows as T] as [T];
  },
  async execute<T = ResultSetHeader>(sql: string, values: unknown[] = []) {
    const result = await pgPool.query(toPostgresPlaceholders(sql), values);
    return [{ affectedRows: result.rowCount ?? 0 } as T] as [T];
  },
  async getConnection() {
    return createConnection(await pgPool.connect());
  },
  async end() {
    await pgPool.end();
  },
};
