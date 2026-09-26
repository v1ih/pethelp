import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { pool } from '../../db/index.js';
import type { RowDataPacket } from '../../db/types.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { requireAuth } from '../../middlewares/auth.js';
import {
  createAuthUser,
  createTutorProfile,
  findClinicByUserId,
  findTutorByUserId,
  findUserByEmail,
} from '../users/users.service.js';
import { createEmailCode, normalizeEmail } from '../auth/email-codes.js';
import { codeEmailTemplate, isEmailConfigured, sendEmail } from '../mail/mailer.js';

/**
 * Cadastro feito pela clínica: a clínica registra o pet (e, se preciso, cria o acesso do
 * responsável) e o PetHelp entrega as informações ao responsável — por e-mail, por
 * notificação no app e, quando a conta é nova, com um código para ele definir a senha.
 */
const router = Router();

router.use(requireAuth);

// O convite vale 7 dias: o responsável costuma abrir o e-mail bem depois da consulta.
const INVITE_TTL_MINUTES = 7 * 24 * 60;

// Validade do Vet-Pass criado junto com o cadastro (o responsável pode encerrar antes).
const VET_PASS_DAYS = 90;

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNullableString(value: unknown) {
  const trimmed = asTrimmedString(value);
  return trimmed ? trimmed : null;
}

function asStringListJson(value: unknown) {
  if (Array.isArray(value)) {
    const items = value.map((item) => asTrimmedString(item)).filter(Boolean);
    return items.length ? JSON.stringify(items) : null;
  }

  const trimmed = asTrimmedString(value);
  if (!trimmed) return null;

  const items = trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? JSON.stringify(items) : null;
}

function asNullableBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = asTrimmedString(value).toLowerCase();
  if (['true', '1', 'sim', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'nao', 'não', 'no'].includes(normalized)) return false;
  return null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** E-mail com o resumo do que a clínica cadastrou, para o responsável conferir. */
function petSummaryEmailTemplate(options: {
  tutorName: string;
  clinicName: string;
  petLines: Array<[string, string]>;
  isNewAccount: boolean;
  email: string;
  vetPassCode: string;
  vetPassExpiresAt: Date;
}) {
  const rows = options.petLines
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding: 6px 12px; color: #5f6a64; font-size: 14px;">${escapeHtml(label)}</td>
        <td style="padding: 6px 12px; font-size: 14px; text-align: right;"><strong>${escapeHtml(value)}</strong></td>
      </tr>`
    )
    .join('');

  const accessBlock = options.isNewAccount
    ? `<p style="margin: 16px 0 0; font-size: 14px; color: #5f6a64;">
         Criamos um acesso para você com o e-mail <strong>${escapeHtml(options.email)}</strong>.
         Enviamos em outra mensagem o código para você definir sua senha e entrar.
       </p>`
    : `<p style="margin: 16px 0 0; font-size: 14px; color: #5f6a64;">
         Entre no PetHelp com o e-mail <strong>${escapeHtml(options.email)}</strong> para ver e completar as informações.
       </p>`;

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1b2320;">
    <div style="background: #1f7a63; color: #fff; padding: 20px 24px; border-radius: 16px 16px 0 0;">
      <h1 style="margin: 0; font-size: 20px;">🐾 PetHelp</h1>
    </div>
    <div style="border: 1px solid #e5e1d6; border-top: none; border-radius: 0 0 16px 16px; padding: 24px;">
      <h2 style="margin: 0 0 12px; font-size: 18px;">Cadastro feito pela clínica</h2>
      <p style="margin: 0 0 16px; color: #5f6a64;">
        Olá, ${escapeHtml(options.tutorName)}! A clínica <strong>${escapeHtml(options.clinicName)}</strong>
        cadastrou os dados do seu pet no PetHelp. Confira abaixo:
      </p>
      <table style="width: 100%; border-collapse: collapse; background: #f6f8f6; border-radius: 12px;">
        ${rows}
      </table>
      ${accessBlock}
      <div style="margin: 20px 0 0; border: 1px solid #d8e6df; background: #f2f8f5; border-radius: 12px; padding: 16px;">
        <p style="margin: 0 0 8px; font-size: 14px;"><strong>Compartilhamento com a clínica</strong></p>
        <p style="margin: 0 0 10px; font-size: 14px; color: #5f6a64;">
          Os dados de ${escapeHtml(options.petLines[0]?.[1] ?? 'seu pet')} estão sendo compartilhados com
          <strong>${escapeHtml(options.clinicName)}</strong> por meio de um Vet-Pass, para que a clínica possa
          acompanhar prontuário, vacinas e exames.
        </p>
        <p style="margin: 0 0 10px; font-size: 14px; color: #5f6a64;">
          Código do Vet-Pass: <strong style="font-family: monospace;">${escapeHtml(options.vetPassCode)}</strong><br />
          Válido até ${options.vetPassExpiresAt.toLocaleDateString('pt-BR')}.
        </p>
        <p style="margin: 0; font-size: 14px; color: #5f6a64;">
          No app, em <strong>Compartilhamentos</strong>, você acompanha esse Vet-Pass a qualquer momento e pode
          <strong>encerrá-lo quando quiser</strong>.
        </p>
      </div>
      <p style="margin: 16px 0 0; font-size: 13px; color: #5f6a64;">
        Se algum dado estiver errado, você mesmo pode corrigir no app. Não reconhece esta clínica? Encerre o
        Vet-Pass em Compartilhamentos e fale com a clínica.
      </p>
    </div>
  </div>`;
}

function parseList(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : null;
  } catch {
    return null;
  }
}

function formatDay(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/** Pets que ESTA clínica cadastrou, com os dados do responsável e o Vet-Pass do cadastro. */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.userType !== 'clinic') {
      res.status(403).json({ message: 'Apenas clínicas podem ver esta lista.' });
      return;
    }

    const clinic = await findClinicByUserId(req.user.id);
    if (!clinic) {
      res.status(404).json({ message: 'Perfil da clínica não encontrado.' });
      return;
    }

    const search = asTrimmedString(req.query.q).toLowerCase();

    const [rows] = await pool.query<RowDataPacket[]>(
      `
        SELECT
          p.id, p.name, p.species, p.breed, p.age, p.weight, p.sex, p.neutered, p.photo,
          p.allergies, p.conditions, p.is_active, p.created_at, p.linked_clinic_id,
          t.id AS tutor_id, t.name AS tutor_name, t.phone AS tutor_phone,
          u.email AS tutor_email, u.email_verified AS tutor_email_verified,
          vp.pass_code, vp.expires_at AS pass_expires_at
        FROM pets p
        LEFT JOIN tutors t ON t.id = p.current_tutor_id
        LEFT JOIN users u ON u.id = t.user_id
        LEFT JOIN LATERAL (
          SELECT pass_code, expires_at
          FROM vet_passes
          WHERE pet_id = p.id AND redeemed_by_user_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        ) vp ON TRUE
        WHERE p.registered_by_clinic_id = ?
          AND (
            ? = ''
            OR LOWER(p.name) LIKE ?
            OR LOWER(COALESCE(t.name, '')) LIKE ?
            OR LOWER(COALESCE(u.email, '')) LIKE ?
          )
        ORDER BY p.created_at DESC
        LIMIT 200
      `,
      [req.user.id, clinic.id, search, `%${search}%`, `%${search}%`, `%${search}%`]
    );

    res.json({
      data: rows.map((row) => {
        const passExpiresAt = row.pass_expires_at ? new Date(row.pass_expires_at as string) : null;
        return {
          id: String(row.id),
          name: row.name,
          species: row.species,
          breed: row.breed ?? null,
          age: row.age ?? null,
          weight: row.weight ?? null,
          sex: row.sex ?? null,
          neutered: typeof row.neutered === 'boolean' ? row.neutered : null,
          photo: row.photo ?? null,
          allergies: parseList(row.allergies),
          conditions: parseList(row.conditions),
          isActive: Boolean(row.is_active),
          registeredAt: formatDay(row.created_at),
          // A clínica perde o acesso pelo vínculo se o responsável desvincular o pet.
          stillLinked: row.linked_clinic_id === clinic.id,
          tutor: {
            id: row.tutor_id ? String(row.tutor_id) : null,
            name: row.tutor_name ?? null,
            email: row.tutor_email ?? null,
            phone: row.tutor_phone ?? null,
            emailVerified: Boolean(row.tutor_email_verified),
          },
          vetPass: row.pass_code
            ? {
                code: String(row.pass_code),
                expiresAt: passExpiresAt ? passExpiresAt.toISOString() : null,
                active: passExpiresAt ? passExpiresAt.getTime() > Date.now() : false,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();
  let transactionOpen = false;

  try {
    if (req.user?.userType !== 'clinic') {
      res.status(403).json({ message: 'Apenas clínicas podem usar este cadastro.' });
      return;
    }

    const clinic = await findClinicByUserId(req.user.id);
    if (!clinic) {
      res.status(404).json({ message: 'Perfil da clínica não encontrado.' });
      return;
    }

    const body = req.body ?? {};
    const tutorBody = (body.tutor ?? {}) as Record<string, unknown>;
    const petBody = (body.pet ?? {}) as Record<string, unknown>;

    const tutorName = asTrimmedString(tutorBody.name);
    const tutorEmail = normalizeEmail(asTrimmedString(tutorBody.email));
    const tutorPhone = asNullableString(tutorBody.phone);
    const tutorCpf = asNullableString(tutorBody.cpf);

    const petName = asTrimmedString(petBody.name);
    const petSpecies = asTrimmedString(petBody.species);

    if (!tutorName || !tutorEmail) {
      res.status(400).json({ message: 'Informe o nome e o e-mail do responsável.' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tutorEmail)) {
      res.status(400).json({ message: 'Informe um e-mail válido para o responsável.' });
      return;
    }

    if (!petName || !petSpecies) {
      res.status(400).json({ message: 'Informe o nome e a espécie do pet.' });
      return;
    }

    const existingUser = await findUserByEmail(tutorEmail);
    if (existingUser && existingUser.user_type !== 'tutor') {
      res.status(409).json({
        message: 'Este e-mail já pertence a uma conta de clínica ou veterinário. Use o e-mail pessoal do responsável.',
      });
      return;
    }

    const isNewAccount = !existingUser;

    await connection.beginTransaction();
    transactionOpen = true;

    let tutorUserId: string;
    let tutorProfileId: string;
    let tutorDisplayName = tutorName;

    if (existingUser) {
      const existingTutor = await findTutorByUserId(existingUser.id, connection);
      if (!existingTutor) {
        await connection.rollback();
        transactionOpen = false;
        res.status(409).json({ message: 'A conta deste e-mail está incompleta. Peça ao responsável para acessar o app.' });
        return;
      }

      tutorUserId = existingUser.id;
      tutorProfileId = existingTutor.id;
      tutorDisplayName = existingTutor.name || tutorName;
    } else {
      // Senha aleatória inutilizável: o responsável define a dele com o código do convite.
      const placeholderPassword = await bcrypt.hash(randomUUID(), 10);
      tutorUserId = await createAuthUser(
        { email: tutorEmail, password_hash: placeholderPassword, user_type: 'tutor' },
        connection
      );
      tutorProfileId = await createTutorProfile(
        tutorUserId,
        { name: tutorName, phone: tutorPhone, cpf: tutorCpf },
        connection
      );
    }

    const petId = randomUUID();
    await connection.execute(
      `
        INSERT INTO pets (
          id, current_tutor_id, linked_clinic_id, registered_by_clinic_id, name, species, breed, age, weight, photo,
          allergies, conditions, sex, neutered
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        petId,
        tutorProfileId,
        clinic.id,
        clinic.id,
        petName,
        petSpecies,
        asNullableString(petBody.breed),
        asNullableString(petBody.age),
        asNullableString(petBody.weight),
        typeof petBody.photo === 'string' && petBody.photo ? petBody.photo : null,
        asStringListJson(petBody.allergies),
        asStringListJson(petBody.conditions),
        asNullableString(petBody.sex),
        asNullableBoolean(petBody.neutered),
      ]
    );

    // Vet-Pass já em uso pela clínica: o responsável enxerga esse compartilhamento em
    // "Compartilhamentos" e pode encerrá-lo quando quiser.
    const vetPassCode = `VET-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
    const vetPassExpiresAt = new Date(Date.now() + VET_PASS_DAYS * 24 * 60 * 60 * 1000);
    await connection.execute(
      `
        INSERT INTO vet_passes (
          id, pass_code, tutor_id, pet_id, pet_name, documents, redeemed_by_user_id,
          expires_at, redeemed_at, includes_medical_records, includes_vaccines, includes_exams
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, TRUE, TRUE, TRUE)
      `,
      [randomUUID(), vetPassCode, tutorProfileId, petId, petName, '[]', req.user.id, vetPassExpiresAt]
    );

    await connection.execute(
      `
        INSERT INTO notifications (id, user_id, pet_id, source_key, type, title, message, notification_date)
        VALUES (?, ?, ?, ?, 'connection', ?, ?, CURRENT_DATE)
      `,
      [
        randomUUID(),
        tutorUserId,
        petId,
        `clinic-registration:${petId}`,
        'Cadastro feito pela clínica',
        `A clínica ${clinic.trade_name} cadastrou ${petName} no seu perfil. Confira e complete os dados quando quiser.`,
      ]
    );

    await connection.commit();
    transactionOpen = false;

    // Fora da transação: e-mail e código de acesso não devem derrubar o cadastro.
    const petLines: Array<[string, string]> = [['Pet', petName], ['Espécie', petSpecies]];
    const breed = asNullableString(petBody.breed);
    const age = asNullableString(petBody.age);
    const weight = asNullableString(petBody.weight);
    const sex = asNullableString(petBody.sex);
    const neutered = asNullableBoolean(petBody.neutered);
    if (breed) petLines.push(['Raça', breed]);
    if (age) petLines.push(['Idade', age]);
    if (weight) petLines.push(['Peso', weight]);
    if (sex) petLines.push(['Sexo', sex]);
    if (neutered !== null) petLines.push(['Castrado(a)', neutered ? 'Sim' : 'Não']);
    petLines.push(['Clínica', clinic.trade_name]);

    let summarySent = false;
    let inviteSent = false;
    let accessCode: string | null = null;

    try {
      const summary = await sendEmail(
        tutorEmail,
        `${petName} foi cadastrado no PetHelp por ${clinic.trade_name}`,
        petSummaryEmailTemplate({
          tutorName: tutorDisplayName,
          clinicName: clinic.trade_name,
          petLines,
          isNewAccount,
          email: tutorEmail,
          vetPassCode,
          vetPassExpiresAt,
        })
      );
      summarySent = summary.sent;
    } catch (mailError) {
      console.error('Falha ao enviar resumo do cadastro ao responsável:', mailError);
    }

    if (isNewAccount) {
      try {
        // Reutiliza o fluxo de recuperação de senha: o código serve para o responsável
        // definir a primeira senha em "Esqueci minha senha".
        const code = await createEmailCode(tutorEmail, 'recovery', INVITE_TTL_MINUTES);
        const invite = await sendEmail(
          tutorEmail,
          'Seu acesso ao PetHelp',
          codeEmailTemplate(
            'Defina sua senha do PetHelp',
            `A clínica ${escapeHtml(clinic.trade_name)} criou seu acesso. Na tela de login, use "Esqueci minha senha" com o código abaixo para definir sua senha.`,
            code,
            'O código expira em 7 dias. Se não reconhece esta clínica, ignore este e-mail.'
          )
        );
        inviteSent = invite.sent;
        // Sem e-mail configurado, a clínica repassa o código ao responsável na hora.
        if (!isEmailConfigured()) {
          accessCode = code;
        }
      } catch (mailError) {
        console.error('Falha ao enviar convite de acesso ao responsável:', mailError);
      }
    }

    res.status(201).json({
      data: {
        petId,
        petName,
        tutor: {
          id: tutorProfileId,
          userId: tutorUserId,
          name: tutorDisplayName,
          email: tutorEmail,
          isNewAccount,
        },
        vetPass: {
          code: vetPassCode,
          expiresAt: vetPassExpiresAt.toISOString(),
        },
        summaryEmailSent: summarySent,
        inviteEmailSent: inviteSent,
        emailConfigured: isEmailConfigured(),
        ...(accessCode ? { accessCode } : {}),
      },
    });
  } catch (error) {
    if (transactionOpen) {
      await connection.rollback();
    }

    // 23505 = unique_violation. O caso comum é CPF já usado por outro responsável.
    if ((error as { code?: string })?.code === '23505') {
      res.status(409).json({
        message: 'Já existe um responsável com esse CPF ou e-mail. Confira os dados ou deixe o CPF em branco.',
      });
      return;
    }

    next(error);
  } finally {
    connection.release();
  }
});

export default router;
