import { Router } from 'express';
import { pool } from '../../db/index.js';
import { requireAuth, type AuthRequest } from '../../middlewares/auth.js';
import {
  deleteUserProfile,
  getUserProfileByEmail,
  getUserProfileById,
  listClinicProfiles,
  listTutorProfiles,
  listVeterinarianProfiles,
  updateClinicProfile,
  updateVeterinarianProfile,
  updateTutorProfile,
} from './users.service.js';

const router = Router();

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

router.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.userType !== 'tutor') {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const user = await getUserProfileById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.get('/by-email/:email', async (req, res, next) => {
  try {
    const user = await getUserProfileByEmail(req.params.email);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.get('/tutors', requireAuth, async (_req, res, next) => {
  try {
    const tutors = await listTutorProfiles();
    res.json({ data: tutors });
  } catch (err) {
    next(err);
  }
});

router.get('/catalog', requireAuth, async (req, res, next) => {
  try {
    const type = asTrimmedString(req.query.type).toLowerCase();
    const query = asTrimmedString(req.query.query);
    const specialty = asTrimmedString(req.query.specialty);
    const clinicId = asTrimmedString(req.query.clinicId);

    const shouldLoadClinics = type === '' || type === 'clinic' || type === 'all';
    const shouldLoadVeterinarians = type === '' || type === 'veterinarian' || type === 'all';

    const [clinics, veterinarians] = await Promise.all([
      shouldLoadClinics ? listClinicProfiles(query) : Promise.resolve([]),
      shouldLoadVeterinarians ? listVeterinarianProfiles(query, specialty, clinicId) : Promise.resolve([]),
    ]);

    res.json({
      data: [
        ...clinics.map((clinic) => ({
          id: clinic.id,
          type: 'clinic' as const,
          name: clinic.trade_name || clinic.name,
          clinicName: clinic.trade_name || clinic.name,
          connectionCode: clinic.connection_code,
          address: clinic.address,
          services: clinic.services,
          workingHours: clinic.working_hours,
        })),
        ...veterinarians.map((veterinarian) => ({
          id: veterinarian.id,
          type: 'veterinarian' as const,
          name: veterinarian.name,
          specialty: veterinarian.specialty,
          crmv: veterinarian.crmv,
          crmvUf: veterinarian.crmv_uf,
          clinicName: veterinarian.clinic_name ?? undefined,
        })),
      ],
    });
  } catch (err) {
    next(err);
  }
});

async function updateTutorProfileHandler(req: AuthRequest, res: any, next: any, userId: string) {
  const connection = await pool.getConnection();

  try {
    if (req.user?.userType !== 'tutor' || req.user.id !== userId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const body = req.body ?? {};
    const name = asTrimmedString(body.name);
    const phone = asTrimmedString(body.phone) || null;
    const cpf = asTrimmedString(body.cpf) || null;

    if (!name && body.phone === undefined && body.cpf === undefined) {
      res.status(400).json({ message: 'No fields provided to update' });
      return;
    }

    if (body.email !== undefined) {
      res.status(400).json({ message: 'Email cannot be updated' });
      return;
    }

    await connection.beginTransaction();

    await updateTutorProfile(
      userId,
      {
        name: name || undefined,
        phone: body.phone === undefined ? undefined : phone,
        cpf: body.cpf === undefined ? undefined : cpf,
      },
      connection
    );

    await connection.commit();

    const updated = await getUserProfileById(userId);
    if (!updated) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ data: updated });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

router.get('/:id', async (req, res, next) => {
  try {
    const user = await getUserProfileById(req.params.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.patch('/me', requireAuth, async (req: AuthRequest, res, next) => {
  await updateTutorProfileHandler(req, res, next, req.user?.id ?? '');
});

router.get('/clinic/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.userType !== 'clinic') {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const user = await getUserProfileById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.patch('/clinic/me', requireAuth, async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    if (req.user?.userType !== 'clinic') {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const body = req.body ?? {};
    const tradeName = asTrimmedString(body.tradeName) || asTrimmedString(body.trade_name);
    const corporateName = body.corporateName !== undefined ? asTrimmedString(body.corporateName) || null : undefined;
    const cnpj = body.cnpj !== undefined ? asTrimmedString(body.cnpj) || null : undefined;
    const phone = body.phone !== undefined ? asTrimmedString(body.phone) || null : undefined;
    const address = asTrimmedString(body.address);
    const services = body.services !== undefined
      ? Array.isArray(body.services)
        ? JSON.stringify(body.services.map((service: unknown) => asTrimmedString(service)).filter(Boolean))
        : asTrimmedString(body.services) || null
      : undefined;
    const workingHours = body.workingHours !== undefined
      ? JSON.stringify(body.workingHours)
      : body.working_hours !== undefined
        ? JSON.stringify(body.working_hours)
        : undefined;

    if (!tradeName && body.corporateName === undefined && body.cnpj === undefined && body.phone === undefined && !address && body.services === undefined && workingHours === undefined) {
      res.status(400).json({ message: 'No fields provided to update' });
      return;
    }

    await connection.beginTransaction();
    await updateClinicProfile(
      req.user.id,
      {
        trade_name: tradeName || undefined,
        corporate_name: corporateName,
        cnpj,
        phone,
        address: address || undefined,
        services,
        working_hours: workingHours,
      },
      connection
    );
    await connection.commit();

    const updated = await getUserProfileById(req.user.id);
    if (!updated) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ data: updated });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

router.get('/veterinarian/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.userType !== 'veterinarian') {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const user = await getUserProfileById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

router.patch('/veterinarian/me', requireAuth, async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    if (req.user?.userType !== 'veterinarian') {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const body = req.body ?? {};
    const name = asTrimmedString(body.name);
    const email = asTrimmedString(body.email).toLowerCase();
    const crmv = asTrimmedString(body.crmv);
    const crmvUf = asTrimmedString(body.crmvUf || body.crmv_uf).toUpperCase();
    const specialty = body.specialty !== undefined ? asTrimmedString(body.specialty) || null : undefined;
    const phone = body.phone !== undefined ? asTrimmedString(body.phone) || null : undefined;

    if (!name && !email && !crmv && !crmvUf && body.specialty === undefined && body.phone === undefined) {
      res.status(400).json({ message: 'No fields provided to update' });
      return;
    }

    await connection.beginTransaction();
    await updateVeterinarianProfile(
      req.user.id,
      {
        name: name || undefined,
        email: email || undefined,
        crmv: crmv || undefined,
        crmv_uf: crmvUf || undefined,
        specialty,
        phone,
      },
      connection
    );
    await connection.commit();

    const updated = await getUserProfileById(req.user.id);
    if (!updated) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ data: updated });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
});

router.patch('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  await updateTutorProfileHandler(req, res, next, String(req.params.id));
});

async function deactivateCurrentUserHandler(req: AuthRequest, res: any, next: any, userId: string) {
  const connection = await pool.getConnection();

  try {
    if (!req.user || req.user.id !== userId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    await connection.beginTransaction();
    await connection.execute('UPDATE users SET is_active = FALSE WHERE id = ?', [userId]);
    await connection.commit();
    res.status(204).send();
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

async function deleteCurrentUserHandler(req: AuthRequest, res: any, next: any, userId: string) {
  const connection = await pool.getConnection();

  try {
    if (!req.user || req.user.id !== userId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    await connection.beginTransaction();
    await deleteUserProfile(userId, connection);
    await connection.commit();
    res.status(204).send();
  } catch (err: any) {
    await connection.rollback();
    if (err?.code === 'ER_ROW_IS_REFERENCED_2') {
      res.status(409).json({
        message: 'Cannot delete account while it is referenced by other records',
      });
      return;
    }

    next(err);
  } finally {
    connection.release();
  }
}

router.patch('/me/deactivate', requireAuth, async (req: AuthRequest, res, next) => {
  await deactivateCurrentUserHandler(req, res, next, req.user?.id ?? '');
});

router.delete('/me', requireAuth, async (req: AuthRequest, res, next) => {
  await deleteCurrentUserHandler(req, res, next, req.user?.id ?? '');
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  await deleteCurrentUserHandler(req, res, next, String(req.params.id));
});

export default router;


