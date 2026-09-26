import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { RowDataPacket } from '../../db/types.js';
import { pool } from '../../db/index.js';
import { env } from '../../config/env.js';
import { sendEmail } from '../mail/mailer.js';

const router = Router();

function reminderEmail(title: string, intro: string, lines: string[]) {
  const items = lines.map((l) => `<li style="margin:6px 0;">${l}</li>`).join('');
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1b2320;">
    <div style="background: #7fa26a; color: #fff; padding: 20px 24px; border-radius: 16px 16px 0 0;">
      <h1 style="margin: 0; font-size: 20px;">🐾 PetHelp</h1>
    </div>
    <div style="border: 1px solid #e5e1d6; border-top: none; border-radius: 0 0 16px 16px; padding: 24px;">
      <h2 style="margin: 0 0 12px; font-size: 18px;">${title}</h2>
      <p style="margin: 0 0 12px; color: #5f6a64;">${intro}</p>
      <ul style="margin: 0; padding-left: 18px; color: #1b2320;">${items}</ul>
      <p style="margin: 16px 0 0; font-size: 13px; color: #5f6a64;">Você recebe este aviso porque tem um pet cadastrado no PetHelp.</p>
    </div>
  </div>`;
}

/** E-mail comemorativo do aniversário do pet. */
function birthdayEmail(petName: string, tutorName: string, years: number) {
  const greeting = tutorName ? `Oi, ${tutorName}!` : 'Oi!';
  const ageLine =
    years > 0
      ? `Hoje ${petName} completa <strong>${years === 1 ? '1 aninho' : `${years} aninhos`}</strong>.`
      : `Hoje é o dia de <strong>${petName}</strong>.`;

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1b2320;">
    <div style="background: linear-gradient(135deg, #7fa26a, #6b8c59); color: #fff; padding: 28px 24px; border-radius: 16px 16px 0 0; text-align: center;">
      <div style="font-size: 42px; line-height: 1;">🎂</div>
      <h1 style="margin: 10px 0 0; font-size: 22px;">Feliz aniversário, ${petName}!</h1>
    </div>
    <div style="border: 1px solid #e5e1d6; border-top: none; border-radius: 0 0 16px 16px; padding: 24px; text-align: center;">
      <p style="margin: 0 0 12px; color: #5f6a64;">${greeting}</p>
      <p style="margin: 0 0 16px; font-size: 16px;">${ageLine}</p>
      <p style="margin: 0 0 16px; color: #5f6a64;">
        Que tal aproveitar a data para conferir se a carteira de vacinação está em dia?
        No PetHelp você vê as próximas doses e ainda pode exportar a carteirinha em PDF.
      </p>
      <p style="margin: 0; font-size: 13px; color: #5f6a64;">
        Você recebe este aviso porque cadastrou a data de nascimento de ${petName} no PetHelp.
      </p>
    </div>
  </div>`;
}

async function notificationExists(userId: string, sourceKey: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM notifications WHERE user_id = ? AND source_key = ? LIMIT 1',
    [userId, sourceKey]
  );
  return rows.length > 0;
}

async function createNotification(input: {
  userId: string;
  petId: string | null;
  appointmentId: string | null;
  sourceKey: string;
  type: 'vaccine' | 'appointment' | 'birthday';
  title: string;
  message: string;
}) {
  await pool.execute(
    `INSERT INTO notifications (id, user_id, pet_id, appointment_id, source_key, type, title, message, notification_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)`,
    [randomUUID(), input.userId, input.petId, input.appointmentId, input.sourceKey, input.type, input.title, input.message]
  );
}

/** Varre vacinas e consultas próximas, cria notificações (com dedupe) e envia e-mail. */
export async function runReminders() {
  let vaccineCount = 0;
  let appointmentCount = 0;
  let emailsSent = 0;

  // 1) Vacinas vencendo (até 7 dias) ou atrasadas.
  const [vaccineRows] = await pool.query<RowDataPacket[]>(
    `SELECT v.id, v.name,
            TO_CHAR(v.next_dose_date, 'DD/MM/YYYY') AS due_label,
            TO_CHAR(v.next_dose_date, 'YYYY-MM-DD') AS due_key,
            (v.next_dose_date < CURRENT_DATE) AS overdue,
            p.id AS pet_id, p.name AS pet_name,
            t.user_id AS user_id, u.email AS email
     FROM vaccines v
     JOIN pets p ON p.id = v.pet_id AND p.is_active = TRUE
     JOIN tutors t ON t.id = p.current_tutor_id
     JOIN users u ON u.id = t.user_id AND u.is_active = TRUE
     WHERE v.deleted_at IS NULL AND v.next_dose_date IS NOT NULL
       AND v.next_dose_date <= CURRENT_DATE + INTERVAL '7 days'`,
    []
  );

  for (const row of vaccineRows as any[]) {
    const sourceKey = `vaccine-due:${row.id}:${row.due_key}`;
    if (await notificationExists(row.user_id, sourceKey)) continue;

    const overdue = row.overdue === true || row.overdue === 't' || row.overdue === 1;
    const title = overdue ? 'Vacina atrasada' : 'Vacina próxima do vencimento';
    const message = overdue
      ? `A vacina ${row.name} de ${row.pet_name} está atrasada (venceu em ${row.due_label}).`
      : `A vacina ${row.name} de ${row.pet_name} vence em ${row.due_label}.`;

    await createNotification({ userId: row.user_id, petId: row.pet_id, appointmentId: null, sourceKey, type: 'vaccine', title, message });
    vaccineCount += 1;

    if (row.email) {
      const { sent } = await sendEmail(row.email, `PetHelp — ${title}`, reminderEmail(title, 'Lembrete de vacinação do seu pet:', [message]));
      if (sent) emailsSent += 1;
    }
  }

  // 2) Consultas agendadas para os próximos 2 dias.
  const [apptRows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id,
            TO_CHAR(a.appointment_date, 'DD/MM/YYYY') AS date_label,
            TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS date_key,
            TO_CHAR(a.appointment_time, 'HH24:MI') AS time_label,
            a.pet_id, a.pet_name, a.veterinarian_name, a.clinic_name,
            t.user_id AS user_id, u.email AS email
     FROM appointments a
     JOIN tutors t ON t.id = a.tutor_id
     JOIN users u ON u.id = t.user_id AND u.is_active = TRUE
     WHERE a.status = 'scheduled'
       AND a.appointment_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '2 days'`,
    []
  );

  for (const row of apptRows as any[]) {
    const sourceKey = `appt-soon:${row.id}:${row.date_key}`;
    if (await notificationExists(row.user_id, sourceKey)) continue;

    const withWhom = row.veterinarian_name || row.clinic_name;
    const title = 'Consulta próxima';
    const message = `Consulta de ${row.pet_name} em ${row.date_label} às ${row.time_label}${withWhom ? ` com ${withWhom}` : ''}.`;

    await createNotification({ userId: row.user_id, petId: row.pet_id, appointmentId: row.id, sourceKey, type: 'appointment', title, message });
    appointmentCount += 1;

    if (row.email) {
      const { sent } = await sendEmail(row.email, `PetHelp — ${title}`, reminderEmail(title, 'Lembrete de consulta:', [message]));
      if (sent) emailsSent += 1;
    }
  }

  // 3) Aniversário do pet (só para pets com data de nascimento preenchida).
  const [birthdayRows] = await pool.query<RowDataPacket[]>(
    `SELECT p.id AS pet_id, p.name AS pet_name,
            EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.birth_date))::int AS years,
            TO_CHAR(CURRENT_DATE, 'YYYY') AS current_year,
            t.name AS tutor_name, t.user_id AS user_id, u.email AS email
     FROM pets p
     JOIN tutors t ON t.id = p.current_tutor_id
     JOIN users u ON u.id = t.user_id AND u.is_active = TRUE
     WHERE p.is_active = TRUE AND p.birth_date IS NOT NULL
       AND EXTRACT(MONTH FROM p.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(DAY FROM p.birth_date) = EXTRACT(DAY FROM CURRENT_DATE)`,
    []
  );

  let birthdayCount = 0;
  for (const row of birthdayRows as any[]) {
    // Uma vez por ano por pet, mesmo que o cron rode mais de uma vez no mesmo dia.
    const sourceKey = `pet-birthday:${row.pet_id}:${row.current_year}`;
    if (await notificationExists(row.user_id, sourceKey)) continue;

    const years = Number(row.years) || 0;
    const title = `Feliz aniversário, ${row.pet_name}! 🎉`;
    const message =
      years > 0
        ? `Hoje ${row.pet_name} completa ${years === 1 ? '1 aninho' : `${years} aninhos`}. Aproveite o dia!`
        : `Hoje é o dia de ${row.pet_name}. Aproveite!`;

    await createNotification({
      userId: row.user_id,
      petId: row.pet_id,
      appointmentId: null,
      sourceKey,
      type: 'birthday',
      title,
      message,
    });
    birthdayCount += 1;

    if (row.email) {
      const { sent } = await sendEmail(
        row.email,
        `🎉 ${row.pet_name} faz aniversário hoje!`,
        birthdayEmail(String(row.pet_name), String(row.tutor_name ?? ''), years)
      );
      if (sent) emailsSent += 1;
    }
  }

  return { vaccineCount, appointmentCount, birthdayCount, emailsSent };
}

// Vercel Cron chama via GET com "Authorization: Bearer <CRON_SECRET>" quando CRON_SECRET está definido.
router.get('/reminders/run', async (req, res, next) => {
  try {
    if (env.cronSecret) {
      const auth = req.header('authorization') || '';
      const provided = auth.replace(/^Bearer\s+/i, '').trim();
      if (provided !== env.cronSecret) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
    }

    const result = await runReminders();
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
