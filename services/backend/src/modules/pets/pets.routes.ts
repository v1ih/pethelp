import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from '../../db/types.js';
import { pool } from '../../db/index.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { requireAuth } from '../../middlewares/auth.js';
import {
  findClinicByConnectionCode,
  findClinicByUserId,
  findTutorByUserId,
  findUserByEmail,
  findVeterinarianByUserId,
} from '../users/users.service.js';
import { canAccessPetHealthData, isTutorGuardianOfPet } from './pet-access.js';

type PetRow = RowDataPacket & {
  id: string;
  current_tutor_id: string | null;
  linked_clinic_id: string | null;
  name: string;
  species: string;
  breed: string | null;
  age: string | null;
  weight: string | null;
  photo: string | null;
  allergies: string | null;
  conditions: string | null;
  sex: string | null;
  neutered: boolean | null;
  is_active: number | boolean;
  created_at: Date;
  updated_at: Date;
};

type DbClient = Pick<PoolConnection, 'execute' | 'query'>;

const petSelectFields = `
  id,
  current_tutor_id,
  linked_clinic_id,
  name,
  species,
  breed,
  age,
  weight,
  photo,
  allergies,
  conditions,
  sex,
  neutered,
  is_active,
  created_at,
  updated_at
`;

function parseNullableJson(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return JSON.stringify(value);
}

function parseSafeJson(value: unknown) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizePet(row: PetRow) {
  const currentTutorId = (row as PetRow & { currentTutorId?: string | null }).currentTutorId ?? row.current_tutor_id;
  const linkedClinicId = (row as PetRow & { linkedClinicId?: string | null }).linkedClinicId ?? row.linked_clinic_id;
  const isActive = (row as PetRow & { isActive?: number | boolean }).isActive ?? row.is_active;

  return {
    id: row.id,
    currentTutorId,
    ownerId: currentTutorId,
    linkedClinicId,
    name: row.name,
    species: row.species,
    breed: row.breed,
    age: row.age,
    weight: row.weight,
    photo: row.photo,
    allergies: parseSafeJson(row.allergies),
    conditions: parseSafeJson(row.conditions),
    sex: row.sex ?? null,
    neutered: row.neutered ?? null,
    isActive: Boolean(isActive),
    createdAt: (row as PetRow & { createdAt?: Date }).createdAt ?? row.created_at,
    updatedAt: (row as PetRow & { updatedAt?: Date }).updatedAt ?? row.updated_at,
  };
}

function getDbClient(db: DbClient | null | undefined) {
  return db ?? pool;
}

function canTutorAccessPet(user: AuthRequest['user'], row: PetRow) {
  return user?.userType === 'tutor' ? row.current_tutor_id === user.id : true;
}

function canManagePet(tutorId: string | null, row: PetRow) {
  return !!tutorId && row.current_tutor_id === tutorId;
}

async function resolveCurrentTutorId(user: AuthRequest['user']) {
  if (user?.userType !== 'tutor') {
    return null;
  }

  const tutor = await findTutorByUserId(user.id);
  return tutor?.id ?? null;
}

async function resolveCurrentClinicId(user: AuthRequest['user']) {
  if (user?.userType !== 'clinic') {
    return null;
  }

  const clinic = await findClinicByUserId(user.id);
  return clinic?.id ?? null;
}

async function resolveCurrentVeterinarianId(user: AuthRequest['user']) {
  if (user?.userType !== 'veterinarian') {
    return null;
  }

  const veterinarian = await findVeterinarianByUserId(user.id);
  return veterinarian?.id ?? null;
}

async function resolveAccessibleClinicIdsForVeterinarian(user: AuthRequest['user']) {
  const veterinarianId = await resolveCurrentVeterinarianId(user);
  if (!veterinarianId) {
    return [];
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT clinic_id
      FROM clinic_veterinarians
      WHERE veterinarian_id = ? AND status = 'approved'
    `,
    [veterinarianId]
  );

  return rows.map((row) => String(row.clinic_id));
}

function normalizeTutorId(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function toBoolean(value: unknown) {
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }

  return Boolean(value);
}

async function insertOwnershipHistory(db: DbClient, petId: string, previousTutorId: string | null, newTutorId: string) {
  await db.execute(
    `
      INSERT INTO pet_ownership_history (
        id,
        pet_id,
        previous_tutor_id,
        new_tutor_id
      ) VALUES (?, ?, ?, ?)
    `,
    [randomUUID(), petId, previousTutorId, newTutorId]
  );
}

async function loadPetById(db: DbClient, petId: string) {
  const [rows] = await db.query<PetRow[]>(`SELECT ${petSelectFields} FROM pets WHERE id = ? LIMIT 1`, [petId]);
  return rows.length ? rows[0] : null;
}

export const petsRouter = Router();

petsRouter.use(requireAuth);

petsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { ownerId, currentTutorId, includeInactive } = req.query;
    const requestedTutorId = typeof currentTutorId === 'string'
      ? currentTutorId
      : typeof ownerId === 'string'
        ? ownerId
        : null;
    const showInactive = includeInactive === 'true' || includeInactive === '1';
    const conditions: string[] = [];
    const values: Array<string | number> = [];
    const tutorId = await resolveCurrentTutorId(req.user);
    const clinicId = await resolveCurrentClinicId(req.user);
    const accessibleClinicIds = req.user?.userType === 'veterinarian' ? await resolveAccessibleClinicIdsForVeterinarian(req.user) : [];

    if (req.user?.userType === 'tutor') {
      if (!tutorId) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      const effectiveTutorId = requestedTutorId ?? tutorId;
      if (requestedTutorId && requestedTutorId !== tutorId) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      // Inclui pets próprios e os compartilhados (guarda compartilhada).
      conditions.push('(current_tutor_id = ? OR id IN (SELECT pet_id FROM pet_guardians WHERE tutor_id = ?))');
      values.push(effectiveTutorId, effectiveTutorId);
    } else if (req.user?.userType === 'clinic') {
      if (!clinicId) {
        res.status(404).json({ message: 'Clinic profile not found' });
        return;
      }

      conditions.push('linked_clinic_id = ?');
      values.push(clinicId);
    } else if (req.user?.userType === 'veterinarian') {
      if (accessibleClinicIds.length === 0) {
        res.json({ data: [] });
        return;
      }

      conditions.push(`linked_clinic_id IN (${accessibleClinicIds.map(() => '?').join(', ')})`);
      values.push(...accessibleClinicIds);
    }

    if (!showInactive) {
      conditions.push('is_active = TRUE');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query<PetRow[]>(`SELECT ${petSelectFields} FROM pets ${whereClause} ORDER BY created_at DESC`, values);

    res.json({
      data: rows.map(normalizePet),
    });
  } catch (error) {
    next(error);
  }
});

petsRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    // Autoriza tutor/guardião, clínica vinculada, veterinário aprovado OU portador de
    // Vet-Pass válido. Dados básicos do pet (idade, peso, alergias, condições) não
    // dependem do escopo do passe — qualquer passe válido libera a identificação.
    const access = await canAccessPetHealthData(req.user, String(req.params.id));
    if (!access.allowed) {
      res.status(access.status ?? 403).json({ message: access.message });
      return;
    }

    const row = await loadPetById(pool, String(req.params.id));
    if (!row) {
      res.status(404).json({ message: 'Pet not found' });
      return;
    }

    res.json({ data: normalizePet(row) });
  } catch (error) {
    next(error);
  }
});

petsRouter.post('/', async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    const tutorId = await resolveCurrentTutorId(req.user);

    if (!tutorId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const body = req.body ?? {};
    const currentTutorId = tutorId;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const species = typeof body.species === 'string' ? body.species.trim() : '';
    const breed = typeof body.breed === 'string' ? body.breed.trim() : null;
    const age = typeof body.age === 'string' ? body.age.trim() : null;
    const weight = typeof body.weight === 'string' ? body.weight.trim() : null;
    const photo = typeof body.photo === 'string' ? body.photo : null;
    const allergies = parseNullableJson(body.allergies);
    const conditions = parseNullableJson(body.conditions);
    const sex = typeof body.sex === 'string' && body.sex.trim() ? body.sex.trim() : null;
    const neutered = body.neutered === undefined || body.neutered === null ? null : toBoolean(body.neutered);

    if (!currentTutorId || !name || !species) {
      res.status(400).json({ message: 'name and species are required' });
      return;
    }

    await connection.beginTransaction();

    const id = randomUUID();
    await connection.execute(
      `
        INSERT INTO pets (
          id,
          current_tutor_id,
          name,
          species,
          breed,
          age,
          weight,
          photo,
          allergies,
          conditions,
          sex,
          neutered
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [id, currentTutorId, name, species, breed, age, weight, photo, allergies, conditions, sex, neutered]
    );

    await connection.commit();

    const row = await loadPetById(pool, id);
    if (!row) {
      res.status(500).json({ message: 'Pet creation failed' });
      return;
    }

    res.status(201).json({ data: normalizePet(row) });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

petsRouter.patch('/:id', async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    const existing = await loadPetById(connection, String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Pet not found' });
      return;
    }

    const tutorId = await resolveCurrentTutorId(req.user);
    if (!canManagePet(tutorId, existing)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const body = req.body ?? {};
    const allowedFields = [
      'currentTutorId',
      'ownerId',
      'name',
      'species',
      'breed',
      'age',
      'weight',
      'photo',
      'allergies',
      'conditions',
      'sex',
      'neutered',
      'isActive',
    ] as const;

    const assignments: string[] = [];
    const values: Array<string | number | boolean | null> = [];
    const nextCurrentTutorId = normalizeTutorId(body.currentTutorId) ?? normalizeTutorId(body.ownerId) ?? undefined;

    if (nextCurrentTutorId && nextCurrentTutorId !== tutorId) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    for (const field of allowedFields) {
      if (body[field] === undefined) {
        continue;
      }

      const columnMap: Record<(typeof allowedFields)[number], string> = {
        currentTutorId: 'current_tutor_id',
        ownerId: 'current_tutor_id',
        name: 'name',
        species: 'species',
        breed: 'breed',
        age: 'age',
        weight: 'weight',
        photo: 'photo',
        allergies: 'allergies',
        conditions: 'conditions',
        sex: 'sex',
        neutered: 'neutered',
        isActive: 'is_active',
      };

      assignments.push(`${columnMap[field]} = ?`);

      if (field === 'allergies' || field === 'conditions') {
        values.push(parseNullableJson(body[field]));
      } else if (field === 'isActive') {
        values.push(toBoolean(body[field]));
      } else if (field === 'neutered') {
        values.push(body[field] === null || body[field] === undefined ? null : toBoolean(body[field]));
      } else if (field === 'currentTutorId' || field === 'ownerId') {
        values.push(nextCurrentTutorId ?? null);
      } else {
        values.push((typeof body[field] === 'string' ? body[field].trim() : body[field]) as string | null);
      }
    }

    if (assignments.length === 0) {
      res.status(400).json({ message: 'No fields provided to update' });
      return;
    }

    await connection.beginTransaction();

    const previousTutorId = existing.current_tutor_id;
    const nextTutorId = nextCurrentTutorId ?? existing.current_tutor_id;

    values.push(String(req.params.id));
    const [result] = await connection.execute<ResultSetHeader>(`UPDATE pets SET ${assignments.join(', ')} WHERE id = ?`, values);

    if ((result.affectedRows ?? 0) === 0) {
      await connection.rollback();
      res.status(404).json({ message: 'Pet not found' });
      return;
    }

    if (typeof nextTutorId === 'string' && nextTutorId.length > 0 && nextTutorId !== previousTutorId) {
      await insertOwnershipHistory(connection, String(req.params.id), previousTutorId, nextTutorId);
    }

    await connection.commit();

    const updated = await loadPetById(pool, String(req.params.id));
    if (!updated) {
      res.status(500).json({ message: 'Pet update failed' });
      return;
    }

    res.json({ data: normalizePet(updated) });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

petsRouter.post('/:id/transfer', async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    const existing = await loadPetById(connection, String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Pet not found' });
      return;
    }

    const tutorId = await resolveCurrentTutorId(req.user);
    if (!canManagePet(tutorId, existing)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const body = req.body ?? {};
    const targetTutorEmail = typeof body.targetTutorEmail === 'string' ? body.targetTutorEmail.trim().toLowerCase() : '';
    const securityConfirmation = typeof body.securityConfirmation === 'string' ? body.securityConfirmation.trim() : '';
    const petNameConfirmation = typeof body.petNameConfirmation === 'string' ? body.petNameConfirmation.trim() : '';

    if (!targetTutorEmail || !securityConfirmation || !petNameConfirmation) {
      res.status(400).json({ message: 'targetTutorEmail, securityConfirmation and petNameConfirmation are required' });
      return;
    }

    if (petNameConfirmation.toLowerCase() !== existing.name.trim().toLowerCase()) {
      res.status(403).json({ message: 'Security confirmation does not match the selected pet' });
      return;
    }

    if (securityConfirmation.toUpperCase() !== 'TRANSFERIR') {
      res.status(403).json({ message: 'Security confirmation is invalid' });
      return;
    }

    const targetUser = await findUserByEmail(targetTutorEmail);
    if (!targetUser || targetUser.user_type !== 'tutor') {
      res.status(404).json({ message: 'Target tutor not found' });
      return;
    }

    const targetTutor = await findTutorByUserId(targetUser.id);
    if (!targetTutor) {
      res.status(404).json({ message: 'Target tutor profile not found' });
      return;
    }

    if (targetTutor.id === existing.current_tutor_id) {
      res.status(400).json({ message: 'The pet is already assigned to this tutor' });
      return;
    }

    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      'UPDATE pets SET current_tutor_id = ? WHERE id = ?',
      [targetTutor.id, String(req.params.id)]
    );

    if ((result.affectedRows ?? 0) === 0) {
      await connection.rollback();
      res.status(404).json({ message: 'Pet not found' });
      return;
    }

    await insertOwnershipHistory(connection, String(req.params.id), existing.current_tutor_id, targetTutor.id);
    await connection.commit();

    const updated = await loadPetById(pool, String(req.params.id));
    if (!updated) {
      res.status(500).json({ message: 'Pet transfer failed' });
      return;
    }

    res.json({ data: normalizePet(updated), message: 'Pet transfer completed successfully' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});
petsRouter.delete('/:id', async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    const existing = await loadPetById(connection, String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Pet not found' });
      return;
    }

    const tutorId = await resolveCurrentTutorId(req.user);
    if (!canManagePet(tutorId, existing)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    await connection.execute<ResultSetHeader>('UPDATE pets SET is_active = FALSE WHERE id = ?', [String(req.params.id)]);
    res.status(204).send();
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
});

petsRouter.post('/:id/link-clinic', async (req: AuthRequest, res, next) => {
  const connection = await pool.getConnection();

  try {
    const existing = await loadPetById(connection, String(req.params.id));
    if (!existing) {
      res.status(404).json({ message: 'Pet not found' });
      return;
    }

    const tutorId = await resolveCurrentTutorId(req.user);
    if (!canManagePet(tutorId, existing)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const connectionCode = typeof req.body?.connectionCode === 'string' ? req.body.connectionCode.trim().toUpperCase() : '';
    if (!connectionCode) {
      res.status(400).json({ message: 'connectionCode is required' });
      return;
    }

    const clinic = await findClinicByConnectionCode(connectionCode);
    if (!clinic) {
      res.status(404).json({ message: 'Clinic not found' });
      return;
    }

    await connection.beginTransaction();
    await connection.execute<ResultSetHeader>(
      'UPDATE pets SET linked_clinic_id = ? WHERE id = ?',
      [clinic.id, String(req.params.id)]
    );
    await connection.commit();

    const updated = await loadPetById(connection, String(req.params.id));
    if (!updated) {
      res.status(500).json({ message: 'Pet link update failed' });
      return;
    }

    res.json({
      data: normalizePet(updated),
      message: 'Pet linked to clinic successfully',
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

// ---- Guarda compartilhada (co-responsáveis pelo animal) ----

type GuardianRow = RowDataPacket & {
  tutor_id: string;
  name: string;
  email: string;
  is_primary: boolean;
};

async function loadPetGuardians(petId: string) {
  const [rows] = await pool.query<GuardianRow[]>(
    `
      SELECT t.id AS tutor_id, t.name AS name, u.email AS email, TRUE AS is_primary
      FROM pets p
      JOIN tutors t ON t.id = p.current_tutor_id
      JOIN users u ON u.id = t.user_id
      WHERE p.id = ?
      UNION ALL
      SELECT t.id AS tutor_id, t.name AS name, u.email AS email, FALSE AS is_primary
      FROM pet_guardians g
      JOIN tutors t ON t.id = g.tutor_id
      JOIN users u ON u.id = t.user_id
      WHERE g.pet_id = ?
      ORDER BY is_primary DESC, name ASC
    `,
    [petId, petId]
  );

  return rows.map((row) => ({
    tutorId: String(row.tutor_id),
    name: row.name,
    email: row.email,
    isPrimary: Boolean(row.is_primary),
  }));
}

/** Lists the primary owner plus any shared guardians of the pet. */
petsRouter.get('/:id/guardians', async (req: AuthRequest, res, next) => {
  try {
    const pet = await loadPetById(pool, String(req.params.id));
    if (!pet) {
      res.status(404).json({ message: 'Pet not found' });
      return;
    }

    const tutorId = await resolveCurrentTutorId(req.user);
    const canView = Boolean(tutorId) && (pet.current_tutor_id === tutorId || (await isTutorGuardianOfPet(pet.id, tutorId!)));
    if (!canView) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    res.json({ data: await loadPetGuardians(pet.id) });
  } catch (error) {
    next(error);
  }
});

/** Adds a shared guardian (by e-mail) to the pet. Only the primary owner can do this. */
petsRouter.post('/:id/guardians', async (req: AuthRequest, res, next) => {
  try {
    const pet = await loadPetById(pool, String(req.params.id));
    if (!pet) {
      res.status(404).json({ message: 'Pet not found' });
      return;
    }

    const tutorId = await resolveCurrentTutorId(req.user);
    if (!canManagePet(tutorId, pet)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) {
      res.status(400).json({ message: 'email is required' });
      return;
    }

    const targetUser = await findUserByEmail(email);
    if (!targetUser || targetUser.user_type !== 'tutor') {
      res.status(404).json({ message: 'Nenhum responsável encontrado com esse e-mail' });
      return;
    }

    const targetTutor = await findTutorByUserId(targetUser.id);
    if (!targetTutor) {
      res.status(404).json({ message: 'Perfil do responsável não encontrado' });
      return;
    }

    if (targetTutor.id === pet.current_tutor_id) {
      res.status(400).json({ message: 'Esse responsável já é o responsável principal do pet' });
      return;
    }

    await pool.execute(
      'INSERT INTO pet_guardians (id, pet_id, tutor_id) VALUES (?, ?, ?) ON CONFLICT (pet_id, tutor_id) DO NOTHING',
      [randomUUID(), pet.id, targetTutor.id]
    );

    res.status(201).json({ data: await loadPetGuardians(pet.id) });
  } catch (error) {
    next(error);
  }
});

/** Removes a shared guardian from the pet. Only the primary owner can do this. */
petsRouter.delete('/:id/guardians/:tutorId', async (req: AuthRequest, res, next) => {
  try {
    const pet = await loadPetById(pool, String(req.params.id));
    if (!pet) {
      res.status(404).json({ message: 'Pet not found' });
      return;
    }

    const tutorId = await resolveCurrentTutorId(req.user);
    if (!canManagePet(tutorId, pet)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    await pool.execute('DELETE FROM pet_guardians WHERE pet_id = ? AND tutor_id = ?', [pet.id, String(req.params.tutorId)]);
    res.json({ data: await loadPetGuardians(pet.id) });
  } catch (error) {
    next(error);
  }
});

