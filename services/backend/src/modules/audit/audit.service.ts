import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from '../../db/types.js';
import { pool } from '../../db/index.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { findClinicByUserId, findTutorByUserId, findVeterinarianByUserId } from '../users/users.service.js';

// Trilha de auditoria: quem lançou ou alterou cada informação do pet, e o que mudou.
// A clínica precisa disso para se defender de uma acusação depois ("esse dado foi
// alterado por fulano, nesta data"). Só gravamos e lemos — nada aqui apaga registro.

export type AuditEntity =
  | 'medical_record'
  | 'vaccine'
  | 'pet'
  | 'appointment'
  | 'payment'
  | 'price_item';

export type AuditAction = 'create' | 'update' | 'delete';

export type AuditChange = { field: string; label: string; from: unknown; to: unknown };

type ActorInfo = { userId: string | null; role: string; name: string };

const actorCache = new Map<string, ActorInfo>();

/** Nome de quem agiu, para o histórico não ficar só com um id. */
export async function resolveActor(user: AuthRequest['user']): Promise<ActorInfo> {
  if (!user) return { userId: null, role: 'desconhecido', name: 'Desconhecido' };

  const cached = actorCache.get(user.id);
  if (cached) return cached;

  let name = user.email;
  if (user.userType === 'tutor') {
    const tutor = await findTutorByUserId(user.id);
    if (tutor?.name) name = String(tutor.name);
  } else if (user.userType === 'clinic') {
    const clinic = await findClinicByUserId(user.id);
    if (clinic?.trade_name) name = String(clinic.trade_name);
  } else if (user.userType === 'veterinarian') {
    const veterinarian = await findVeterinarianByUserId(user.id);
    if (veterinarian?.name) name = String(veterinarian.name);
  }

  const actor: ActorInfo = { userId: user.id, role: user.userType, name };
  actorCache.set(user.id, actor);
  return actor;
}

/** Esquece o nome guardado em memória quando o perfil muda de nome. */
export function forgetActor(userId: string) {
  actorCache.delete(userId);
}

/**
 * Grava uma entrada no histórico. Nunca derruba a operação principal: se a auditoria
 * falhar, o atendimento não pode parar — o erro vai para o log do servidor.
 */
export async function recordAudit(options: {
  user: AuthRequest['user'];
  entityType: AuditEntity;
  entityId: string | null;
  petId: string | null;
  action: AuditAction;
  summary: string;
  changes?: AuditChange[];
}) {
  try {
    const actor = await resolveActor(options.user);
    const changes = options.changes?.length ? JSON.stringify(options.changes) : null;

    await pool.execute(
      `
        INSERT INTO audit_logs
          (id, pet_id, entity_type, entity_id, action, actor_user_id, actor_role, actor_name, summary, changes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        randomUUID(),
        options.petId,
        options.entityType,
        options.entityId,
        options.action,
        actor.userId,
        actor.role,
        actor.name,
        options.summary.slice(0, 255),
        changes,
      ]
    );
  } catch (error) {
    console.error('recordAudit error', error);
  }
}

function sameValue(a: unknown, b: unknown) {
  const normalize = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  return normalize(a) === normalize(b);
}

/**
 * Compara o antes e o depois e devolve só o que mudou de verdade, já com rótulo em
 * português — salvar campo por campo é o que torna o histórico útil na hora da dúvida.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>
): AuditChange[] {
  const changes: AuditChange[] = [];

  for (const [field, label] of Object.entries(labels)) {
    if (!(field in after)) continue;
    if (sameValue(before[field], after[field])) continue;
    changes.push({ field, label, from: before[field] ?? null, to: after[field] ?? null });
  }

  return changes;
}

export type AuditRow = RowDataPacket & {
  id: string;
  pet_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: AuditAction;
  actor_user_id: string | null;
  actor_role: string | null;
  actor_name: string | null;
  summary: string;
  changes: AuditChange[] | string | null;
  created_at: Date;
};

export function normalizeAuditRow(row: AuditRow) {
  const changes =
    typeof row.changes === 'string'
      ? (() => {
          try {
            return JSON.parse(row.changes) as AuditChange[];
          } catch {
            return [];
          }
        })()
      : row.changes ?? [];

  return {
    id: row.id,
    petId: row.pet_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    actorRole: row.actor_role,
    actorName: row.actor_name,
    summary: row.summary,
    changes,
    createdAt: row.created_at,
  };
}
