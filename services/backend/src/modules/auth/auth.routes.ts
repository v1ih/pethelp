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
import { createEmailCode, verifyEmailCode } from './email-codes.js';
import { codeEmailTemplate, isEmailConfigured, sendEmail } from '../mail/mailer.js';

const router = Router();

/** Sends a verification code to the given e-mail (best-effort). */
async function sendVerificationCode(email: string) {
  const code = await createEmailCode(email, 'verification');
  const { sent } = await sendEmail(
    email,
    'Confirme seu e-mail no PetHelp',
    codeEmailTemplate(
      'Confirme seu e-mail',
      'Use o código abaixo para confirmar seu e-mail e ativar todos os recursos da sua conta.',
      code,
      'O código expira em 15 minutos. Se você não criou uma conta no PetHelp, ignore este e-mail.'
    )
  );
  return { sent, code };
}

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

    // Envia o código de verificação de e-mail (não bloqueia o cadastro se falhar).
    let verificationSent = false;
    try {
      verificationSent = (await sendVerificationCode(email)).sent;
    } catch (mailError) {
      console.error('Falha ao enviar código de verificação:', mailError);
    }

    res.status(201).json({ id, token, userType, emailVerified: false, verificationSent });
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
    res.json({ id: user.id, token, userType: user.user_type, emailVerified: Boolean(user.email_verified) });
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

    const code = await createEmailCode(email, 'recovery');
    const { sent } = await sendEmail(
      email,
      'Código de recuperação de senha - PetHelp',
      codeEmailTemplate(
        'Recuperação de senha',
        'Recebemos um pedido para redefinir sua senha. Use o código abaixo para continuar.',
        code,
        'O código expira em 15 minutos. Se não foi você, pode ignorar este e-mail.'
      )
    );

    // Em produção (e-mail configurado) o código vai só por e-mail. Em desenvolvimento
    // (sem BREVO_API_KEY) devolvemos o código para não travar os testes.
    res.json({
      message: sent ? 'Enviamos um código para o seu e-mail.' : 'Código gerado (e-mail não configurado).',
      emailSent: sent,
      ...(isEmailConfigured() ? {} : { code }),
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

    const valid = await verifyEmailCode(email, 'recovery', code);
    if (!valid) {
      res.status(400).json({ message: 'Código inválido ou expirado.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await connection.beginTransaction();
    await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);
    await connection.commit();

    res.json({ message: 'Senha atualizada com sucesso.' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

// ---- Verificação de e-mail ----

router.post('/verify-email', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = asTrimmedString(req.body?.code);
    if (!email || !code) {
      res.status(400).json({ message: 'email and code are required' });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      res.status(404).json({ message: 'Conta não encontrada.' });
      return;
    }

    const valid = await verifyEmailCode(email, 'verification', code);
    if (!valid) {
      res.status(400).json({ message: 'Código inválido ou expirado.' });
      return;
    }

    await pool.execute('UPDATE users SET email_verified = TRUE WHERE id = ?', [user.id]);
    res.json({ message: 'E-mail verificado com sucesso.', emailVerified: true });
  } catch (error) {
    next(error);
  }
});

router.post('/resend-verification', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      res.status(400).json({ message: 'email is required' });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      res.status(404).json({ message: 'Conta não encontrada.' });
      return;
    }

    if (user.email_verified) {
      res.json({ message: 'E-mail já verificado.', emailVerified: true });
      return;
    }

    const { sent, code } = await sendVerificationCode(email);
    res.json({
      message: sent ? 'Enviamos um novo código para o seu e-mail.' : 'Código gerado (e-mail não configurado).',
      emailSent: sent,
      ...(isEmailConfigured() ? {} : { code }),
    });
  } catch (error) {
    next(error);
  }
});

export default router;


