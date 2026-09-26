import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from '../../db/types.js';
import { pool } from '../../db/index.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { requireAuth } from '../../middlewares/auth.js';
import { findTutorByUserId, findUserById } from '../users/users.service.js';
import { codeEmailTemplate, sendEmail } from '../mail/mailer.js';

type VetPassRow = RowDataPacket & {
  id: string;
  pass_code: string;
  tutor_id: string;
  pet_id: string;
  pet_name: string;
  documents: string;
  redeemed_by_user_id: string | null;
  created_at: Date;
  expires_at: Date | string;
  redeemed_at: Date | string | null;
  updated_at: Date;
  includes_medical_records: boolean;
  includes_vaccines: boolean;
  includes_exams: boolean;
  redeemed_name?: string | null;
  redeemed_type?: 'veterinarian' | 'clinic' | null;
  redeemed_email?: string | null;
};

type DbClient = Pick<PoolConnection, 'execute' | 'query'>;

const router = Router();

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseDocuments(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parseDocuments(parsed);
    } catch {
      return [];
    }
  }

  if (typeof value === 'object') {
    return [value];
  }

  return [];
}

function normalizeVetPass(row: VetPassRow) {
  return {
    id: row.id,
    code: row.pass_code,
    tutorId: row.tutor_id,
    petId: row.pet_id,
    petName: row.pet_name,
    documents: parseDocuments(row.documents),
    redeemedByUserId: row.redeemed_by_user_id ?? undefined,
    createdAt: row.created_at,
    expiresAt: typeof row.expires_at === 'string' ? row.expires_at : row.expires_at.toISOString(),
    redeemedAt:
      row.redeemed_at === null
        ? undefined
        : typeof row.redeemed_at === 'string'
          ? row.redeemed_at
          : row.redeemed_at.toISOString(),
    updatedAt: row.updated_at,
    includesMedicalRecords: row.includes_medical_records,
    includesVaccines: row.includes_vaccines,
    includesExams: row.includes_exams,
    redeemedByName: row.redeemed_name ?? undefined,
    redeemedByType: row.redeemed_type ?? undefined,
    redeemedByEmail: row.redeemed_email ?? undefined,
  };
}

async function resolveCurrentTutorId(user: AuthRequest['user']) {
  if (user?.userType !== 'tutor') return null;
  const tutor = await findTutorByUserId(user.id);
  return tutor?.id ?? null;
}

async function loadVetPassByCode(db: DbClient, code: string) {
  const [rows] = await db.query<VetPassRow[]>(
    `
      SELECT
        id,
        pass_code,
        tutor_id,
        pet_id,
        pet_name,
        documents,
        redeemed_by_user_id,
        created_at,
        expires_at,
        redeemed_at,
        updated_at,
        includes_medical_records,
        includes_vaccines,
        includes_exams
      FROM vet_passes
      WHERE pass_code = ?
      LIMIT 1
    `,
    [code]
  );

  return rows[0] ?? null;
}

async function loadPetById(db: DbClient, petId: string) {
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT id, current_tutor_id, name FROM pets WHERE id = ? LIMIT 1',
    [petId]
  );

  return rows[0] as { id: string; current_tutor_id: string | null; name: string } | undefined;
}

router.use(requireAuth);

router.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const tutorId = await resolveCurrentTutorId(req.user);
    if (!tutorId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const [rows] = await pool.query<VetPassRow[]>(
      `
        SELECT
          vp.*,
          COALESCE(v.name, c.trade_name) AS redeemed_name,
          CASE WHEN v.id IS NOT NULL THEN 'veterinarian' WHEN c.id IS NOT NULL THEN 'clinic' END AS redeemed_type,
          u.email AS redeemed_email
        FROM vet_passes vp
        LEFT JOIN users u ON u.id = vp.redeemed_by_user_id
        LEFT JOIN veterinarians v ON v.user_id = vp.redeemed_by_user_id
        LEFT JOIN clinics c ON c.user_id = vp.redeemed_by_user_id
        WHERE vp.tutor_id = ?
        ORDER BY vp.created_at DESC
      `,
      [tutorId]
    );

    res.json({ data: rows.map(normalizeVetPass) });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    const tutorId = await resolveCurrentTutorId(req.user);
    if (!tutorId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const body = req.body ?? {};
    const petId = asTrimmedString(body.petId);
    const petName = asTrimmedString(body.petName);
    const documents = parseDocuments(body.documents);
    const rawDays = Number(body.expiresInDays);
    // Validade configurável pelo responsável (1 a 90 dias), padrão 30.
    const expiresInDays = Number.isFinite(rawDays) ? Math.min(90, Math.max(1, Math.round(rawDays))) : 30;
    // Escopo por categoria: quando o campo não vier, mantém TRUE (compatível com o comportamento antigo).
    const includesMedicalRecords = body.includesMedicalRecords === undefined ? true : Boolean(body.includesMedicalRecords);
    const includesVaccines = body.includesVaccines === undefined ? true : Boolean(body.includesVaccines);
    const includesExams = body.includesExams === undefined ? true : Boolean(body.includesExams);

    const pet = await loadPetById(connection, petId);
    if (!pet || pet.current_tutor_id !== tutorId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    // Anexos são opcionais: dá para gerar um Vet-Pass mesmo sem exames anexados.
    if (!petId || !petName) {
      res.status(400).json({ message: 'petId and petName are required' });
      return;
    }

    const passCode = asTrimmedString(body.code) || `VET-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    await connection.beginTransaction();
    const id = randomUUID();
    await connection.execute(
      `
        INSERT INTO vet_passes (
          id,
          pass_code,
          tutor_id,
          pet_id,
          pet_name,
          documents,
          redeemed_by_user_id,
          expires_at,
          redeemed_at,
          includes_medical_records,
          includes_vaccines,
          includes_exams
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [id, passCode, tutorId, petId, petName, JSON.stringify(documents), null, expiresAt, null, includesMedicalRecords, includesVaccines, includesExams]
    );
    await connection.commit();

    const created = await loadVetPassByCode(pool, passCode);
    if (!created) {
      res.status(500).json({ message: 'Vet-Pass creation failed' });
      return;
    }

    res.status(201).json({ data: normalizeVetPass(created) });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.post('/:code/redeem', async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    const passCode = String(req.params.code).trim().toUpperCase();
    if (!passCode) {
      res.status(400).json({ message: 'code is required' });
      return;
    }

    const pass = await loadVetPassByCode(connection, passCode);
    if (!pass) {
      res.status(404).json({ message: 'Vet-Pass not found' });
      return;
    }

    if (new Date(pass.expires_at).getTime() < Date.now()) {
      res.status(410).json({ message: 'Vet-Pass expired' });
      return;
    }

    if (req.user?.userType !== 'veterinarian') {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    if (pass.redeemed_by_user_id && pass.redeemed_by_user_id !== req.user.id) {
      res.status(409).json({ message: 'Vet-Pass has already been redeemed by another veterinarian' });
      return;
    }

    await connection.beginTransaction();
    await connection.execute(
      'UPDATE vet_passes SET redeemed_by_user_id = ?, redeemed_at = COALESCE(redeemed_at, CURRENT_TIMESTAMP) WHERE pass_code = ?',
      [req.user.id, passCode]
    );
    await connection.commit();

    const updated = await loadVetPassByCode(pool, passCode);
    if (!updated) {
      res.status(500).json({ message: 'Vet-Pass redemption failed' });
      return;
    }

    res.json({ data: normalizeVetPass(updated) });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

/** Envia o código do Vet-Pass por e-mail para o próprio responsável (backup). */
router.post('/:code/email', async (req: AuthRequest, res, next) => {
  try {
    const tutorId = await resolveCurrentTutorId(req.user);
    if (!tutorId || !req.user?.id) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const code = String(req.params.code).trim().toUpperCase();
    const pass = await loadVetPassByCode(pool, code);
    if (!pass || pass.tutor_id !== tutorId) {
      res.status(404).json({ message: 'Vet-Pass not found' });
      return;
    }

    const owner = await findUserById(req.user.id);
    const email = owner?.email;
    if (!email) {
      res.status(404).json({ message: 'E-mail do responsável não encontrado' });
      return;
    }

    const expira = new Date(pass.expires_at).toLocaleDateString('pt-BR');
    const escopos = [
      pass.includes_medical_records ? 'Prontuário' : null,
      pass.includes_vaccines ? 'Vacinas' : null,
      pass.includes_exams ? 'Exames' : null,
    ].filter(Boolean).join(', ') || 'Nenhum';

    const { sent } = await sendEmail(
      email,
      `Seu Vet-Pass do pet ${pass.pet_name} — PetHelp`,
      codeEmailTemplate(
        'Seu Vet-Pass (backup)',
        `Guarde este código para liberar o atendimento de ${pass.pet_name} a um veterinário.`,
        pass.pass_code,
        `Libera: ${escopos}. Válido até ${expira}. Não compartilhe com pessoas que você não autorizou.`
      )
    );

    res.json({ data: { sent, email } });
  } catch (error) {
    next(error);
  }
});

router.get('/:code', async (req: AuthRequest, res, next) => {
  try {
    const code = String(req.params.code).trim().toUpperCase();
    const pass = await loadVetPassByCode(pool, code);
    if (!pass) {
      res.status(404).json({ message: 'Vet-Pass not found' });
      return;
    }

    if (req.user?.userType === 'tutor') {
      const tutorId = await resolveCurrentTutorId(req.user);
      if (!tutorId || pass.tutor_id !== tutorId) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }
    }

    if (req.user?.userType === 'veterinarian' && pass.redeemed_by_user_id !== req.user.id) {
      res.status(403).json({ message: 'Redeem this Vet-Pass before accessing its documents' });
      return;
    }

    res.json({ data: normalizeVetPass(pass) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:code', async (req: AuthRequest, res, next) => {
  try {
    const code = String(req.params.code).trim().toUpperCase();
    const pass = await loadVetPassByCode(pool, code);
    if (!pass) {
      res.status(404).json({ message: 'Vet-Pass not found' });
      return;
    }

    const tutorId = await resolveCurrentTutorId(req.user);
    if (!tutorId || pass.tutor_id !== tutorId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    // Quem está com o passe é uma clínica? Então encerrar o compartilhamento também
    // desfaz o vínculo do pet com ela — senão a clínica continuaria enxergando o
    // prontuário pelo vínculo e o "Encerrar" não cumpriria o que promete.
    const [clinicRows] = pass.redeemed_by_user_id
      ? await pool.query<RowDataPacket[]>('SELECT id, trade_name FROM clinics WHERE user_id = ? LIMIT 1', [
          pass.redeemed_by_user_id,
        ])
      : [[] as RowDataPacket[]];
    const holderClinic = clinicRows[0];

    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM vet_passes WHERE pass_code = ?', [code]);
    if ((result.affectedRows ?? 0) === 0) {
      res.status(404).json({ message: 'Vet-Pass not found' });
      return;
    }

    let unlinkedClinicName: string | null = null;
    if (holderClinic) {
      const [unlink] = await pool.execute<ResultSetHeader>(
        'UPDATE pets SET linked_clinic_id = NULL WHERE id = ? AND linked_clinic_id = ?',
        [pass.pet_id, String(holderClinic.id)]
      );
      if ((unlink.affectedRows ?? 0) > 0) {
        unlinkedClinicName = String(holderClinic.trade_name);
      }
    }

    res.json({ message: 'Compartilhamento encerrado.', unlinkedClinicName });
  } catch (error) {
    next(error);
  }
});

export default router;

