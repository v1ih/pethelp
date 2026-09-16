import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from '../../db/types.js';
import { pool } from '../../db/index.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { requireAuth } from '../../middlewares/auth.js';
import { findClinicByUserId, findTutorByUserId, findVeterinarianByUserId } from '../users/users.service.js';

type ReviewRow = RowDataPacket & {
  id: string;
  appointment_id: string;
  pet_id: string;
  tutor_id: string;
  veterinarian_id: string;
  clinic_name: string | null;
  rating: number;
  comment: string;
  created_at: Date;
  updated_at: Date;
};

type AppointmentAccessRow = RowDataPacket & {
  id: string;
  pet_id: string;
  tutor_id: string;
  veterinarian_id: string | null;
  clinic_name: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
};

type DbClient = Pick<PoolConnection, 'execute' | 'query'>;

const router = Router();

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function resolveCurrentTutorId(user: AuthRequest['user']) {
  if (user?.userType !== 'tutor') return null;
  const tutor = await findTutorByUserId(user.id);
  return tutor?.id ?? null;
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

async function loadReviewById(db: DbClient, reviewId: string) {
  const [rows] = await db.query<ReviewRow[]>(
    `
      SELECT
        id,
        appointment_id,
        pet_id,
        tutor_id,
        veterinarian_id,
        clinic_name,
        rating,
        comment,
        created_at,
        updated_at
      FROM reviews
      WHERE id = ?
      LIMIT 1
    `,
    [reviewId]
  );

  return rows[0] ?? null;
}

async function loadReviewByAppointmentId(db: DbClient, appointmentId: string) {
  const [rows] = await db.query<ReviewRow[]>(
    `
      SELECT
        id,
        appointment_id,
        pet_id,
        tutor_id,
        veterinarian_id,
        clinic_name,
        rating,
        comment,
        created_at,
        updated_at
      FROM reviews
      WHERE appointment_id = ?
      LIMIT 1
    `,
    [appointmentId]
  );

  return rows[0] ?? null;
}

async function loadAppointmentAccess(db: DbClient, appointmentId: string) {
  const [rows] = await db.query<AppointmentAccessRow[]>(
    `
      SELECT
        id,
        pet_id,
        tutor_id,
        veterinarian_id,
        clinic_name,
        status
      FROM appointments
      WHERE id = ?
      LIMIT 1
    `,
    [appointmentId]
  );

  return rows[0] ?? null;
}

function normalizeReview(row: ReviewRow) {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    petId: row.pet_id,
    tutorId: row.tutor_id,
    veterinarianId: row.veterinarian_id,
    clinicName: row.clinic_name ?? undefined,
    rating: Number(row.rating),
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.use(requireAuth);

router.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const reviewColumns = `
      id,
      appointment_id,
      pet_id,
      tutor_id,
      veterinarian_id,
      clinic_name,
      rating,
      comment,
      created_at,
      updated_at
    `;

    if (req.user?.userType === 'tutor') {
      const tutorId = await resolveCurrentTutorId(req.user);
      if (!tutorId) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      const [rows] = await pool.query<ReviewRow[]>(
        `SELECT ${reviewColumns} FROM reviews WHERE tutor_id = ? ORDER BY created_at DESC`,
        [tutorId]
      );

      res.json({ data: rows.map(normalizeReview) });
      return;
    }

    if (req.user?.userType === 'veterinarian') {
      const veterinarian = await findVeterinarianByUserId(req.user.id);
      if (!veterinarian) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      const [rows] = await pool.query<ReviewRow[]>(
        `SELECT ${reviewColumns} FROM reviews WHERE veterinarian_id = ? ORDER BY created_at DESC`,
        [veterinarian.id]
      );

      res.json({ data: rows.map(normalizeReview) });
      return;
    }

    if (req.user?.userType === 'clinic') {
      const clinic = await findClinicByUserId(req.user.id);
      if (!clinic) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      const [rows] = await pool.query<ReviewRow[]>(
        `
          SELECT
            r.id,
            r.appointment_id,
            r.pet_id,
            r.tutor_id,
            r.veterinarian_id,
            r.clinic_name,
            r.rating,
            r.comment,
            r.created_at,
            r.updated_at
          FROM reviews r
          JOIN appointments a ON a.id = r.appointment_id
          WHERE a.clinic_id = ? OR r.clinic_name = ?
          ORDER BY r.created_at DESC
        `,
        [clinic.id, clinic.trade_name]
      );

      res.json({ data: rows.map(normalizeReview) });
      return;
    }

    res.status(403).json({ message: 'Forbidden' });
  } catch (error) {
    next(error);
  }
});

router.get('/veterinarian/:veterinarianId', async (req, res, next) => {
  try {
    const [rows] = await pool.query<ReviewRow[]>(
      `
        SELECT
          id,
          appointment_id,
          pet_id,
          tutor_id,
          veterinarian_id,
          clinic_name,
          rating,
          comment,
          created_at,
          updated_at
        FROM reviews
        WHERE veterinarian_id = ?
        ORDER BY created_at DESC
      `,
      [String(req.params.veterinarianId)]
    );

    res.json({ data: rows.map(normalizeReview) });
  } catch (error) {
    next(error);
  }
});

router.get('/appointment/:appointmentId', async (req, res, next) => {
  try {
    const [rows] = await pool.query<ReviewRow[]>(
      `
        SELECT
          id,
          appointment_id,
          pet_id,
          tutor_id,
          veterinarian_id,
          clinic_name,
          rating,
          comment,
          created_at,
          updated_at
        FROM reviews
        WHERE appointment_id = ?
        LIMIT 1
      `,
      [String(req.params.appointmentId)]
    );

    res.json({ data: rows[0] ? normalizeReview(rows[0]) : null });
  } catch (error) {
    next(error);
  }
});

router.get('/summary/:veterinarianId', async (req, res, next) => {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
        SELECT
          COUNT(*) AS total_reviews,
          AVG(rating) AS average_rating
        FROM reviews
        WHERE veterinarian_id = ?
      `,
      [String(req.params.veterinarianId)]
    );

    const row = rows[0] ?? { total_reviews: 0, average_rating: null };
    res.json({
      data: {
        totalReviews: Number(row.total_reviews ?? 0),
        averageRating: row.average_rating === null ? 0 : Number(row.average_rating),
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
    const appointmentId = asTrimmedString(body.appointmentId);
    const rating = Number(body.rating);
    const comment = asTrimmedString(body.comment);

    if (!appointmentId || !Number.isInteger(rating) || rating < 1 || rating > 5 || !comment) {
      res.status(400).json({ message: 'appointmentId, rating and comment are required' });
      return;
    }

    const tutorId = await resolveCurrentTutorId(req.user);
    if (!tutorId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const appointment = await loadAppointmentAccess(connection, appointmentId);
    if (!appointment) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }

    if (appointment.tutor_id !== tutorId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    if (appointment.status !== 'completed') {
      res.status(409).json({ message: 'Appointment must be completed before rating' });
      return;
    }

    const requestedVeterinarianId = asTrimmedString(body.veterinarianId) || appointment.veterinarian_id || '';
    const veterinarianId = await resolveVeterinarianProfileId(connection, requestedVeterinarianId);
    if (!veterinarianId) {
      res.status(400).json({ message: 'veterinarianId is required' });
      return;
    }

    await connection.beginTransaction();
    const existing = await loadReviewByAppointmentId(connection, appointmentId);
    const reviewId = existing?.id ?? randomUUID();

    if (existing) {
      await connection.execute(
        `
          UPDATE reviews
          SET rating = ?, comment = ?, clinic_name = ?, updated_at = CURRENT_TIMESTAMP
          WHERE appointment_id = ?
        `,
        [rating, comment, asTrimmedString(body.clinicName) || appointment.clinic_name || null, appointmentId]
      );
    } else {
      await connection.execute(
        `
          INSERT INTO reviews (
            id,
            appointment_id,
            pet_id,
            tutor_id,
            veterinarian_id,
            clinic_name,
            rating,
            comment
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          reviewId,
          appointmentId,
          appointment.pet_id,
          tutorId,
          veterinarianId,
          asTrimmedString(body.clinicName) || appointment.clinic_name || null,
          rating,
          comment,
        ]
      );
    }

    await connection.commit();

    const created = await loadReviewById(pool, reviewId);
    if (!created) {
      res.status(500).json({ message: 'Review creation failed' });
      return;
    }

    res.status(existing ? 200 : 201).json({ data: normalizeReview(created) });
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
    const existing = await loadReviewById(connection, String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Review not found' });
      return;
    }

    const tutorId = await resolveCurrentTutorId(req.user);
    if (!tutorId || existing.tutor_id !== tutorId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const body = req.body ?? {};
    const assignments: string[] = [];
    const values: Array<string | number | null> = [];

    if (body.rating !== undefined) {
      const nextRating = Number(body.rating);
      if (!Number.isInteger(nextRating) || nextRating < 1 || nextRating > 5) {
        res.status(400).json({ message: 'rating must be between 1 and 5' });
        return;
      }
      assignments.push('rating = ?');
      values.push(nextRating);
    }

    if (body.comment !== undefined) {
      const nextComment = asTrimmedString(body.comment);
      if (!nextComment) {
        res.status(400).json({ message: 'comment cannot be empty' });
        return;
      }
      assignments.push('comment = ?');
      values.push(nextComment);
    }

    if (body.clinicName !== undefined) {
      assignments.push('clinic_name = ?');
      values.push(asTrimmedString(body.clinicName) || null);
    }

    if (assignments.length === 0) {
      res.status(400).json({ message: 'No fields provided to update' });
      return;
    }

    values.push(String(req.params.id));
    await connection.beginTransaction();
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE reviews SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    if ((result.affectedRows ?? 0) === 0) {
      await connection.rollback();
      res.status(404).json({ message: 'Review not found' });
      return;
    }

    await connection.commit();

    const updated = await loadReviewById(pool, String(req.params.id));
    if (!updated) {
      res.status(500).json({ message: 'Review update failed' });
      return;
    }

    res.json({ data: normalizeReview(updated) });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const existing = await loadReviewById(pool, String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Review not found' });
      return;
    }

    const tutorId = await resolveCurrentTutorId(req.user);
    if (!tutorId || existing.tutor_id !== tutorId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM reviews WHERE id = ?', [String(req.params.id)]);
    if ((result.affectedRows ?? 0) === 0) {
      res.status(404).json({ message: 'Review not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
