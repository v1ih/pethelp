import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from '../../db/index.js';
import type { ResultSetHeader, RowDataPacket } from '../../db/types.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { requireAuth } from '../../middlewares/auth.js';
import { findClinicByUserId, findTutorByUserId, findVeterinarianByUserId } from '../users/users.service.js';
import { sendEmail } from '../mail/mailer.js';
import {
  CATEGORY_LABELS,
  SERVICE_CATEGORIES,
  normalizeCategory,
  type ServiceCategory,
} from '../price-items/price-items.routes.js';
import { diffFields, recordAudit } from '../audit/audit.service.js';

/**
 * Cobranças de clínicas e veterinários: o que foi feito, quanto custou, se já foi pago
 * e por qual forma. O responsável recebe e-mail quando a cobrança é lançada e quando é
 * marcada como paga, e enxerga tudo em "Pagamentos" na conta dele.
 */
const router = Router();

router.use(requireAuth);

const METHODS = ['pix', 'dinheiro', 'credito', 'debito', 'transferencia', 'outro'] as const;
type Method = (typeof METHODS)[number];

const METHOD_LABELS: Record<Method, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  transferencia: 'Transferência',
  outro: 'Outro',
};

type PaymentRow = RowDataPacket & {
  id: string;
  pet_id: string | null;
  tutor_id: string | null;
  appointment_id: string | null;
  clinic_id: string | null;
  veterinarian_id: string | null;
  description: string;
  amount_cents: number;
  status: 'pending' | 'paid' | 'cancelled';
  method: Method | null;
  category: ServiceCategory;
  service_date: Date | string | null;
  due_date: Date | string | null;
  paid_at: Date | string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  pet_name?: string | null;
  tutor_name?: string | null;
  tutor_email?: string | null;
  tutor_user_id?: string | null;
  professional_name?: string | null;
};

type Professional = {
  kind: 'clinic' | 'veterinarian';
  id: string;
  userId: string;
  displayName: string;
};

function asTrimmedString(value: unknown, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function formatDay(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function formatMoney(amountCents: number) {
  return (amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Aceita "150", "150,50" ou 150.5 e devolve o valor em centavos. */
function parseAmountCents(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  const text = asTrimmedString(value, 20).replace(/[^\d,.-]/g, '');
  if (!text) return null;

  // Texto em pt-BR: o último separador é o decimal.
  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return Math.round(parsed * 100);
}

function parseMethod(value: unknown): Method | null {
  const text = asTrimmedString(value, 20).toLowerCase();
  return (METHODS as readonly string[]).includes(text) ? (text as Method) : null;
}

function parseDueDate(value: unknown) {
  const text = asTrimmedString(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

/** Categoria vinda da query string: só filtra quando veio uma categoria conhecida. */
function normalizeCategoryFilter(value: unknown): ServiceCategory | null {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (SERVICE_CATEGORIES as readonly string[]).includes(text) ? (text as ServiceCategory) : null;
}

async function resolveProfessional(user: AuthRequest['user']): Promise<Professional | null> {
  if (!user) return null;

  if (user.userType === 'clinic') {
    const clinic = await findClinicByUserId(user.id);
    return clinic ? { kind: 'clinic', id: clinic.id, userId: user.id, displayName: clinic.trade_name } : null;
  }

  if (user.userType === 'veterinarian') {
    const veterinarian = await findVeterinarianByUserId(user.id);
    return veterinarian
      ? { kind: 'veterinarian', id: veterinarian.id, userId: user.id, displayName: veterinarian.name }
      : null;
  }

  return null;
}

function normalizePayment(row: PaymentRow) {
  return {
    id: row.id,
    petId: row.pet_id,
    petName: row.pet_name ?? null,
    tutorId: row.tutor_id,
    tutorName: row.tutor_name ?? null,
    tutorEmail: row.tutor_email ?? null,
    professionalName: row.professional_name ?? null,
    appointmentId: row.appointment_id,
    description: row.description,
    amountCents: Number(row.amount_cents),
    amountLabel: formatMoney(Number(row.amount_cents)),
    status: row.status,
    category: row.category ?? 'outro',
    categoryLabel: CATEGORY_LABELS[(row.category ?? 'outro') as ServiceCategory] ?? CATEGORY_LABELS.outro,
    method: row.method,
    methodLabel: row.method ? METHOD_LABELS[row.method] : null,
    serviceDate: formatDay(row.service_date),
    dueDate: formatDay(row.due_date),
    paidAt: row.paid_at ? new Date(row.paid_at as string).toISOString() : null,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

const SELECT_PAYMENT = `
  SELECT p.*, pet.name AS pet_name, t.name AS tutor_name, u.email AS tutor_email, t.user_id AS tutor_user_id,
         COALESCE(c.trade_name, v.name) AS professional_name
  FROM payments p
  LEFT JOIN pets pet ON pet.id = p.pet_id
  LEFT JOIN tutors t ON t.id = p.tutor_id
  LEFT JOIN users u ON u.id = t.user_id
  LEFT JOIN clinics c ON c.id = p.clinic_id
  LEFT JOIN veterinarians v ON v.id = p.veterinarian_id
`;

async function loadPaymentById(paymentId: string) {
  const [rows] = await pool.query<PaymentRow[]>(`${SELECT_PAYMENT} WHERE p.id = ? LIMIT 1`, [paymentId]);
  return rows[0] ?? null;
}

function paymentEmailTemplate(options: {
  title: string;
  intro: string;
  lines: Array<[string, string]>;
  note?: string;
}) {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = options.lines
    .map(
      ([label, value]) =>
        `<tr><td style="padding: 6px 12px; color: #5f6a64; font-size: 14px;">${escape(
          label
        )}</td><td style="padding: 6px 12px; font-size: 14px; text-align: right;"><strong>${escape(
          value
        )}</strong></td></tr>`
    )
    .join('');

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1b2320;">
    <div style="background: #1f7a63; color: #fff; padding: 20px 24px; border-radius: 16px 16px 0 0;">
      <h1 style="margin: 0; font-size: 20px;">🐾 PetHelp</h1>
    </div>
    <div style="border: 1px solid #e5e1d6; border-top: none; border-radius: 0 0 16px 16px; padding: 24px;">
      <h2 style="margin: 0 0 12px; font-size: 18px;">${escape(options.title)}</h2>
      <p style="margin: 0 0 16px; color: #5f6a64;">${escape(options.intro)}</p>
      <table style="width: 100%; border-collapse: collapse; background: #f6f8f6; border-radius: 12px;">${rows}</table>
      ${options.note ? `<p style="margin: 16px 0 0; font-size: 13px; color: #5f6a64;">${escape(options.note)}</p>` : ''}
      <p style="margin: 16px 0 0; font-size: 12px; color: #8a8a84;">
        Este é um registro de atendimento no PetHelp e não é um documento fiscal.
      </p>
    </div>
  </div>`;
}

async function notifyTutor(row: PaymentRow, kind: 'created' | 'paid', professionalName: string) {
  if (!row.tutor_email) return;

  const lines: Array<[string, string]> = [
    ['Serviço', row.description],
    ['Valor', formatMoney(Number(row.amount_cents))],
  ];
  if (row.pet_name) lines.unshift(['Pet', row.pet_name]);
  if (row.method) lines.push(['Forma de pagamento', METHOD_LABELS[row.method]]);
  if (kind === 'created' && row.due_date) lines.push(['Vencimento', formatDay(row.due_date) ?? '']);
  if (kind === 'paid' && row.paid_at) {
    lines.push(['Pago em', new Date(row.paid_at as string).toLocaleDateString('pt-BR')]);
  }
  lines.push([professionalName.length > 0 ? 'Atendimento por' : 'Profissional', professionalName]);

  const content =
    kind === 'created'
      ? {
          subject: `Cobrança registrada — ${formatMoney(Number(row.amount_cents))}`,
          title: 'Cobrança registrada',
          intro: `${professionalName} registrou uma cobrança no PetHelp.`,
          note: 'Você acompanha e confere em "Pagamentos", na sua conta.',
        }
      : {
          subject: `Pagamento confirmado — ${formatMoney(Number(row.amount_cents))}`,
          title: 'Pagamento confirmado',
          intro: `${professionalName} confirmou o recebimento.`,
          note: 'Guarde este e-mail como comprovante do registro no PetHelp.',
        };

  try {
    await sendEmail(
      row.tutor_email,
      content.subject,
      paymentEmailTemplate({ title: content.title, intro: content.intro, lines, note: content.note })
    );
  } catch (error) {
    console.error('Falha ao avisar o responsável sobre a cobrança:', error);
  }

  if (row.tutor_user_id) {
    try {
      await pool.execute(
        `INSERT INTO notifications (id, user_id, pet_id, source_key, type, title, message, notification_date)
         VALUES (?, ?, ?, ?, 'connection', ?, ?, CURRENT_DATE)`,
        [
          randomUUID(),
          row.tutor_user_id,
          row.pet_id,
          `payment-${kind}:${row.id}`,
          kind === 'created' ? 'Cobrança registrada' : 'Pagamento confirmado',
          kind === 'created'
            ? `${professionalName} registrou ${formatMoney(Number(row.amount_cents))} referente a ${row.description}.`
            : `${professionalName} confirmou o pagamento de ${formatMoney(Number(row.amount_cents))}.`,
        ]
      );
    } catch (error) {
      console.error('Falha ao criar notificação de cobrança:', error);
    }
  }
}

/**
 * Responsáveis que o profissional atende, cada um com seus pets. É o que permite
 * escolher primeiro a pessoa e depois o animal — dois pets podem ter o mesmo nome, e
 * quem tem vários pets precisa aparecer uma vez só.
 */
router.get('/clients', async (req: AuthRequest, res, next) => {
  try {
    const professional = await resolveProfessional(req.user);
    if (!professional) {
      res.status(403).json({ message: 'Apenas clínicas e veterinários podem ver esta lista.' });
      return;
    }

    // Clínica: pets vinculados ou cadastrados por ela. Veterinário: pets que ele
    // cadastrou ou para os quais tem um Vet-Pass válido.
    const where =
      professional.kind === 'clinic'
        ? '(p.linked_clinic_id = ? OR p.registered_by_clinic_id = ?)'
        : `(p.registered_by_veterinarian_id = ? OR EXISTS (
             SELECT 1 FROM vet_passes vp
             WHERE vp.pet_id = p.id AND vp.redeemed_by_user_id = ? AND vp.expires_at >= CURRENT_TIMESTAMP
           ))`;
    const params =
      professional.kind === 'clinic'
        ? [professional.id, professional.id]
        : [professional.id, professional.userId];

    const [rows] = await pool.query<RowDataPacket[]>(
      `
        SELECT t.id AS tutor_id, t.name AS tutor_name, u.email AS tutor_email, t.phone AS tutor_phone,
               p.id AS pet_id, p.name AS pet_name, p.species AS pet_species
        FROM pets p
        JOIN tutors t ON t.id = p.current_tutor_id
        JOIN users u ON u.id = t.user_id
        WHERE ${where} AND p.is_active = TRUE
        ORDER BY t.name ASC, p.name ASC
      `,
      params
    );

    const byTutor = new Map<
      string,
      { id: string; name: string; email: string; phone: string | null; pets: Array<{ id: string; name: string; species: string | null }> }
    >();

    for (const row of rows) {
      const tutorId = String(row.tutor_id);
      if (!byTutor.has(tutorId)) {
        byTutor.set(tutorId, {
          id: tutorId,
          name: String(row.tutor_name),
          email: String(row.tutor_email),
          phone: (row.tutor_phone as string) ?? null,
          pets: [],
        });
      }
      byTutor.get(tutorId)!.pets.push({
        id: String(row.pet_id),
        name: String(row.pet_name),
        species: (row.pet_species as string) ?? null,
      });
    }

    res.json({ data: [...byTutor.values()] });
  } catch (error) {
    next(error);
  }
});

/** Lista as cobranças: do profissional logado, ou as do responsável logado. */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const status = asTrimmedString(req.query.status, 20);
    const filters: string[] = [];
    const values: Array<string> = [];

    const professional = await resolveProfessional(req.user);
    if (professional) {
      filters.push(professional.kind === 'clinic' ? 'p.clinic_id = ?' : 'p.veterinarian_id = ?');
      values.push(professional.id);
    } else if (req.user?.userType === 'tutor') {
      const tutor = await findTutorByUserId(req.user.id);
      if (!tutor) {
        res.json({ data: [], totals: { pendingCents: 0, paidCents: 0 } });
        return;
      }
      filters.push('p.tutor_id = ?');
      values.push(tutor.id);
    } else {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    if (['pending', 'paid', 'cancelled'].includes(status)) {
      filters.push('p.status = ?');
      values.push(status);
    }

    // A data que interessa no fechamento é a do atendimento, não a do lançamento:
    // uma cobrança digitada no dia seguinte continua pertencendo ao dia em que foi feita.
    const serviceDay = `COALESCE(p.service_date, p.due_date, p.created_at::date)`;

    // Filtro por dia: 'YYYY-MM-DD' — é o fechamento de caixa da secretária.
    const day = asTrimmedString(req.query.day, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      filters.push(`${serviceDay} = ?::date`);
      values.push(day);
    } else {
      // Filtro por competência: 'YYYY-MM' devolve o mês inteiro.
      const month = asTrimmedString(req.query.month, 7);
      if (/^\d{4}-\d{2}$/.test(month)) {
        filters.push(`${serviceDay} >= ?::date AND ${serviceDay} < (?::date + INTERVAL '1 month')`);
        values.push(`${month}-01`, `${month}-01`);
      }
    }

    const category = normalizeCategoryFilter(req.query.category);
    if (category) {
      filters.push('p.category = ?');
      values.push(category);
    }

    const petId = asTrimmedString(req.query.petId, 60);
    if (petId) {
      filters.push('p.pet_id = ?');
      values.push(petId);
    }

    const [rows] = await pool.query<PaymentRow[]>(
      `${SELECT_PAYMENT} WHERE ${filters.join(' AND ')} ORDER BY ${serviceDay} DESC, p.created_at DESC LIMIT 500`,
      values
    );

    const data = rows.map(normalizePayment);

    // Soma por tipo de serviço: é o que a secretária monta na mão hoje.
    const byCategory = SERVICE_CATEGORIES.map((key) => {
      const items = data.filter((item) => item.category === key);
      return {
        category: key,
        label: CATEGORY_LABELS[key],
        count: items.length,
        totalCents: items.reduce((sum, item) => sum + item.amountCents, 0),
        paidCents: items
          .filter((item) => item.status === 'paid')
          .reduce((sum, item) => sum + item.amountCents, 0),
        pendingCents: items
          .filter((item) => item.status === 'pending')
          .reduce((sum, item) => sum + item.amountCents, 0),
      };
    }).filter((entry) => entry.count > 0);

    // Soma por forma de pagamento, do que já foi recebido: fecha com o caixa e a maquininha.
    const paidItems = data.filter((item) => item.status === 'paid');
    const byMethod = METHODS.map((key) => {
      const items = paidItems.filter((item) => item.method === key);
      return {
        method: key,
        label: METHOD_LABELS[key],
        count: items.length,
        totalCents: items.reduce((sum, item) => sum + item.amountCents, 0),
      };
    }).filter((entry) => entry.count > 0);

    res.json({
      data,
      totals: {
        pendingCents: data.filter((item) => item.status === 'pending').reduce((sum, item) => sum + item.amountCents, 0),
        paidCents: paidItems.reduce((sum, item) => sum + item.amountCents, 0),
        cancelledCents: data
          .filter((item) => item.status === 'cancelled')
          .reduce((sum, item) => sum + item.amountCents, 0),
        count: data.length,
      },
      byCategory,
      byMethod,
    });
  } catch (error) {
    next(error);
  }
});

/** Lança uma cobrança. Só clínica e veterinário. */
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const professional = await resolveProfessional(req.user);
    if (!professional) {
      res.status(403).json({ message: 'Apenas clínicas e veterinários podem lançar cobranças.' });
      return;
    }

    const body = req.body ?? {};

    // Item da tabela de preços: preenche descrição, valor e categoria de uma vez.
    const priceItemId = asTrimmedString(body.priceItemId, 60);
    let priceItem: { name: string; amount_cents: number; category: ServiceCategory } | null = null;
    if (priceItemId) {
      const [priceRows] = await pool.query<RowDataPacket[]>(
        `SELECT name, amount_cents, category FROM price_items
         WHERE id = ? AND ${professional.kind === 'clinic' ? 'clinic_id' : 'veterinarian_id'} = ? LIMIT 1`,
        [priceItemId, professional.id]
      );
      if (!priceRows.length) {
        res.status(404).json({ message: 'Serviço não encontrado na sua tabela de preços.' });
        return;
      }
      priceItem = priceRows[0] as { name: string; amount_cents: number; category: ServiceCategory };
    }

    const description = asTrimmedString(body.description) || (priceItem ? String(priceItem.name) : '');
    const amountCents =
      parseAmountCents(body.amount ?? body.amountCents) ?? (priceItem ? Number(priceItem.amount_cents) : null);
    const category = body.category !== undefined || !priceItem ? normalizeCategory(body.category) : priceItem.category;

    if (!description) {
      res.status(400).json({ message: 'Descreva o que foi realizado.' });
      return;
    }

    if (amountCents === null || amountCents <= 0) {
      res.status(400).json({ message: 'Informe um valor válido.' });
      return;
    }

    const petId = asTrimmedString(body.petId, 60) || null;
    let tutorId = asTrimmedString(body.tutorId, 60) || null;

    // O pet informado define o responsável cobrado, e garante que o profissional
    // realmente atende aquele pet (vínculo com a clínica ou Vet-Pass válido).
    if (petId) {
      const [petRows] = await pool.query<RowDataPacket[]>(
        `SELECT p.id, p.current_tutor_id, p.linked_clinic_id,
                EXISTS (
                  SELECT 1 FROM vet_passes vp
                  WHERE vp.pet_id = p.id AND vp.redeemed_by_user_id = ? AND vp.expires_at >= CURRENT_TIMESTAMP
                ) AS has_pass
         FROM pets p WHERE p.id = ? LIMIT 1`,
        [professional.userId, petId]
      );
      const pet = petRows[0];
      if (!pet) {
        res.status(404).json({ message: 'Pet não encontrado.' });
        return;
      }

      const linked = professional.kind === 'clinic' && pet.linked_clinic_id === professional.id;
      if (!linked && pet.has_pass !== true) {
        res.status(403).json({ message: 'Você não tem acesso a este pet.' });
        return;
      }

      // O responsável cobrado é sempre o do pet: evita cobrança presa à pessoa errada
      // se a tela mandar um par pet/responsável desencontrado.
      tutorId = pet.current_tutor_id ? String(pet.current_tutor_id) : tutorId;
    }

    const id = randomUUID();
    const method = parseMethod(body.method);
    const markPaid = body.status === 'paid' || body.paid === true;

    await pool.execute(
      `INSERT INTO payments (
         id, pet_id, tutor_id, appointment_id, clinic_id, veterinarian_id,
         description, amount_cents, status, method, category, service_date, due_date, paid_at, notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${markPaid ? 'CURRENT_TIMESTAMP' : 'NULL'}, ?)`,
      [
        id,
        petId,
        tutorId,
        asTrimmedString(body.appointmentId, 60) || null,
        professional.kind === 'clinic' ? professional.id : null,
        professional.kind === 'veterinarian' ? professional.id : null,
        description,
        amountCents,
        markPaid ? 'paid' : 'pending',
        method,
        category,
        // Sem data informada, o atendimento é de hoje — o caso normal no balcão.
        parseDueDate(body.serviceDate) ?? new Date().toISOString().slice(0, 10),
        parseDueDate(body.dueDate),
        asTrimmedString(body.notes, 1000) || null,
      ]
    );

    const created = await loadPaymentById(id);
    if (!created) {
      res.status(500).json({ message: 'Não foi possível registrar a cobrança.' });
      return;
    }

    await recordAudit({
      user: req.user,
      entityType: 'payment',
      entityId: created.id,
      petId: created.pet_id,
      action: 'create',
      summary: `Cobrança de ${formatMoney(Number(created.amount_cents))} lançada (${created.description})`,
    });

    await notifyTutor(created, markPaid ? 'paid' : 'created', professional.displayName);
    res.status(201).json({ data: normalizePayment(created) });
  } catch (error) {
    next(error);
  }
});

/** Atualiza a cobrança (marcar como paga, trocar a forma, corrigir valor). */
router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const professional = await resolveProfessional(req.user);
    if (!professional) {
      res.status(403).json({ message: 'Apenas clínicas e veterinários podem alterar cobranças.' });
      return;
    }

    const existing = await loadPaymentById(String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Cobrança não encontrada.' });
      return;
    }

    const owns =
      professional.kind === 'clinic'
        ? existing.clinic_id === professional.id
        : existing.veterinarian_id === professional.id;
    if (!owns) {
      res.status(403).json({ message: 'Esta cobrança não é sua.' });
      return;
    }

    const body = req.body ?? {};
    const assignments: string[] = [];
    const values: Array<string | number | null> = [];
    let becamePaid = false;

    if (body.description !== undefined) {
      const description = asTrimmedString(body.description);
      if (!description) {
        res.status(400).json({ message: 'Descreva o que foi realizado.' });
        return;
      }
      assignments.push('description = ?');
      values.push(description);
    }

    if (body.amount !== undefined || body.amountCents !== undefined) {
      const amountCents = parseAmountCents(body.amount ?? body.amountCents);
      if (amountCents === null || amountCents <= 0) {
        res.status(400).json({ message: 'Informe um valor válido.' });
        return;
      }
      assignments.push('amount_cents = ?');
      values.push(amountCents);
    }

    if (body.method !== undefined) {
      assignments.push('method = ?');
      values.push(parseMethod(body.method));
    }

    if (body.category !== undefined) {
      assignments.push('category = ?');
      values.push(normalizeCategory(body.category));
    }

    if (body.serviceDate !== undefined) {
      assignments.push('service_date = ?');
      values.push(parseDueDate(body.serviceDate));
    }

    if (body.dueDate !== undefined) {
      assignments.push('due_date = ?');
      values.push(parseDueDate(body.dueDate));
    }

    if (body.notes !== undefined) {
      assignments.push('notes = ?');
      values.push(asTrimmedString(body.notes, 1000) || null);
    }

    if (body.status !== undefined) {
      const status = asTrimmedString(body.status, 20);
      if (!['pending', 'paid', 'cancelled'].includes(status)) {
        res.status(400).json({ message: 'Situação inválida.' });
        return;
      }
      assignments.push('status = ?');
      values.push(status);
      // paid_at acompanha a situação: some se a cobrança volta a ficar pendente.
      assignments.push(status === 'paid' ? 'paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP)' : 'paid_at = NULL');
      becamePaid = status === 'paid' && existing.status !== 'paid';
    }

    if (assignments.length === 0) {
      res.status(400).json({ message: 'Nada para atualizar.' });
      return;
    }

    values.push(existing.id);
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE payments SET ${assignments.join(', ')} WHERE id = ?`,
      values
    );

    if ((result.affectedRows ?? 0) === 0) {
      res.status(404).json({ message: 'Cobrança não encontrada.' });
      return;
    }

    const updated = await loadPaymentById(existing.id);

    if (updated) {
      const changes = diffFields(
        {
          description: existing.description,
          amount: Number(existing.amount_cents) / 100,
          status: existing.status,
          method: existing.method,
          category: existing.category,
          serviceDate: formatDay(existing.service_date),
        },
        {
          description: updated.description,
          amount: Number(updated.amount_cents) / 100,
          status: updated.status,
          method: updated.method,
          category: updated.category,
          serviceDate: formatDay(updated.service_date),
        },
        {
          description: 'Serviço',
          amount: 'Valor',
          status: 'Situação',
          method: 'Forma de pagamento',
          category: 'Tipo',
          serviceDate: 'Data do atendimento',
        }
      );

      if (changes.length) {
        await recordAudit({
          user: req.user,
          entityType: 'payment',
          entityId: updated.id,
          petId: updated.pet_id,
          action: 'update',
          summary: `Cobrança "${updated.description}" alterada`,
          changes,
        });
      }
    }

    if (updated && becamePaid) {
      await notifyTutor(updated, 'paid', professional.displayName);
    }

    res.json({ data: updated ? normalizePayment(updated) : null });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const professional = await resolveProfessional(req.user);
    if (!professional) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const existing = await loadPaymentById(String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Cobrança não encontrada.' });
      return;
    }

    const owns =
      professional.kind === 'clinic'
        ? existing.clinic_id === professional.id
        : existing.veterinarian_id === professional.id;
    if (!owns) {
      res.status(403).json({ message: 'Esta cobrança não é sua.' });
      return;
    }

    await pool.execute('DELETE FROM payments WHERE id = ?', [existing.id]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
