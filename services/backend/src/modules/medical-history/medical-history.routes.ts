import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from '../../db/types.js';
import { pool } from '../../db/index.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { requireAuth } from '../../middlewares/auth.js';
import { canAccessPetHealthData } from '../pets/pet-access.js';

type MedicalRecordRow = RowDataPacket & {
  id: string;
  pet_id: string;
  veterinarian_id: string | null;
  veterinarian_name: string | null;
  clinic_id: string | null;
  clinic_name: string | null;
  record_date: Date | string;
  description: string;
  treatment: string | null;
  documents: string | null;
  added_by: 'tutor' | 'veterinarian' | 'clinic';
  created_at: Date;
  updated_at: Date;
};

type DbClient = Pick<PoolConnection, 'execute' | 'query'>;

const router = Router();

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNullableString(value: unknown) {
  const text = asTrimmedString(value);
  return text.length > 0 ? text : null;
}

function formatDate(value: Date | string) {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function parseDocuments(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return JSON.stringify([value]);
    }
  }

  return JSON.stringify(value);
}

function normalizeDocuments(value: unknown): string[] | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => normalizeDocuments(item) ?? [])
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      return normalizeDocuments(parsed);
    } catch {
      return [trimmed];
    }
  }

  if (typeof value === 'object') {
    return [JSON.stringify(value)];
  }

  return null;
}

function normalizeMedicalRecord(row: MedicalRecordRow) {
  return {
    id: row.id,
    petId: row.pet_id,
    veterinarianId: row.veterinarian_id ?? undefined,
    veterinarianName: row.veterinarian_name ?? undefined,
    clinicId: row.clinic_id ?? undefined,
    clinicName: row.clinic_name ?? undefined,
    date: formatDate(row.record_date),
    description: row.description,
    treatment: row.treatment ?? undefined,
    documents: normalizeDocuments(row.documents) ?? undefined,
    addedBy: row.added_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadMedicalRecordById(db: DbClient, recordId: string) {
  const [rows] = await db.query<MedicalRecordRow[]>(
    `
      SELECT
        mr.id,
        mr.pet_id,
        mr.veterinarian_id,
        mr.veterinarian_name,
        mr.clinic_id,
        mr.clinic_name,
        mr.record_date,
        mr.description,
        mr.treatment,
        mr.documents,
        mr.added_by,
        mr.created_at,
        mr.updated_at
      FROM medical_records mr
      WHERE mr.id = ?
      LIMIT 1
    `,
    [recordId]
  );

  return rows[0] ?? null;
}

router.use(requireAuth);

router.get('/pet/:petId', async (req: AuthRequest, res, next) => {
  try {
    const access = await canAccessPetHealthData(req.user, String(req.params.petId));
    if (!access.allowed) {
      res.status(access.status ?? 403).json({ message: access.message });
      return;
    }

    const [rows] = await pool.query<MedicalRecordRow[]>(
      `
        SELECT
          mr.id,
          mr.pet_id,
          mr.veterinarian_id,
          mr.veterinarian_name,
          mr.clinic_id,
          mr.clinic_name,
          mr.record_date,
          mr.description,
          mr.treatment,
          mr.documents,
          mr.added_by,
          mr.created_at,
          mr.updated_at
        FROM medical_records mr
        WHERE mr.pet_id = ?
        ORDER BY mr.record_date DESC, mr.created_at DESC
      `,
      [String(req.params.petId)]
    );

    res.json({ data: rows.map(normalizeMedicalRecord) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const existing = await loadMedicalRecordById(pool, String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Medical record not found' });
      return;
    }

    const access = await canAccessPetHealthData(req.user, existing.pet_id);
    if (!access.allowed) {
      res.status(access.status ?? 403).json({ message: access.message });
      return;
    }

    res.json({ data: normalizeMedicalRecord(existing) });
  } catch (error) {
    next(error);
  }
});

router.post('/pet/:petId', async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    const access = await canAccessPetHealthData(req.user, String(req.params.petId));
    if (!access.allowed) {
      res.status(access.status ?? 403).json({ message: access.message });
      return;
    }

    const body = req.body ?? {};
    const recordDate = asTrimmedString(body.date ?? body.recordDate);
    const description = asTrimmedString(body.description);
    const treatment = asNullableString(body.treatment);
    const clinicName = asNullableString(body.clinicName);
    const veterinarianName = asNullableString(body.veterinarianName);
    const documents = parseDocuments(body.documents);

    if (!recordDate || !description) {
      res.status(400).json({ message: 'date and description are required' });
      return;
    }

    await connection.beginTransaction();

    const id = randomUUID();
    await connection.execute(
      `
        INSERT INTO medical_records (
          id,
          pet_id,
          record_date,
          description,
          treatment,
          clinic_name,
          veterinarian_name,
          documents,
          added_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        String(req.params.petId),
        recordDate,
        description,
        treatment,
        clinicName,
        veterinarianName,
        documents,
        req.user?.userType ?? 'veterinarian',
      ]
    );

    await connection.commit();

    const created = await loadMedicalRecordById(pool, id);
    if (!created) {
      res.status(500).json({ message: 'Medical record creation failed' });
      return;
    }

    res.status(201).json({ data: normalizeMedicalRecord(created) });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.patch('/:id', async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    const existing = await loadMedicalRecordById(connection, String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Medical record not found' });
      return;
    }

    const access = await canAccessPetHealthData(req.user, existing.pet_id);
    if (!access.allowed) {
      res.status(access.status ?? 403).json({ message: access.message });
      return;
    }

    const body = req.body ?? {};
    const assignments: string[] = [];
    const values: Array<string | null> = [];

    if (body.date !== undefined || body.recordDate !== undefined) {
      const nextDate = asTrimmedString(body.date ?? body.recordDate);
      if (!nextDate) {
        res.status(400).json({ message: 'date cannot be empty' });
        return;
      }
      assignments.push('record_date = ?');
      values.push(nextDate);
    }

    if (body.description !== undefined) {
      const nextDescription = asTrimmedString(body.description);
      if (!nextDescription) {
        res.status(400).json({ message: 'description cannot be empty' });
        return;
      }
      assignments.push('description = ?');
      values.push(nextDescription);
    }

    if (body.treatment !== undefined) {
      assignments.push('treatment = ?');
      values.push(asNullableString(body.treatment));
    }

    if (body.clinicName !== undefined) {
      assignments.push('clinic_name = ?');
      values.push(asNullableString(body.clinicName));
    }

    if (body.veterinarianName !== undefined) {
      assignments.push('veterinarian_name = ?');
      values.push(asNullableString(body.veterinarianName));
    }

    if (body.documents !== undefined) {
      assignments.push('documents = ?');
      values.push(parseDocuments(body.documents));
    }

    if (assignments.length === 0) {
      res.status(400).json({ message: 'No fields provided to update' });
      return;
    }

    values.push(String(req.params.id));
    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE medical_records SET ${assignments.join(', ')} WHERE id = ?`,
      values
    );

    if ((result.affectedRows ?? 0) === 0) {
      await connection.rollback();
      res.status(404).json({ message: 'Medical record not found' });
      return;
    }

    await connection.commit();

    const updated = await loadMedicalRecordById(pool, String(req.params.id));
    if (!updated) {
      res.status(500).json({ message: 'Medical record update failed' });
      return;
    }

    res.json({ data: normalizeMedicalRecord(updated) });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    const existing = await loadMedicalRecordById(connection, String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Medical record not found' });
      return;
    }

    const access = await canAccessPetHealthData(req.user, existing.pet_id);
    if (!access.allowed) {
      res.status(access.status ?? 403).json({ message: access.message });
      return;
    }

    const [result] = await connection.execute<ResultSetHeader>(
      'DELETE FROM medical_records WHERE id = ?',
      [String(req.params.id)]
    );

    if ((result.affectedRows ?? 0) === 0) {
      res.status(404).json({ message: 'Medical record not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

export default router;
