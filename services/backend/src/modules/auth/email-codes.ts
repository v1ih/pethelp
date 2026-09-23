import { randomInt, randomUUID } from 'node:crypto';
import { pool } from '../../db/index.js';
import type { RowDataPacket } from '../../db/types.js';

export type CodePurpose = 'recovery' | 'verification';

/** E-mails are always stored and compared in lower case (PostgreSQL '=' is case-sensitive). */
export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function generateCode() {
  return String(randomInt(100000, 1000000));
}

/** Creates (and persists) a fresh code for an e-mail + purpose, replacing any previous one. */
export async function createEmailCode(rawEmail: string, purpose: CodePurpose, ttlMinutes = 15) {
  const email = normalizeEmail(rawEmail);
  const code = generateCode();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  await pool.execute('DELETE FROM email_codes WHERE email = ? AND purpose = ?', [email, purpose]);
  await pool.execute(
    'INSERT INTO email_codes (id, email, code, purpose, expires_at) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), email, code, purpose, expiresAt]
  );
  return code;
}

/** Validates a code; on success it is consumed (deleted). Returns true only if valid and unexpired. */
export async function verifyEmailCode(rawEmail: string, purpose: CodePurpose, code: string): Promise<boolean> {
  const email = normalizeEmail(rawEmail);
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, expires_at FROM email_codes WHERE email = ? AND purpose = ? AND code = ? LIMIT 1',
    [email, purpose, code]
  );
  const row = rows[0];
  if (!row) return false;

  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    await pool.execute('DELETE FROM email_codes WHERE id = ?', [String(row.id)]);
    return false;
  }

  await pool.execute('DELETE FROM email_codes WHERE email = ? AND purpose = ?', [email, purpose]);
  return true;
}
