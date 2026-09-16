import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Client } from 'pg';
import { env } from '../config/env.js';
import { SCHEMA_SQL } from './schema.js';

const databaseName = env.postgres.database;
const forceReset = process.argv.includes('--yes') || process.argv.includes('-y');

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function confirmReset() {
  if (forceReset) return;
  if (!input.isTTY || !output.isTTY) {
    throw new Error(`Refusing to reset ${databaseName} without an interactive terminal. Re-run with --yes.`);
  }

  const readline = createInterface({ input, output });
  try {
    const answer = await readline.question(`This will DROP and recreate database "${databaseName}". Type ${databaseName} to continue: `);
    if (answer.trim() !== databaseName) throw new Error('Database reset cancelled.');
  } finally {
    readline.close();
  }
}

async function main() {
  await confirmReset();
  const config = {
    host: env.postgres.host, port: env.postgres.port, user: env.postgres.user,
    password: env.postgres.password,
  };
  const admin = new Client({ ...config, database: env.postgres.adminDatabase });
  await admin.connect();

  try {
    const quotedDatabase = quoteIdentifier(databaseName);
    await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [databaseName]);
    console.log(`Dropping database ${databaseName}...`);
    await admin.query(`DROP DATABASE IF EXISTS ${quotedDatabase}`);
    console.log(`Creating database ${databaseName}...`);
    await admin.query(`CREATE DATABASE ${quotedDatabase}`);
  } finally {
    await admin.end();
  }

  const app = new Client({ ...config, database: databaseName });
  await app.connect();
  try {
    console.log('Applying schema...');
    await app.query(SCHEMA_SQL);
    console.log(`Database ${databaseName} reset successfully.`);
  } finally {
    await app.end();
  }
}

main().catch((error: unknown) => {
  console.error('Database reset failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
