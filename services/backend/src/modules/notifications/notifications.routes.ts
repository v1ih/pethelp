import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from '../../db/types.js';
import { pool } from '../../db/index.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { requireAuth } from '../../middlewares/auth.js';
import { findClinicByUserId, findTutorByUserId, findVeterinarianByUserId } from '../users/users.service.js';

type NotificationRow = RowDataPacket & {
  id: string;
  user_id: string;
  pet_id: string | null;
  appointment_id: string | null;
  source_key: string | null;
  type: 'vaccine' | 'appointment' | 'connection' | 'referral';
  title: string;
  message: string;
  notification_date: Date | string;
  read_at: Date | string | null;
  created_at: Date;
  updated_at: Date;
};

type DbClient = Pick<PoolConnection, 'execute' | 'query'>;

const router = Router();

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatDate(value: Date | string) {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
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

function normalizeNotification(row: NotificationRow) {
  return {
    id: row.id,
    userId: row.user_id,
    petId: row.pet_id ?? undefined,
    appointmentId: row.appointment_id ?? undefined,
    sourceKey: row.source_key ?? undefined,
    type: row.type,
    title: row.title,
    message: row.message,
    date: formatDate(row.notification_date),
    read: row.read_at !== null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadNotificationById(db: DbClient, id: string) {
  const [rows] = await db.query<NotificationRow[]>(
    `
      SELECT
        id,
        user_id,
        pet_id,
        appointment_id,
        source_key,
        type,
        title,
        message,
        notification_date,
        read_at,
        created_at,
        updated_at
      FROM notifications
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] ?? null;
}

async function resolveTargetUserId(user: AuthRequest['user']) {
  if (!user) return null;
  if (user.userType === 'tutor') return user.id;
  if (user.userType === 'clinic') return user.id;
  if (user.userType === 'veterinarian') return user.id;
  return null;
}

/** Resolves tutor profile ids used by appointments to their authenticated user. */
async function resolveRecipientUserId(req: AuthRequest, body: Record<string, unknown>) {
  const actor = req.user;
  if (!actor) return null;
  const ownUserId = await resolveTargetUserId(req.user);
  const requestedId = asTrimmedString(body.userId);

  if (!ownUserId || !requestedId || requestedId === ownUserId) return ownUserId;

  const appointmentId = asTrimmedString(body.appointmentId);
  if (!appointmentId || (actor.userType !== 'clinic' && actor.userType !== 'veterinarian')) return null;

  const [tutorRows] = await pool.query<RowDataPacket[]>('SELECT id, user_id FROM tutors WHERE id = ? LIMIT 1', [requestedId]);
  const tutor = tutorRows[0] as { id: string; user_id: string } | undefined;
  if (!tutor) return null;

  const [appointmentRows] = await pool.query<RowDataPacket[]>(
    'SELECT tutor_id, clinic_id, veterinarian_id FROM appointments WHERE id = ? LIMIT 1',
    [appointmentId]
  );
  const appointment = appointmentRows[0] as { tutor_id: string; clinic_id: string | null; veterinarian_id: string | null } | undefined;
  if (!appointment || appointment.tutor_id !== tutor.id) return null;

  if (actor.userType === 'clinic') {
    const clinic = await findClinicByUserId(actor.id);
    return clinic?.id === appointment.clinic_id ? tutor.user_id : null;
  }

  const veterinarian = await findVeterinarianByUserId(actor.id);
  return veterinarian?.id === appointment.veterinarian_id ? tutor.user_id : null;
}

router.use(requireAuth);

router.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const userId = await resolveTargetUserId(req.user);
    if (!userId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const [rows] = await pool.query<NotificationRow[]>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY notification_date DESC, created_at DESC',
      [userId]
    );

    res.json({ data: rows.map(normalizeNotification) });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    const body = req.body ?? {};
    const userId = (await resolveRecipientUserId(req, body)) || '';
    const type = asTrimmedString(body.type) as NotificationRow['type'];
    const title = asTrimmedString(body.title);
    const message = asTrimmedString(body.message);
    const notificationDate = asTrimmedString(body.date ?? body.notificationDate) || new Date().toISOString().slice(0, 10);

    if (!userId || !type || !title || !message) {
      res.status(400).json({ message: 'A valid recipient, type, title and message are required' });
      return;
    }

    await connection.beginTransaction();

    const sourceKey = asTrimmedString(body.sourceKey) || null;
    if (sourceKey) {
      const [existingRows] = await connection.query<NotificationRow[]>(
        `
          SELECT
            id,
            user_id,
            pet_id,
            appointment_id,
            source_key,
            type,
            title,
            message,
            notification_date,
            read_at,
            created_at,
            updated_at
          FROM notifications
          WHERE user_id = ? AND source_key = ?
          LIMIT 1
        `,
        [userId, sourceKey]
      );

      const existing = existingRows[0] ?? null;
      if (existing) {
        await connection.commit();
        res.status(200).json({ data: normalizeNotification(existing) });
        return;
      }
    }

    const id = randomUUID();
    await connection.execute(
      `
        INSERT INTO notifications (
          id,
          user_id,
          pet_id,
          appointment_id,
          source_key,
          type,
          title,
          message,
          notification_date,
          read_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        userId,
        asTrimmedString(body.petId) || null,
        asTrimmedString(body.appointmentId) || null,
        sourceKey,
        type,
        title,
        message,
        notificationDate,
        body.read ? new Date() : null,
      ]
    );
    await connection.commit();

    const created = await loadNotificationById(pool, id);
    if (!created) {
      res.status(500).json({ message: 'Notification creation failed' });
      return;
    }

    res.status(201).json({ data: normalizeNotification(created) });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.patch('/:id/read', async (req: AuthRequest, res, next) => {
  try {
    const existing = await loadNotificationById(pool, String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    const userId = await resolveTargetUserId(req.user);
    if (!userId || existing.user_id !== userId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    await pool.execute('UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = ?', [
      String(req.params.id),
    ]);

    const updated = await loadNotificationById(pool, String(req.params.id));
    if (!updated) {
      res.status(500).json({ message: 'Notification update failed' });
      return;
    }

    res.json({ data: normalizeNotification(updated) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const existing = await loadNotificationById(pool, String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    const userId = await resolveTargetUserId(req.user);
    if (!userId || existing.user_id !== userId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM notifications WHERE id = ?', [
      String(req.params.id),
    ]);

    if ((result.affectedRows ?? 0) === 0) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
