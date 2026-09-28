import { Router } from 'express';
import type { RowDataPacket } from '../../db/types.js';
import { pool } from '../../db/index.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { requireAuth } from '../../middlewares/auth.js';
import { canAccessPetHealthData } from '../pets/pet-access.js';
import { normalizeAuditRow, type AuditRow } from './audit.service.js';

// Leitura do histórico de alterações. Só leitura: ninguém edita nem apaga trilha.

const router = Router();

router.use(requireAuth);

/** Histórico de um pet: tudo que foi lançado ou alterado, de quem e quando. */
router.get('/pet/:petId', async (req: AuthRequest, res, next) => {
  try {
    const petId = String(req.params.petId);

    // Quem pode ver os dados de saúde do pet pode ver quem mexeu neles.
    const access = await canAccessPetHealthData(req.user, petId);
    if (!access.allowed) {
      res.status(access.status ?? 403).json({ message: access.message });
      return;
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);

    const [rows] = await pool.query<AuditRow[]>(
      `
        SELECT id, pet_id, entity_type, entity_id, action, actor_user_id, actor_role,
               actor_name, summary, changes, created_at
        FROM audit_logs
        WHERE pet_id = ?
        ORDER BY created_at DESC
        LIMIT ${limit}
      `,
      [petId]
    );

    res.json({ data: rows.map(normalizeAuditRow) });
  } catch (error) {
    next(error);
  }
});

/** Histórico de um registro específico (um exame, uma vacina). */
router.get('/entity/:entityType/:entityId', async (req: AuthRequest, res, next) => {
  try {
    const entityType = String(req.params.entityType);
    const entityId = String(req.params.entityId);

    const [petRows] = await pool.query<RowDataPacket[]>(
      'SELECT pet_id FROM audit_logs WHERE entity_type = ? AND entity_id = ? AND pet_id IS NOT NULL LIMIT 1',
      [entityType, entityId]
    );
    const petId = petRows.length ? String((petRows[0] as { pet_id: string }).pet_id) : null;

    if (!petId) {
      res.json({ data: [] });
      return;
    }

    const access = await canAccessPetHealthData(req.user, petId);
    if (!access.allowed) {
      res.status(access.status ?? 403).json({ message: access.message });
      return;
    }

    const [rows] = await pool.query<AuditRow[]>(
      `
        SELECT id, pet_id, entity_type, entity_id, action, actor_user_id, actor_role,
               actor_name, summary, changes, created_at
        FROM audit_logs
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY created_at DESC
        LIMIT 100
      `,
      [entityType, entityId]
    );

    res.json({ data: rows.map(normalizeAuditRow) });
  } catch (error) {
    next(error);
  }
});

export default router;
