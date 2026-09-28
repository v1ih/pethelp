import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from '../../db/index.js';
import type { ResultSetHeader, RowDataPacket } from '../../db/types.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { requireAuth } from '../../middlewares/auth.js';
import { findClinicByUserId, findVeterinarianByUserId } from '../users/users.service.js';
import { recordAudit } from '../audit/audit.service.js';

/**
 * Tabela de preços da clínica ou do veterinário autônomo. É a base para lançar
 * cobranças: em vez de digitar valor e descrição toda vez, escolhe-se o serviço.
 */
const router = Router();

router.use(requireAuth);

export const SERVICE_CATEGORIES = [
  'consulta',
  'vacina',
  'exame',
  'cirurgia',
  'internacao',
  'banho_tosa',
  'medicamento',
  'retorno',
  'outro',
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  consulta: 'Consulta',
  vacina: 'Vacina',
  exame: 'Exame',
  cirurgia: 'Cirurgia',
  internacao: 'Internação',
  banho_tosa: 'Banho e tosa',
  medicamento: 'Medicamento',
  retorno: 'Retorno',
  outro: 'Outro',
};

export function normalizeCategory(value: unknown): ServiceCategory {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (SERVICE_CATEGORIES as readonly string[]).includes(text) ? (text as ServiceCategory) : 'outro';
}

type PriceItemRow = RowDataPacket & {
  id: string;
  clinic_id: string | null;
  veterinarian_id: string | null;
  name: string;
  category: ServiceCategory;
  amount_cents: number;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

type Professional = { kind: 'clinic' | 'veterinarian'; id: string; displayName: string };

function asTrimmedString(value: unknown, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Aceita "150", "150,50" ou 150.5 e devolve o valor em centavos. */
export function parseAmountCents(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 0 ? null : Math.round(value * 100);
  }

  const text = asTrimmedString(value, 20).replace(/[^\d,.-]/g, '');
  if (!text) return null;

  const normalized = text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return Math.round(parsed * 100);
}

async function resolveProfessional(user: AuthRequest['user']): Promise<Professional | null> {
  if (!user) return null;

  if (user.userType === 'clinic') {
    const clinic = await findClinicByUserId(user.id);
    return clinic ? { kind: 'clinic', id: clinic.id, displayName: String(clinic.trade_name) } : null;
  }

  if (user.userType === 'veterinarian') {
    const veterinarian = await findVeterinarianByUserId(user.id);
    return veterinarian ? { kind: 'veterinarian', id: veterinarian.id, displayName: String(veterinarian.name) } : null;
  }

  return null;
}

function normalizePriceItem(row: PriceItemRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    categoryLabel: CATEGORY_LABELS[row.category] ?? CATEGORY_LABELS.outro,
    amountCents: Number(row.amount_cents),
    notes: row.notes,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ownerClause(professional: Professional) {
  return professional.kind === 'clinic' ? 'clinic_id = ?' : 'veterinarian_id = ?';
}

/** Lista a tabela de preços. `includeInactive=1` traz também os itens desativados. */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const professional = await resolveProfessional(req.user);
    if (!professional) {
      res.status(403).json({ message: 'Apenas clínicas e veterinários têm tabela de preços.' });
      return;
    }

    const includeInactive = String(req.query.includeInactive ?? '') === '1';
    const activeClause = includeInactive ? '' : 'AND is_active = TRUE';

    const [rows] = await pool.query<PriceItemRow[]>(
      `
        SELECT * FROM price_items
        WHERE ${ownerClause(professional)} ${activeClause}
        ORDER BY category, name
      `,
      [professional.id]
    );

    res.json({
      data: rows.map(normalizePriceItem),
      categories: SERVICE_CATEGORIES.map((key) => ({ key, label: CATEGORY_LABELS[key] })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const professional = await resolveProfessional(req.user);
    if (!professional) {
      res.status(403).json({ message: 'Apenas clínicas e veterinários têm tabela de preços.' });
      return;
    }

    const body = req.body ?? {};
    const name = asTrimmedString(body.name, 120);
    const amountCents = parseAmountCents(body.amount ?? body.amountCents);
    const category = normalizeCategory(body.category);
    const notes = asTrimmedString(body.notes, 500) || null;

    if (!name) {
      res.status(400).json({ message: 'Informe o nome do serviço.' });
      return;
    }

    if (amountCents === null) {
      res.status(400).json({ message: 'Informe um valor válido (ex.: 180,00).' });
      return;
    }

    const id = randomUUID();
    await pool.execute<ResultSetHeader>(
      `
        INSERT INTO price_items (id, clinic_id, veterinarian_id, name, category, amount_cents, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        professional.kind === 'clinic' ? professional.id : null,
        professional.kind === 'veterinarian' ? professional.id : null,
        name,
        category,
        amountCents,
        notes,
      ]
    );

    await recordAudit({
      user: req.user,
      entityType: 'price_item',
      entityId: id,
      petId: null,
      action: 'create',
      summary: `Serviço "${name}" incluído na tabela de preços`,
    });

    const [rows] = await pool.query<PriceItemRow[]>('SELECT * FROM price_items WHERE id = ? LIMIT 1', [id]);
    res.status(201).json({ data: normalizePriceItem(rows[0]), message: 'Serviço adicionado à tabela de preços.' });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const professional = await resolveProfessional(req.user);
    if (!professional) {
      res.status(403).json({ message: 'Apenas clínicas e veterinários têm tabela de preços.' });
      return;
    }

    const [existingRows] = await pool.query<PriceItemRow[]>(
      `SELECT * FROM price_items WHERE id = ? AND ${ownerClause(professional)} LIMIT 1`,
      [String(req.params.id), professional.id]
    );
    const existing = existingRows[0];
    if (!existing) {
      res.status(404).json({ message: 'Serviço não encontrado na sua tabela de preços.' });
      return;
    }

    const body = req.body ?? {};
    const assignments: string[] = [];
    const values: Array<string | number | boolean | null> = [];

    if (body.name !== undefined) {
      const name = asTrimmedString(body.name, 120);
      if (!name) {
        res.status(400).json({ message: 'Informe o nome do serviço.' });
        return;
      }
      assignments.push('name = ?');
      values.push(name);
    }

    if (body.amount !== undefined || body.amountCents !== undefined) {
      const amountCents = parseAmountCents(body.amount ?? body.amountCents);
      if (amountCents === null) {
        res.status(400).json({ message: 'Informe um valor válido (ex.: 180,00).' });
        return;
      }
      assignments.push('amount_cents = ?');
      values.push(amountCents);
    }

    if (body.category !== undefined) {
      assignments.push('category = ?');
      values.push(normalizeCategory(body.category));
    }

    if (body.notes !== undefined) {
      assignments.push('notes = ?');
      values.push(asTrimmedString(body.notes, 500) || null);
    }

    if (body.isActive !== undefined) {
      assignments.push('is_active = ?');
      values.push(body.isActive === true);
    }

    if (!assignments.length) {
      res.json({ data: normalizePriceItem(existing) });
      return;
    }

    await pool.execute<ResultSetHeader>(
      `UPDATE price_items SET ${assignments.join(', ')} WHERE id = ?`,
      [...values, existing.id]
    );

    const [rows] = await pool.query<PriceItemRow[]>('SELECT * FROM price_items WHERE id = ? LIMIT 1', [existing.id]);
    const updated = rows[0];

    const changes = [] as Array<{ field: string; label: string; from: unknown; to: unknown }>;
    if (Number(existing.amount_cents) !== Number(updated.amount_cents)) {
      changes.push({
        field: 'amountCents',
        label: 'Valor',
        from: Number(existing.amount_cents) / 100,
        to: Number(updated.amount_cents) / 100,
      });
    }
    if (existing.name !== updated.name) {
      changes.push({ field: 'name', label: 'Serviço', from: existing.name, to: updated.name });
    }

    await recordAudit({
      user: req.user,
      entityType: 'price_item',
      entityId: existing.id,
      petId: null,
      action: 'update',
      summary: `Serviço "${updated.name}" alterado na tabela de preços`,
      changes,
    });

    res.json({ data: normalizePriceItem(updated), message: 'Tabela de preços atualizada.' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const professional = await resolveProfessional(req.user);
    if (!professional) {
      res.status(403).json({ message: 'Apenas clínicas e veterinários têm tabela de preços.' });
      return;
    }

    const [existingRows] = await pool.query<PriceItemRow[]>(
      `SELECT * FROM price_items WHERE id = ? AND ${ownerClause(professional)} LIMIT 1`,
      [String(req.params.id), professional.id]
    );
    const existing = existingRows[0];
    if (!existing) {
      res.status(404).json({ message: 'Serviço não encontrado na sua tabela de preços.' });
      return;
    }

    await pool.execute<ResultSetHeader>('DELETE FROM price_items WHERE id = ?', [existing.id]);

    await recordAudit({
      user: req.user,
      entityType: 'price_item',
      entityId: existing.id,
      petId: null,
      action: 'delete',
      summary: `Serviço "${existing.name}" removido da tabela de preços`,
    });

    res.json({ message: 'Serviço removido da tabela de preços.' });
  } catch (error) {
    next(error);
  }
});

export default router;
