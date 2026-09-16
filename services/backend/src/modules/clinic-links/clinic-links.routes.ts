import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { RowDataPacket } from '../../db/types.js';
import { pool } from '../../db/index.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { requireAuth } from '../../middlewares/auth.js';
import {
  findClinicByConnectionCode,
  findClinicByUserId,
  findUserByEmail,
  findVeterinarianByUserId,
} from '../users/users.service.js';

type ClinicVeterinarianRow = RowDataPacket & {
  id: string;
  clinic_id: string;
  veterinarian_id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_by: 'clinic' | 'veterinarian';
  created_at: Date;
  updated_at: Date;
};

const router = Router();

router.use(requireAuth);

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function getCurrentClinicId(user: AuthRequest['user']) {
  if (!user || user.userType !== 'clinic') {
    return null;
  }

  const clinic = await findClinicByUserId(user.id);
  return clinic?.id ?? null;
}

async function getCurrentVeterinarianId(user: AuthRequest['user']) {
  if (!user || user.userType !== 'veterinarian') {
    return null;
  }

  const veterinarian = await findVeterinarianByUserId(user.id);
  return veterinarian?.id ?? null;
}

async function loadClinicVeterinarianRows(whereClause: string, values: Array<string>) {
  const [rows] = await pool.query<
    Array<
      ClinicVeterinarianRow & {
        clinic_name: string;
        veterinarian_name: string;
        veterinarian_email: string;
        veterinarian_crmv: string;
        veterinarian_crmv_uf: string;
      }
    >
  >(
    `
      SELECT
        cv.*,
        c.trade_name AS clinic_name,
        v.name AS veterinarian_name,
        u.email AS veterinarian_email,
        v.crmv AS veterinarian_crmv,
        v.crmv_uf AS veterinarian_crmv_uf
      FROM clinic_veterinarians cv
      INNER JOIN clinics c ON c.id = cv.clinic_id
      INNER JOIN veterinarians v ON v.id = cv.veterinarian_id
      INNER JOIN users u ON u.id = v.user_id
      ${whereClause}
      ORDER BY cv.updated_at DESC
    `,
    values
  );

  return rows;
}

router.get('/me', async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.userType === 'clinic') {
      const clinicId = await getCurrentClinicId(req.user);
      if (!clinicId) {
        res.status(404).json({ message: 'Clinic profile not found' });
        return;
      }

      const rows = await loadClinicVeterinarianRows('WHERE cv.clinic_id = ?', [clinicId]);
      res.json({
        data: rows.map((row) => ({
          id: row.id,
          clinicId: row.clinic_id,
          veterinarianId: row.veterinarian_id,
          status: row.status,
          requestedBy: row.requested_by,
          clinicName: row.clinic_name,
          veterinarianName: row.veterinarian_name,
          veterinarianEmail: row.veterinarian_email,
          veterinarianCrmv: row.veterinarian_crmv,
          veterinarianCrmvUf: row.veterinarian_crmv_uf,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });
      return;
    }

    if (req.user?.userType === 'veterinarian') {
      const veterinarianId = await getCurrentVeterinarianId(req.user);
      if (!veterinarianId) {
        res.status(404).json({ message: 'Veterinarian profile not found' });
        return;
      }

      const rows = await loadClinicVeterinarianRows('WHERE cv.veterinarian_id = ?', [veterinarianId]);
      res.json({
        data: rows.map((row) => ({
          id: row.id,
          clinicId: row.clinic_id,
          veterinarianId: row.veterinarian_id,
          status: row.status,
          requestedBy: row.requested_by,
          clinicName: row.clinic_name,
          veterinarianName: row.veterinarian_name,
          veterinarianEmail: row.veterinarian_email,
          veterinarianCrmv: row.veterinarian_crmv,
          veterinarianCrmvUf: row.veterinarian_crmv_uf,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });
      return;
    }

    res.status(403).json({ message: 'Forbidden' });
  } catch (error) {
    next(error);
  }
});

router.post('/request', async (req: AuthRequest, res, next) => {
  try {
    const body = req.body ?? {};
    const requestedByClinic = req.user?.userType === 'clinic';
    const requestedByVeterinarian = req.user?.userType === 'veterinarian';

    let clinicId: string | null = null;
    let veterinarianId: string | null = null;
    let requestedBy: 'clinic' | 'veterinarian' | null = null;

    if (requestedByVeterinarian) {
      veterinarianId = await getCurrentVeterinarianId(req.user);
      const connectionCode = asTrimmedString(body.connectionCode).toUpperCase();
      if (!veterinarianId) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      if (!connectionCode) {
        res.status(400).json({ message: 'connectionCode is required' });
        return;
      }

      const clinic = await findClinicByConnectionCode(connectionCode);
      if (!clinic) {
        res.status(404).json({ message: 'Clinic not found' });
        return;
      }

      clinicId = clinic.id;
      requestedBy = 'veterinarian';
    } else if (requestedByClinic) {
      clinicId = await getCurrentClinicId(req.user);
      const veterinarianEmail = asTrimmedString(body.veterinarianEmail).toLowerCase();
      if (!clinicId) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      if (!veterinarianEmail) {
        res.status(400).json({ message: 'veterinarianEmail is required' });
        return;
      }

      const user = await findUserByEmail(veterinarianEmail);
      if (!user || user.user_type !== 'veterinarian') {
        res.status(404).json({ message: 'Veterinarian not found' });
        return;
      }

      const veterinarian = await findVeterinarianByUserId(user.id);
      if (!veterinarian) {
        res.status(404).json({ message: 'Veterinarian profile not found' });
        return;
      }

      veterinarianId = veterinarian.id;
      requestedBy = 'clinic';
    } else {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const [existingRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM clinic_veterinarians WHERE clinic_id = ? AND veterinarian_id = ? LIMIT 1',
      [clinicId, veterinarianId]
    );

    const existingId = existingRows[0]?.id ? String(existingRows[0].id) : null;
    if (existingId) {
      await pool.execute(
        `UPDATE clinic_veterinarians SET status = 'pending', requested_by = ? WHERE id = ?`,
        [requestedBy, existingId]
      );
    } else {
      await pool.execute(
        `
          INSERT INTO clinic_veterinarians (id, clinic_id, veterinarian_id, status, requested_by)
          VALUES (?, ?, ?, 'pending', ?)
        `,
        [randomUUID(), clinicId, veterinarianId, requestedBy]
      );
    }

    const rows = await loadClinicVeterinarianRows('WHERE cv.clinic_id = ? AND cv.veterinarian_id = ?', [clinicId, veterinarianId]);
    res.status(201).json({
      data: rows[0]
        ? {
            id: rows[0].id,
            clinicId: rows[0].clinic_id,
            veterinarianId: rows[0].veterinarian_id,
            status: rows[0].status,
            requestedBy: rows[0].requested_by,
            clinicName: rows[0].clinic_name,
            veterinarianName: rows[0].veterinarian_name,
            veterinarianEmail: rows[0].veterinarian_email,
            veterinarianCrmv: rows[0].veterinarian_crmv,
            veterinarianCrmvUf: rows[0].veterinarian_crmv_uf,
            createdAt: rows[0].created_at,
            updatedAt: rows[0].updated_at,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

async function updateClinicVeterinarianStatus(req: AuthRequest, res: any, next: any, status: 'approved' | 'rejected') {
  try {
    const clinicId = await getCurrentClinicId(req.user);
    if (!clinicId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const linkId = String(req.params.id);
    const [rows] = await pool.query<ClinicVeterinarianRow[]>(
      'SELECT * FROM clinic_veterinarians WHERE id = ? LIMIT 1',
      [linkId]
    );

    const link = rows[0];
    if (!link) {
      res.status(404).json({ message: 'Request not found' });
      return;
    }

    if (link.clinic_id !== clinicId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    await pool.execute('UPDATE clinic_veterinarians SET status = ? WHERE id = ?', [status, linkId]);

    const refreshed = await loadClinicVeterinarianRows('WHERE cv.id = ?', [linkId]);
    res.json({
      data: refreshed[0]
        ? {
            id: refreshed[0].id,
            clinicId: refreshed[0].clinic_id,
            veterinarianId: refreshed[0].veterinarian_id,
            status: refreshed[0].status,
            requestedBy: refreshed[0].requested_by,
            clinicName: refreshed[0].clinic_name,
            veterinarianName: refreshed[0].veterinarian_name,
            veterinarianEmail: refreshed[0].veterinarian_email,
            veterinarianCrmv: refreshed[0].veterinarian_crmv,
            veterinarianCrmvUf: refreshed[0].veterinarian_crmv_uf,
            createdAt: refreshed[0].created_at,
            updatedAt: refreshed[0].updated_at,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
}

router.post('/:id/approve', async (req, res, next) => {
  await updateClinicVeterinarianStatus(req, res, next, 'approved');
});

router.post('/:id/reject', async (req, res, next) => {
  await updateClinicVeterinarianStatus(req, res, next, 'rejected');
});

async function updateVeterinarianLinkStatus(req: AuthRequest, res: any, next: any, status: 'approved' | 'rejected') {
  try {
    const veterinarianId = await getCurrentVeterinarianId(req.user);
    if (!veterinarianId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const linkId = String(req.params.id);
    const [rows] = await pool.query<ClinicVeterinarianRow[]>(
      'SELECT * FROM clinic_veterinarians WHERE id = ? LIMIT 1',
      [linkId]
    );

    const link = rows[0];
    if (!link) {
      res.status(404).json({ message: 'Request not found' });
      return;
    }

    if (link.veterinarian_id !== veterinarianId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    await pool.execute('UPDATE clinic_veterinarians SET status = ? WHERE id = ?', [status, linkId]);

    const refreshed = await loadClinicVeterinarianRows('WHERE cv.id = ?', [linkId]);
    res.json({
      data: refreshed[0]
        ? {
            id: refreshed[0].id,
            clinicId: refreshed[0].clinic_id,
            veterinarianId: refreshed[0].veterinarian_id,
            status: refreshed[0].status,
            requestedBy: refreshed[0].requested_by,
            clinicName: refreshed[0].clinic_name,
            veterinarianName: refreshed[0].veterinarian_name,
            veterinarianEmail: refreshed[0].veterinarian_email,
            veterinarianCrmv: refreshed[0].veterinarian_crmv,
            veterinarianCrmvUf: refreshed[0].veterinarian_crmv_uf,
            createdAt: refreshed[0].created_at,
            updatedAt: refreshed[0].updated_at,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
}

router.post('/:id/accept', async (req, res, next) => {
  await updateVeterinarianLinkStatus(req, res, next, 'approved');
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const veterinarianId = await getCurrentVeterinarianId(req.user);
    const clinicId = await getCurrentClinicId(req.user);
    if (!veterinarianId && !clinicId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const linkId = String(req.params.id);
    const [rows] = await pool.query<ClinicVeterinarianRow[]>(
      'SELECT * FROM clinic_veterinarians WHERE id = ? LIMIT 1',
      [linkId]
    );

    const link = rows[0];
    if (!link) {
      res.status(404).json({ message: 'Request not found' });
      return;
    }

    if (veterinarianId && link.veterinarian_id !== veterinarianId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    if (clinicId && link.clinic_id !== clinicId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    await pool.execute('DELETE FROM clinic_veterinarians WHERE id = ?', [linkId]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
