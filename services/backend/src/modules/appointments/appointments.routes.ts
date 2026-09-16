import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from '../../db/types.js';
import { pool } from '../../db/index.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { requireAuth } from '../../middlewares/auth.js';
import { findClinicByUserId, findTutorByUserId, findVeterinarianByUserId } from '../users/users.service.js';
import { asTrimmedString, formatDate, getWeekdayKey, isWithinRange, timeToMinutes } from './appointments.utils.js';

type AppointmentRow = RowDataPacket & {
  id: string;
  pet_id: string;
  pet_name: string;
  tutor_id: string;
  veterinarian_id: string | null;
  clinic_id: string | null;
  clinic_name: string | null;
  veterinarian_name: string | null;
  veterinarian_email: string | null;
  veterinarian_phone: string | null;
  appointment_date: Date | string;
  appointment_time: string;
  reason: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_at: Date;
  updated_at: Date;
};

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

async function loadPetById(db: DbClient, petId: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT id, current_tutor_id, linked_clinic_id, name FROM pets WHERE id = ? LIMIT 1',
    [petId]
  );

  return rows[0] as
    | { id: string; current_tutor_id: string | null; linked_clinic_id: string | null; name: string }
    | undefined;
}

async function resolveCurrentTutorId(user: AuthRequest['user']) {
  if (user?.userType !== 'tutor') return null;
  const tutor = await findTutorByUserId(user.id);
  return tutor?.id ?? null;
}

async function resolveCurrentClinicId(user: AuthRequest['user']) {
  if (user?.userType !== 'clinic') return null;
  const clinic = await findClinicByUserId(user.id);
  return clinic?.id ?? null;
}

async function resolveCurrentVeterinarianId(user: AuthRequest['user']) {
  if (user?.userType !== 'veterinarian') return null;
  const veterinarian = await findVeterinarianByUserId(user.id);
  return veterinarian?.id ?? null;
}

/** Accepts either a clinics.id or the clinic owner's users.id and returns the clinics.id. */
async function resolveClinicProfileId(db: DbClient, value: string) {
  if (!value) return null;
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT id FROM clinics WHERE id = ? OR user_id = ? LIMIT 1',
    [value, value]
  );
  return rows[0]?.id ? String(rows[0].id) : null;
}

/** Accepts either a veterinarians.id or the vet owner's users.id and returns the veterinarians.id. */
async function resolveVeterinarianProfileId(db: DbClient, value: string) {
  if (!value) return null;
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT id FROM veterinarians WHERE id = ? OR user_id = ? LIMIT 1',
    [value, value]
  );
  return rows[0]?.id ? String(rows[0].id) : null;
}

function normalizeAppointment(row: AppointmentRow) {
  return {
    id: row.id,
    petId: row.pet_id,
    petName: row.pet_name,
    tutorId: row.tutor_id,
    veterinarianId: row.veterinarian_id ?? undefined,
    clinicId: row.clinic_id ?? undefined,
    clinicName: row.clinic_name ?? undefined,
    veterinarianName: row.veterinarian_name ?? undefined,
    veterinarianEmail: row.veterinarian_email ?? undefined,
    veterinarianPhone: row.veterinarian_phone ?? undefined,
    date: formatDate(row.appointment_date),
    time: row.appointment_time,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadAppointmentById(db: DbClient, id: string) {
  const [rows] = await db.query<AppointmentRow[]>(
    `
      SELECT
        id,
        pet_id,
        pet_name,
        tutor_id,
        veterinarian_id,
        clinic_id,
        clinic_name,
        veterinarian_name,
        veterinarian_email,
        veterinarian_phone,
        appointment_date,
        appointment_time,
        reason,
        status,
        created_at,
        updated_at
      FROM appointments
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
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

async function loadClinicWorkingHours(db: DbClient, clinicId: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT working_hours FROM clinics WHERE id = ? LIMIT 1',
    [clinicId]
  );

  const row = rows[0] as { working_hours?: string | null } | undefined;
  if (!row?.working_hours) return null;

  try {
    const parsed = JSON.parse(row.working_hours);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, { open?: string; close?: string } | undefined>;
  } catch {
    return null;
  }
}

async function isVeterinarianLinkedToClinic(db: DbClient, clinicId: string, veterinarianId: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    `
      SELECT id
      FROM clinic_veterinarians
      WHERE clinic_id = ?
        AND veterinarian_id = ?
        AND status = 'approved'
      LIMIT 1
    `,
    [clinicId, veterinarianId]
  );

  return rows.length > 0;
}

async function resolveAvailability(
  db: DbClient,
  input: {
    date: string;
    time: string;
    clinicId?: string | null;
    veterinarianId?: string | null;
  }
) {
  const issues: string[] = [];
  const weekday = getWeekdayKey(input.date);
  let workingHours: Record<string, { open?: string; close?: string } | undefined> | null = null;

  if (input.clinicId) {
    workingHours = await loadClinicWorkingHours(db, input.clinicId);
    if (!workingHours) {
      issues.push('A clínica selecionada não possui horário de funcionamento configurado.');
    } else if (weekday) {
      const hours = workingHours[weekday];
      if (!hours?.open || !hours?.close) {
        issues.push('A clínica selecionada não atende neste dia.');
      } else if (!isWithinRange(input.time, hours.open, hours.close)) {
        issues.push('O horário escolhido está fora do funcionamento da clínica.');
      }
    }
  }

  if (input.clinicId && input.veterinarianId) {
    const linked = await isVeterinarianLinkedToClinic(db, input.clinicId, input.veterinarianId);
    if (!linked) {
      issues.push('O veterinário selecionado não está vinculado à clínica escolhida.');
    }
  }

  const appointmentClauses: string[] = ['appointment_date = ?', "status = 'scheduled'"];
  const appointmentValues: Array<string> = [input.date];

  if (input.clinicId && input.veterinarianId) {
    appointmentClauses.push('(clinic_id = ? OR veterinarian_id = ?)');
    appointmentValues.push(input.clinicId, input.veterinarianId);
  } else if (input.clinicId) {
    appointmentClauses.push('clinic_id = ?');
    appointmentValues.push(input.clinicId);
  } else if (input.veterinarianId) {
    appointmentClauses.push('veterinarian_id = ?');
    appointmentValues.push(input.veterinarianId);
  }

  const [rows] = await db.query<AppointmentRow[]>(
    `SELECT appointment_time FROM appointments WHERE ${appointmentClauses.join(' AND ')}`,
    appointmentValues
  );

  const busyTimes = rows.map((row) => row.appointment_time);
  const isBusy = busyTimes.includes(input.time);

  return {
    isAvailable: issues.length === 0 && !isBusy,
    busyTimes,
    workingHours,
    issues,
  };
}

async function canAccessPet(user: AuthRequest['user'], petId: string) {
  const pet = await loadPetById(pool, petId);
  if (!pet) return { allowed: false, status: 404, message: 'Pet not found' as const };

  if (user?.userType === 'tutor') {
    const tutorId = await resolveCurrentTutorId(user);
    if (!tutorId || pet.current_tutor_id !== tutorId) {
      return { allowed: false, status: 403, message: 'Forbidden' as const };
    }
  }

  if (user?.userType === 'clinic') {
    const clinicId = await resolveCurrentClinicId(user);
    if (!clinicId || pet.linked_clinic_id !== clinicId) {
      return { allowed: false, status: 403, message: 'Forbidden' as const };
    }
  }

  if (user?.userType === 'veterinarian') {
    const veterinarianId = await resolveCurrentVeterinarianId(user);
    if (!veterinarianId) {
      return { allowed: false, status: 403, message: 'Forbidden' as const };
    }
  }

  return { allowed: true, pet };
}

async function listAppointmentsForUser(user: AuthRequest['user']) {
  if (user?.userType === 'tutor') {
    const tutorId = await resolveCurrentTutorId(user);
    if (!tutorId) return [];
    const [rows] = await pool.query<AppointmentRow[]>(
      'SELECT * FROM appointments WHERE tutor_id = ? ORDER BY appointment_date DESC, appointment_time DESC',
      [tutorId]
    );
    return rows;
  }

  if (user?.userType === 'clinic') {
    const clinicId = await resolveCurrentClinicId(user);
    if (!clinicId) return [];
    const [rows] = await pool.query<AppointmentRow[]>(
      'SELECT * FROM appointments WHERE clinic_id = ? ORDER BY appointment_date DESC, appointment_time DESC',
      [clinicId]
    );
    return rows;
  }

  if (user?.userType === 'veterinarian') {
    const veterinarianId = await resolveCurrentVeterinarianId(user);
    if (!veterinarianId) return [];
    const [rows] = await pool.query<AppointmentRow[]>(
      'SELECT * FROM appointments WHERE veterinarian_id = ? ORDER BY appointment_date DESC, appointment_time DESC',
      [veterinarianId]
    );
    return rows;
  }

  return [];
}

router.use(requireAuth);

router.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const rows = await listAppointmentsForUser(req.user);
    res.json({ data: rows.map(normalizeAppointment) });
  } catch (error) {
    next(error);
  }
});

router.get('/pet/:petId', async (req: AuthRequest, res, next) => {
  try {
    const access = await canAccessPet(req.user, String(req.params.petId));
    if (!access.allowed) {
      res.status(access.status ?? 403).json({ message: access.message });
      return;
    }

    const [rows] = await pool.query<AppointmentRow[]>(
      'SELECT * FROM appointments WHERE pet_id = ? ORDER BY appointment_date DESC, appointment_time DESC',
      [String(req.params.petId)]
    );

    res.json({ data: rows.map(normalizeAppointment) });
  } catch (error) {
    next(error);
  }
});

router.get('/availability', async (req: AuthRequest, res, next) => {
  try {
    const date = asTrimmedString(req.query.date);
    const time = asTrimmedString(req.query.time);
    const clinicId = asTrimmedString(req.query.clinicId);
    const veterinarianId = asTrimmedString(req.query.veterinarianId);

    if (!date || !time) {
      res.status(400).json({ message: 'date and time are required' });
      return;
    }

    if (!clinicId && !veterinarianId) {
      res.status(400).json({ message: 'clinicId or veterinarianId is required' });
      return;
    }

    const resolvedClinicId = clinicId ? await resolveClinicProfileId(pool, clinicId) : null;
    const resolvedVeterinarianId = veterinarianId ? await resolveVeterinarianProfileId(pool, veterinarianId) : null;

    const availability = await resolveAvailability(pool, {
      date,
      time,
      clinicId: resolvedClinicId,
      veterinarianId: resolvedVeterinarianId,
    });

    res.json({
      data: {
        isAvailable: availability.isAvailable,
        busyTimes: availability.busyTimes,
        workingHours: availability.workingHours,
        issues: availability.issues,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    const body = req.body ?? {};
    const petId = asTrimmedString(body.petId);
    const date = asTrimmedString(body.date ?? body.appointmentDate);
    const time = asTrimmedString(body.time ?? body.appointmentTime);
    const reason = asTrimmedString(body.reason);
    const targetType = asTrimmedString(body.targetType).toLowerCase();
    const clinicIdInput = asTrimmedString(body.clinicId);
    const veterinarianIdInput = asTrimmedString(body.veterinarianId);
    const vetPassCode = asTrimmedString(body.vetPassCode).toUpperCase();
    const clinicName = asTrimmedString(body.clinicName) || null;
    const veterinarianName = asTrimmedString(body.veterinarianName) || null;
    const veterinarianEmail = asTrimmedString(body.veterinarianEmail) || null;
    const veterinarianPhone = asTrimmedString(body.veterinarianPhone) || null;

    if (!petId || !date || !time || !reason) {
      res.status(400).json({ message: 'petId, date, time and reason are required' });
      return;
    }

    const resolvedTargetType = ['clinic', 'veterinarian'].includes(targetType)
      ? targetType
      : veterinarianIdInput
        ? 'veterinarian'
        : clinicIdInput
          ? 'clinic'
          : '';

    if (!resolvedTargetType) {
      res.status(400).json({ message: 'targetType, clinicId or veterinarianId are required' });
      return;
    }

    const access = await canAccessPet(req.user, petId);
    if (!access.allowed) {
      res.status(access.status ?? 403).json({ message: access.message });
      return;
    }

    const tutorId = await resolveCurrentTutorId(req.user);
    const explicitTutorId = asTrimmedString(body.tutorId);
    const nextTutorId = tutorId ?? (explicitTutorId || access.pet?.current_tutor_id || null);

    if (!nextTutorId) {
      res.status(400).json({ message: 'Tutor could not be resolved for appointment creation' });
      return;
    }

    // O Vet-Pass é opcional no agendamento. Se for informado, validamos que pertence
    // ao mesmo tutor/pet e que não está expirado.
    if (vetPassCode) {
      const vetPass = await loadVetPassByCode(connection, vetPassCode);
      if (!vetPass) {
        res.status(404).json({ message: 'Vet-Pass not found' });
        return;
      }

      if (vetPass.tutor_id !== nextTutorId || vetPass.pet_id !== petId) {
        res.status(403).json({ message: 'Vet-Pass does not match the selected pet' });
        return;
      }

      if (new Date(vetPass.expires_at).getTime() < Date.now()) {
        res.status(410).json({ message: 'Vet-Pass expired' });
        return;
      }
    }

    const nextClinicId = clinicIdInput ? await resolveClinicProfileId(connection, clinicIdInput) : null;
    const nextVeterinarianId = veterinarianIdInput ? await resolveVeterinarianProfileId(connection, veterinarianIdInput) : null;

    if (clinicIdInput && !nextClinicId) {
      res.status(404).json({ message: 'Clinic not found' });
      return;
    }

    if (veterinarianIdInput && !nextVeterinarianId) {
      res.status(404).json({ message: 'Veterinarian not found' });
      return;
    }

    if (resolvedTargetType === 'clinic' && !nextClinicId) {
      res.status(400).json({ message: 'clinicId is required for clinic appointments' });
      return;
    }

    if (resolvedTargetType === 'veterinarian' && !nextVeterinarianId) {
      res.status(400).json({ message: 'veterinarianId is required for veterinarian appointments' });
      return;
    }

    const availability = await resolveAvailability(connection, {
      date,
      time,
      clinicId: nextClinicId,
      veterinarianId: nextVeterinarianId,
    });

    if (!availability.isAvailable) {
      res.status(409).json({
        message: availability.issues[0] ?? 'Selected time is not available',
        issues: availability.issues,
        busyTimes: availability.busyTimes,
      });
      return;
    }

    if (nextClinicId && nextVeterinarianId) {
      const linked = await isVeterinarianLinkedToClinic(connection, nextClinicId, nextVeterinarianId);
      if (!linked) {
        res.status(409).json({ message: 'Veterinarian is not linked to the selected clinic' });
        return;
      }
    }

    await connection.beginTransaction();

    const id = randomUUID();
    await connection.execute(
      `
        INSERT INTO appointments (
          id,
          pet_id,
          pet_name,
          tutor_id,
          veterinarian_id,
          clinic_id,
          clinic_name,
          veterinarian_name,
          veterinarian_email,
          veterinarian_phone,
          appointment_date,
          appointment_time,
          reason,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        petId,
        access.pet?.name ?? (asTrimmedString(body.petName) || ''),
        nextTutorId,
        nextVeterinarianId,
        nextClinicId,
        nextClinicId ? clinicName : null,
        nextVeterinarianId ? veterinarianName : null,
        nextVeterinarianId ? veterinarianEmail : null,
        nextVeterinarianId ? veterinarianPhone : null,
        date,
        time,
        reason,
        asTrimmedString(body.status) === 'completed' || asTrimmedString(body.status) === 'cancelled'
          ? asTrimmedString(body.status)
          : 'scheduled',
      ]
    );

    await connection.commit();

    const created = await loadAppointmentById(pool, id);
    if (!created) {
      res.status(500).json({ message: 'Appointment creation failed' });
      return;
    }

    res.status(201).json({ data: normalizeAppointment(created) });
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
    const existing = await loadAppointmentById(connection, String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }

    const access = await canAccessPet(req.user, existing.pet_id);
    if (!access.allowed) {
      res.status(access.status ?? 403).json({ message: access.message });
      return;
    }

    const body = req.body ?? {};
    const assignments: string[] = [];
    const values: Array<string | null> = [];

    if (body.date !== undefined || body.appointmentDate !== undefined) {
      const nextDate = asTrimmedString(body.date ?? body.appointmentDate);
      if (!nextDate) {
        res.status(400).json({ message: 'date cannot be empty' });
        return;
      }
      assignments.push('appointment_date = ?');
      values.push(nextDate);
    }

    if (body.time !== undefined || body.appointmentTime !== undefined) {
      const nextTime = asTrimmedString(body.time ?? body.appointmentTime);
      if (!nextTime) {
        res.status(400).json({ message: 'time cannot be empty' });
        return;
      }
      assignments.push('appointment_time = ?');
      values.push(nextTime);
    }

    if (body.reason !== undefined) {
      const nextReason = asTrimmedString(body.reason);
      if (!nextReason) {
        res.status(400).json({ message: 'reason cannot be empty' });
        return;
      }
      assignments.push('reason = ?');
      values.push(nextReason);
    }

    if (body.status !== undefined) {
      const nextStatus = asTrimmedString(body.status);
      if (!['scheduled', 'completed', 'cancelled'].includes(nextStatus)) {
        res.status(400).json({ message: 'status is invalid' });
        return;
      }
      assignments.push('status = ?');
      values.push(nextStatus);
    }

    if (body.veterinarianName !== undefined) {
      assignments.push('veterinarian_name = ?');
      values.push(asTrimmedString(body.veterinarianName) || null);
    }

    if (body.veterinarianEmail !== undefined) {
      assignments.push('veterinarian_email = ?');
      values.push(asTrimmedString(body.veterinarianEmail) || null);
    }

    if (body.veterinarianPhone !== undefined) {
      assignments.push('veterinarian_phone = ?');
      values.push(asTrimmedString(body.veterinarianPhone) || null);
    }

    if (assignments.length === 0) {
      res.status(400).json({ message: 'No fields provided to update' });
      return;
    }

    values.push(String(req.params.id));
    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE appointments SET ${assignments.join(', ')} WHERE id = ?`,
      values
    );

    if ((result.affectedRows ?? 0) === 0) {
      await connection.rollback();
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }

    await connection.commit();

    const updated = await loadAppointmentById(pool, String(req.params.id));
    if (!updated) {
      res.status(500).json({ message: 'Appointment update failed' });
      return;
    }

    res.json({ data: normalizeAppointment(updated) });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const existing = await loadAppointmentById(pool, String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }

    const access = await canAccessPet(req.user, existing.pet_id);
    if (!access.allowed) {
      res.status(access.status ?? 403).json({ message: access.message });
      return;
    }

    await pool.execute('DELETE FROM appointments WHERE id = ?', [String(req.params.id)]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

