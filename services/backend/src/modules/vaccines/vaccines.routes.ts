import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from '../../db/types.js';
import { pool } from '../../db/index.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { requireAuth } from '../../middlewares/auth.js';
import { canAccessPetHealthData } from '../pets/pet-access.js';

type VaccineRow = RowDataPacket & {
  id: string;
  pet_id: string;
  veterinarian_id: string | null;
  veterinarian_name: string | null;
  clinic_id: string | null;
  clinic_name: string | null;
  name: string;
  applied_date: Date | string;
  next_dose_date: Date | string | null;
  status: 'up-to-date' | 'late';
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

function formatDate(value: Date | string | null) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function getComputedStatus(nextDoseDate: Date | string | null) {
  if (!nextDoseDate) {
    return 'up-to-date' as const;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDose = new Date(typeof nextDoseDate === 'string' ? `${nextDoseDate}T00:00:00` : nextDoseDate);
  return nextDose.getTime() < today.getTime() ? 'late' : 'up-to-date';
}

function normalizeVaccine(row: VaccineRow) {
  return {
    id: row.id,
    petId: row.pet_id,
    veterinarianId: row.veterinarian_id ?? undefined,
    veterinarian: row.veterinarian_name ?? undefined,
    clinicId: row.clinic_id ?? undefined,
    clinicName: row.clinic_name ?? undefined,
    name: row.name,
    date: formatDate(row.applied_date)!,
    nextDose: formatDate(row.next_dose_date) ?? undefined,
    status: row.status,
    addedBy: row.added_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadVaccineById(db: DbClient, vaccineId: string) {
  const [rows] = await db.query<VaccineRow[]>(
    `
      SELECT
        id,
        pet_id,
        veterinarian_id,
        veterinarian_name,
        clinic_id,
        clinic_name,
        name,
        applied_date,
        next_dose_date,
        status,
        added_by,
        created_at,
        updated_at
      FROM vaccines
      WHERE id = ?
      LIMIT 1
    `,
    [vaccineId]
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

    const [rows] = await pool.query<VaccineRow[]>(
      `
        SELECT
          id,
          pet_id,
          veterinarian_id,
          veterinarian_name,
          clinic_id,
          clinic_name,
          name,
          applied_date,
          next_dose_date,
          status,
          added_by,
          created_at,
          updated_at
        FROM vaccines
        WHERE pet_id = ?
        ORDER BY applied_date DESC, created_at DESC
      `,
      [String(req.params.petId)]
    );

    res.json({ data: rows.map(normalizeVaccine) });
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
    const date = asTrimmedString(body.date ?? body.appliedDate);
    const name = asTrimmedString(body.name);
    const nextDose = asNullableString(body.nextDose ?? body.nextDoseDate);
    const veterinarian = asNullableString(body.veterinarian ?? body.veterinarianName);
    const clinicName = asNullableString(body.clinicName);

    if (!date || !name) {
      res.status(400).json({ message: 'date and name are required' });
      return;
    }

    const status = getComputedStatus(nextDose);

    await connection.beginTransaction();

    const id = randomUUID();
    await connection.execute(
      `
        INSERT INTO vaccines (
          id,
          pet_id,
          name,
          applied_date,
          next_dose_date,
          status,
          veterinarian_name,
          clinic_name,
          added_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        String(req.params.petId),
        name,
        date,
        nextDose,
        status,
        veterinarian,
        clinicName,
        req.user?.userType ?? 'veterinarian',
      ]
    );

    await connection.commit();

    const created = await loadVaccineById(pool, id);
    if (!created) {
      res.status(500).json({ message: 'Vaccine creation failed' });
      return;
    }

    res.status(201).json({ data: normalizeVaccine(created) });
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
    const existing = await loadVaccineById(connection, String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Vaccine not found' });
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
    let nextDoseValue: string | null | undefined;

    if (body.date !== undefined || body.appliedDate !== undefined) {
      const nextDate = asTrimmedString(body.date ?? body.appliedDate);
      if (!nextDate) {
        res.status(400).json({ message: 'date cannot be empty' });
        return;
      }
      assignments.push('applied_date = ?');
      values.push(nextDate);
    }

    if (body.name !== undefined) {
      const nextName = asTrimmedString(body.name);
      if (!nextName) {
        res.status(400).json({ message: 'name cannot be empty' });
        return;
      }
      assignments.push('name = ?');
      values.push(nextName);
    }

    if (body.nextDose !== undefined || body.nextDoseDate !== undefined) {
      nextDoseValue = asNullableString(body.nextDose ?? body.nextDoseDate);
      assignments.push('next_dose_date = ?');
      values.push(nextDoseValue);
    }

    if (body.veterinarian !== undefined || body.veterinarianName !== undefined) {
      assignments.push('veterinarian_name = ?');
      values.push(asNullableString(body.veterinarian ?? body.veterinarianName));
    }

    if (body.clinicName !== undefined) {
      assignments.push('clinic_name = ?');
      values.push(asNullableString(body.clinicName));
    }

    if (assignments.length === 0) {
      res.status(400).json({ message: 'No fields provided to update' });
      return;
    }

    const nextStatus = getComputedStatus(
      nextDoseValue !== undefined ? nextDoseValue : existing.next_dose_date
    );
    assignments.push('status = ?');
    values.push(nextStatus);

    values.push(String(req.params.id));
    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE vaccines SET ${assignments.join(', ')} WHERE id = ?`,
      values
    );

    if ((result.affectedRows ?? 0) === 0) {
      await connection.rollback();
      res.status(404).json({ message: 'Vaccine not found' });
      return;
    }

    await connection.commit();

    const updated = await loadVaccineById(pool, String(req.params.id));
    if (!updated) {
      res.status(500).json({ message: 'Vaccine update failed' });
      return;
    }

    res.json({ data: normalizeVaccine(updated) });
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
    const existing = await loadVaccineById(connection, String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Vaccine not found' });
      return;
    }

    const access = await canAccessPetHealthData(req.user, existing.pet_id);
    if (!access.allowed) {
      res.status(access.status ?? 403).json({ message: access.message });
      return;
    }

    const [result] = await connection.execute<ResultSetHeader>(
      'DELETE FROM vaccines WHERE id = ?',
      [String(req.params.id)]
    );

    if ((result.affectedRows ?? 0) === 0) {
      res.status(404).json({ message: 'Vaccine not found' });
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
