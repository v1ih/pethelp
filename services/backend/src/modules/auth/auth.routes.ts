import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomInt } from 'node:crypto';
import { pool } from '../../db/index.js';
import { env } from '../../config/env.js';
import {
  createAuthUser,
  createClinicProfile,
  createTutorProfile,
  createVeterinarianProfile,
  findUserByEmail,
  type UserType,
} from '../users/users.service.js';

const router = Router();
const recoveryCodes = new Map<string, { code: string; expiresAt: number }>();

function normalizeUserType(value: unknown): UserType | null {
  if (value === 'tutor' || value === 'owner') {
    return 'tutor';
  }

  if (value === 'clinic') {
    return 'clinic';
  }

  if (value === 'veterinarian') {
    return 'veterinarian';
  }

  return null;
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value: unknown) {
  return asTrimmedString(value).toLowerCase();
}

function generateRecoveryCode() {
  return String(randomInt(100000, 1000000));
}

router.post('/register', async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const body = req.body ?? {};
    const email = asTrimmedString(body.email);
    const password = asTrimmedString(body.password);
    const userType = normalizeUserType(body.userType);
    const name = asTrimmedString(body.name);
    const phone = asTrimmedString(body.phone) || null;
    const cpf = asTrimmedString(body.cpf) || null;
    const tradeName = asTrimmedString(body.tradeName) || asTrimmedString(body.clinicName) || name;
    const corporateName = asTrimmedString(body.corporateName) || null;
    const cnpj = asTrimmedString(body.cnpj) || null;
    const address = asTrimmedString(body.address) || null;
    const connectionCode = asTrimmedString(body.connectionCode) || asTrimmedString(body.connection_code) || null;
    const services = Array.isArray(body.services)
      ? JSON.stringify(body.services.map((service: unknown) => asTrimmedString(service)).filter(Boolean))
      : asTrimmedString(body.services) || null;
    const workingHours = body.workingHours !== undefined
      ? JSON.stringify(body.workingHours)
      : body.working_hours !== undefined
        ? JSON.stringify(body.working_hours)
        : null;
    const crmv = asTrimmedString(body.crmv) || null;
    const crmvUf = (asTrimmedString(body.crmvUf) || asTrimmedString(body.crmv_uf) || '').toUpperCase() || null;
    const specialty = asTrimmedString(body.specialty) || null;

    if (!email || !password || !userType) {
      res.status(400).json({ message: 'email, password and userType are required' });
      return;
    }

    if (userType === 'tutor' && !name) {
      res.status(400).json({ message: 'name is required for tutor registration' });
      return;
    }

    if (userType === 'clinic' && !tradeName) {
      res.status(400).json({ message: 'tradeName or clinicName is required for clinic registration' });
      return;
    }

    if (userType === 'veterinarian' && (!name || !crmv || !crmvUf)) {
      res.status(400).json({ message: 'name, crmv and crmvUf are required for veterinarian registration' });
      return;
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(409).json({ message: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await connection.beginTransaction();

    const id = await createAuthUser(
      {
        email,
        password_hash: passwordHash,
        user_type: userType,
      },
      connection
    );

    if (userType === 'tutor') {
      await createTutorProfile(
        id,
        {
          name,
          phone,
          cpf,
        },
        connection
      );
    } else if (userType === 'clinic') {
      await createClinicProfile(
        id,
        {
          trade_name: tradeName,
          corporate_name: corporateName,
          cnpj,
          phone,
          address,
          connection_code: connectionCode,
          services,
          working_hours: workingHours,
        },
        connection
      );
    } else {
      await createVeterinarianProfile(
        id,
        {
          name,
          crmv: crmv ?? '',
          crmv_uf: crmvUf ?? '',
          specialty,
          phone,
        },
        connection
      );
    }

    await connection.commit();

    const token = jwt.sign({ sub: id, email, userType }, env.jwtSecret, { expiresIn: '7d' });

    res.status(201).json({ id, token, userType });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ message: 'email and password are required' });
      return;
    }

    const user = await findUserByEmail(String(email));
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ message: 'Account is inactive' });
      return;
    }

    const match = await bcrypt.compare(String(password), user.password_hash);
    if (!match) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign({ sub: user.id, email: user.email, userType: user.user_type }, env.jwtSecret, {
      expiresIn: '7d',
    });
    res.json({ id: user.id, token, userType: user.user_type });
  } catch (error) {
    next(error);
  }
});

router.post('/password-recovery/request', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      res.status(400).json({ message: 'email is required' });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const code = generateRecoveryCode();
    recoveryCodes.set(email, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    res.json({
      message: 'Recovery code generated',
      code,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/password-recovery/confirm', async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const email = normalizeEmail(req.body?.email);
    const code = asTrimmedString(req.body?.code);
    const newPassword = asTrimmedString(req.body?.newPassword);

    if (!email || !code || !newPassword) {
      res.status(400).json({ message: 'email, code and newPassword are required' });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const recovery = recoveryCodes.get(email);
    if (!recovery) {
      res.status(400).json({ message: 'Recovery code not requested' });
      return;
    }

    if (recovery.expiresAt < Date.now()) {
      recoveryCodes.delete(email);
      res.status(410).json({ message: 'Recovery code expired' });
      return;
    }

    if (recovery.code !== code) {
      res.status(400).json({ message: 'Invalid recovery code' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await connection.beginTransaction();
    await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);
    await connection.commit();
    recoveryCodes.delete(email);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

export default router;


