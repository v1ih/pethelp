import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from '../../db/types.js';
import { pool } from '../../db/index.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { requireAuth } from '../../middlewares/auth.js';
import { findTutorByUserId } from '../users/users.service.js';

type VetPassRow = RowDataPacket & {
  id: string;
  pass_code: string;
  tutor_id: string;
  pet_id: string;
  pet_name: string;
  documents: string;
  redeemed_by_user_id: string | null;
  created_at: Date;
  expires_at: Date | string;
  redeemed_at: Date | string | null;
  updated_at: Date;
};

type DbClient = Pick<PoolConnection, 'execute' | 'query'>;

const router = Router();

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseDocuments(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parseDocuments(parsed);
    } catch {
      return [];
    }
  }

  if (typeof value === 'object') {
    return [value];
  }

  return [];
}

function normalizeVetPass(row: VetPassRow) {
  return {
    id: row.id,
    code: row.pass_code,
    tutorId: row.tutor_id,
    petId: row.pet_id,
    petName: row.pet_name,
    documents: parseDocuments(row.documents),
    redeemedByUserId: row.redeemed_by_user_id ?? undefined,
    createdAt: row.created_at,
    expiresAt: typeof row.expires_at === 'string' ? row.expires_at : row.expires_at.toISOString(),
    redeemedAt:
      row.redeemed_at === null
        ? undefined
        : typeof row.redeemed_at === 'string'
          ? row.redeemed_at
          : row.redeemed_at.toISOString(),
    updatedAt: row.updated_at,
  };
}

async function resolveCurrentTutorId(user: AuthRequest['user']) {
  if (user?.userType !== 'tutor') return null;
  const tutor = await findTutorByUserId(user.id);
  return tutor?.id ?? null;
}

async function loadVetPassByCode(db: DbClient, code: string) {
  const [rows] = await db.query<VetPassRow[]>(
    `
      SELECT
        id,
        pass_code,
        tutor_id,
        pet_id,
        pet_name,
        documents,
        redeemed_by_user_id,
        created_at,
        expires_at,
        redeemed_at,
        updated_at
      FROM vet_passes
      WHERE pass_code = ?
      LIMIT 1
    `,
    [code]
  );

  return rows[0] ?? null;
}

async function loadPetById(db: DbClient, petId: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT id, current_tutor_id, name FROM pets WHERE id = ? LIMIT 1',
    [petId]
  );

  return rows[0] as { id: string; current_tutor_id: string | null; name: string } | undefined;
}

router.use(requireAuth);

router.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const tutorId = await resolveCurrentTutorId(req.user);
    if (!tutorId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const [rows] = await pool.query<VetPassRow[]>(
      'SELECT * FROM vet_passes WHERE tutor_id = ? ORDER BY created_at DESC',
      [tutorId]
    );

    res.json({ data: rows.map(normalizeVetPass) });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    const tutorId = await resolveCurrentTutorId(req.user);
    if (!tutorId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const body = req.body ?? {};
    const petId = asTrimmedString(body.petId);
    const petName = asTrimmedString(body.petName);
    const documents = parseDocuments(body.documents);
    const expiresInDays = Number.isFinite(Number(body.expiresInDays)) ? Number(body.expiresInDays) : 30;

    const pet = await loadPetById(connection, petId);
    if (!pet || pet.current_tutor_id !== tutorId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    // Anexos são opcionais: dá para gerar um Vet-Pass mesmo sem exames anexados.
    if (!petId || !petName) {
      res.status(400).json({ message: 'petId and petName are required' });
      return;
    }

    const passCode = asTrimmedString(body.code) || `VET-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    await connection.beginTransaction();
    const id = randomUUID();
    await connection.execute(
      `
        INSERT INTO vet_passes (
          id,
          pass_code,
          tutor_id,
          pet_id,
          pet_name,
          documents,
          redeemed_by_user_id,
          expires_at,
          redeemed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [id, passCode, tutorId, petId, petName, JSON.stringify(documents), null, expiresAt, null]
    );
    await connection.commit();

    const created = await loadVetPassByCode(pool, passCode);
    if (!created) {
      res.status(500).json({ message: 'Vet-Pass creation failed' });
      return;
    }

    res.status(201).json({ data: normalizeVetPass(created) });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.post('/:code/redeem', async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    const passCode = String(req.params.code).trim().toUpperCase();
    if (!passCode) {
      res.status(400).json({ message: 'code is required' });
      return;
    }

    const pass = await loadVetPassByCode(connection, passCode);
    if (!pass) {
      res.status(404).json({ message: 'Vet-Pass not found' });
      return;
    }

    if (new Date(pass.expires_at).getTime() < Date.now()) {
      res.status(410).json({ message: 'Vet-Pass expired' });
      return;
    }

    if (req.user?.userType !== 'veterinarian') {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    if (pass.redeemed_by_user_id && pass.redeemed_by_user_id !== req.user.id) {
      res.status(409).json({ message: 'Vet-Pass has already been redeemed by another veterinarian' });
      return;
    }

    await connection.beginTransaction();
    await connection.execute(
      'UPDATE vet_passes SET redeemed_by_user_id = ?, redeemed_at = COALESCE(redeemed_at, CURRENT_TIMESTAMP) WHERE pass_code = ?',
      [req.user.id, passCode]
    );
    await connection.commit();

    const updated = await loadVetPassByCode(pool, passCode);
    if (!updated) {
      res.status(500).json({ message: 'Vet-Pass redemption failed' });
      return;
    }

    res.json({ data: normalizeVetPass(updated) });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.get('/:code', async (req: AuthRequest, res, next) => {
  try {
    const code = String(req.params.code).trim().toUpperCase();
    const pass = await loadVetPassByCode(pool, code);
    if (!pass) {
      res.status(404).json({ message: 'Vet-Pass not found' });
      return;
    }

    if (req.user?.userType === 'tutor') {
      const tutorId = await resolveCurrentTutorId(req.user);
      if (!tutorId || pass.tutor_id !== tutorId) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }
    }

    if (req.user?.userType === 'veterinarian' && pass.redeemed_by_user_id !== req.user.id) {
      res.status(403).json({ message: 'Redeem this Vet-Pass before accessing its documents' });
      return;
    }

    res.json({ data: normalizeVetPass(pass) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:code', async (req: AuthRequest, res, next) => {
  try {
    const code = String(req.params.code).trim().toUpperCase();
    const pass = await loadVetPassByCode(pool, code);
    if (!pass) {
      res.status(404).json({ message: 'Vet-Pass not found' });
      return;
    }

    const tutorId = await resolveCurrentTutorId(req.user);
    if (!tutorId || pass.tutor_id !== tutorId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM vet_passes WHERE pass_code = ?', [code]);
    if ((result.affectedRows ?? 0) === 0) {
      res.status(404).json({ message: 'Vet-Pass not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

