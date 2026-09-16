import { randomUUID } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from '../../db/types.js';
import { pool } from '../../db/index.js';

export type UserType = 'tutor' | 'clinic' | 'veterinarian';

type DbClient = Pick<PoolConnection, 'execute' | 'query'>;

type AuthUserRow = RowDataPacket & {
  id: string;
  email: string;
  password_hash: string;
  user_type: UserType;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

type TutorRow = RowDataPacket & {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  cpf: string | null;
  created_at: Date;
  updated_at: Date;
};

type ClinicRow = RowDataPacket & {
  id: string;
  user_id: string;
  trade_name: string;
  corporate_name: string | null;
  cnpj: string | null;
  phone: string | null;
  address: string | null;
  connection_code: string | null;
  services: string | null;
  working_hours: string | null;
  created_at: Date;
  updated_at: Date;
};

type VeterinarianRow = RowDataPacket & {
  id: string;
  user_id: string;
  name: string;
  crmv: string;
  crmv_uf: string;
  specialty: string | null;
  phone: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CreateAuthUserInput = {
  email: string;
  password_hash: string;
  user_type: UserType;
};

export type CreateTutorProfileInput = {
  name: string;
  phone?: string | null;
  cpf?: string | null;
};

export type UpdateTutorProfileInput = {
  name?: string;
  phone?: string | null;
  cpf?: string | null;
  email?: string;
};

export type CreateClinicProfileInput = {
  trade_name: string;
  corporate_name?: string | null;
  cnpj?: string | null;
  phone?: string | null;
  address: string | null;
  connection_code?: string | null;
  services?: string | null;
  working_hours?: string | null;
};

export type UpdateClinicProfileInput = {
  trade_name?: string;
  corporate_name?: string | null;
  cnpj?: string | null;
  phone?: string | null;
  address?: string;
  services?: string | null;
  working_hours?: string | null;
};

export type CreateVeterinarianProfileInput = {
  name: string;
  crmv: string;
  crmv_uf: string;
  specialty?: string | null;
  phone?: string | null;
};

export type UpdateVeterinarianProfileInput = {
  name?: string;
  email?: string;
  crmv?: string;
  crmv_uf?: string;
  specialty?: string | null;
  phone?: string | null;
};

export type PublicUserRecord = {
  id: string;
  email: string;
  user_type: UserType;
  userType: UserType;
  name: string;
  phone: string | null;
  cpf: string | null;
  specialty: string | null;
  trade_name: string | null;
  corporate_name: string | null;
  cnpj: string | null;
  address: string | null;
  connection_code: string | null;
  services: string[] | null;
  working_hours: Record<string, unknown> | null;
  crmv: string | null;
  crmv_uf: string | null;
  clinic_name: string | null;
  created_at: Date;
  updated_at: Date;
};

function getDbClient(db: DbClient | null | undefined) {
  return db ?? pool;
}

export async function createAuthUser(input: CreateAuthUserInput, db?: DbClient) {
  const client = getDbClient(db);
  const id = randomUUID();

  await client.execute(
    `INSERT INTO users (id, email, password_hash, user_type)
     VALUES (?, ?, ?, ?)`,
    [id, input.email, input.password_hash, input.user_type]
  );

  return id;
}

export async function createTutorProfile(userId: string, input: CreateTutorProfileInput, db?: DbClient) {
  const client = getDbClient(db);
  const id = randomUUID();

  await client.execute(
    `INSERT INTO tutors (id, user_id, name, phone, cpf)
     VALUES (?, ?, ?, ?, ?)`,
    [id, userId, input.name, input.phone ?? null, input.cpf ?? null]
  );

  return id;
}

export async function updateTutorProfile(userId: string, input: UpdateTutorProfileInput, db?: DbClient) {
  const client = getDbClient(db);
  const assignments: string[] = [];
  const values: Array<string | null> = [];

  if (input.name !== undefined) {
    assignments.push('name = ?');
    values.push(input.name);
  }

  if (input.phone !== undefined) {
    assignments.push('phone = ?');
    values.push(input.phone);
  }

  if (input.cpf !== undefined) {
    assignments.push('cpf = ?');
    values.push(input.cpf);
  }

  if (assignments.length === 0 && input.email === undefined) {
    return null;
  }

  if (input.email !== undefined) {
    await client.execute(`UPDATE users SET email = ? WHERE id = ?`, [input.email, userId]);
  }

  if (assignments.length === 0) {
    return null;
  }

  await client.execute(
    `UPDATE tutors SET ${assignments.join(', ')} WHERE user_id = ?`,
    [...values, userId]
  );

  return null;
}

export async function deleteUserProfile(userId: string, db?: DbClient) {
  const client = getDbClient(db);
  await client.execute(`DELETE FROM users WHERE id = ?`, [userId]);
}

export async function createClinicProfile(userId: string, input: CreateClinicProfileInput, db?: DbClient) {
  const client = getDbClient(db);
  const id = randomUUID();
  const connectionCode = input.connection_code ?? randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();

  await client.execute(
    `INSERT INTO clinics (id, user_id, trade_name, corporate_name, cnpj, phone, address, connection_code, services, working_hours)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      input.trade_name,
      input.corporate_name ?? null,
      input.cnpj ?? null,
      input.phone ?? null,
      input.address ?? null,
      connectionCode,
      input.services ?? null,
      input.working_hours ?? null,
    ]
  );

  return id;
}

export async function updateClinicProfile(userId: string, input: UpdateClinicProfileInput, db?: DbClient) {
  const client = getDbClient(db);
  const assignments: string[] = [];
  const values: Array<string | null> = [];

  if (input.trade_name !== undefined) {
    assignments.push('trade_name = ?');
    values.push(input.trade_name);
  }

  if (input.corporate_name !== undefined) {
    assignments.push('corporate_name = ?');
    values.push(input.corporate_name);
  }

  if (input.cnpj !== undefined) {
    assignments.push('cnpj = ?');
    values.push(input.cnpj);
  }

  if (input.phone !== undefined) {
    assignments.push('phone = ?');
    values.push(input.phone);
  }

  if (input.address !== undefined) {
    assignments.push('address = ?');
    values.push(input.address);
  }

  if (input.services !== undefined) {
    assignments.push('services = ?');
    values.push(input.services);
  }

  if (input.working_hours !== undefined) {
    assignments.push('working_hours = ?');
    values.push(input.working_hours);
  }

  if (assignments.length === 0) {
    return null;
  }

  await client.execute(
    `UPDATE clinics SET ${assignments.join(', ')} WHERE user_id = ?`,
    [...values, userId]
  );

  return null;
}

export async function createVeterinarianProfile(userId: string, input: CreateVeterinarianProfileInput, db?: DbClient) {
  const client = getDbClient(db);
  const id = randomUUID();

  await client.execute(
    `INSERT INTO veterinarians (id, user_id, name, crmv, crmv_uf, specialty, phone)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, input.name, input.crmv, input.crmv_uf, input.specialty ?? null, input.phone ?? null]
  );

  return id;
}

export async function updateVeterinarianProfile(userId: string, input: UpdateVeterinarianProfileInput, db?: DbClient) {
  const client = getDbClient(db);
  const assignments: string[] = [];
  const values: Array<string | null> = [];

  if (input.name !== undefined) {
    assignments.push('name = ?');
    values.push(input.name);
  }

  if (input.email !== undefined) {
    await client.execute(`UPDATE users SET email = ? WHERE id = ?`, [input.email, userId]);
  }

  if (input.crmv !== undefined) {
    assignments.push('crmv = ?');
    values.push(input.crmv);
  }

  if (input.crmv_uf !== undefined) {
    assignments.push('crmv_uf = ?');
    values.push(input.crmv_uf);
  }

  if (input.specialty !== undefined) {
    assignments.push('specialty = ?');
    values.push(input.specialty);
  }

  if (input.phone !== undefined) {
    assignments.push('phone = ?');
    values.push(input.phone);
  }

  if (assignments.length === 0) {
    return null;
  }

  await client.execute(
    `UPDATE veterinarians SET ${assignments.join(', ')} WHERE user_id = ?`,
    [...values, userId]
  );

  return null;
}

export async function findUserByEmail(email: string) {
  const [rows] = await pool.query<AuthUserRow[]>(`SELECT * FROM users WHERE email = ? LIMIT 1`, [email]);
  return rows.length ? rows[0] : null;
}

export async function findUserById(id: string) {
  const [rows] = await pool.query<AuthUserRow[]>(`SELECT * FROM users WHERE id = ? LIMIT 1`, [id]);
  return rows.length ? rows[0] : null;
}

export async function findTutorByUserId(userId: string, db?: DbClient) {
  const client = getDbClient(db);
  const [rows] = await client.query<TutorRow[]>(`SELECT * FROM tutors WHERE user_id = ? LIMIT 1`, [userId]);
  return rows.length ? rows[0] : null;
}

export async function findClinicByUserId(userId: string, db?: DbClient) {
  const client = getDbClient(db);
  const [rows] = await client.query<ClinicRow[]>(`SELECT * FROM clinics WHERE user_id = ? LIMIT 1`, [userId]);
  return rows.length ? rows[0] : null;
}

export async function findClinicByConnectionCode(connectionCode: string, db?: DbClient) {
  const client = getDbClient(db);
  const [rows] = await client.query<ClinicRow[]>(`SELECT * FROM clinics WHERE connection_code = ? LIMIT 1`, [connectionCode]);
  return rows.length ? rows[0] : null;
}

export async function findVeterinarianByUserId(userId: string, db?: DbClient) {
  const client = getDbClient(db);
  const [rows] = await client.query<VeterinarianRow[]>(`SELECT * FROM veterinarians WHERE user_id = ? LIMIT 1`, [userId]);
  return rows.length ? rows[0] : null;
}

function toPublicUserRecord(user: AuthUserRow, profile: TutorRow | ClinicRow | VeterinarianRow): PublicUserRecord {
  if (user.user_type === 'tutor') {
    const tutor = profile as TutorRow;
    return {
      id: user.id,
      email: user.email,
      user_type: user.user_type,
      userType: user.user_type,
      name: tutor.name,
      phone: tutor.phone,
      cpf: tutor.cpf,
      trade_name: null,
      corporate_name: null,
      cnpj: null,
      address: null,
      connection_code: null,
      services: null,
      working_hours: null,
      crmv: null,
      crmv_uf: null,
      specialty: null,
      clinic_name: null,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  if (user.user_type === 'clinic') {
    const clinic = profile as ClinicRow;
    return {
      id: user.id,
      email: user.email,
      user_type: user.user_type,
      userType: user.user_type,
      name: clinic.trade_name,
      phone: clinic.phone,
      cpf: null,
      trade_name: clinic.trade_name,
      corporate_name: clinic.corporate_name,
      cnpj: clinic.cnpj,
      address: clinic.address,
      connection_code: clinic.connection_code,
      services: parseServices(clinic.services),
      working_hours: parseObjectJson(clinic.working_hours),
      crmv: null,
      crmv_uf: null,
      specialty: null,
      clinic_name: clinic.trade_name,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  const veterinarian = profile as VeterinarianRow;
  return {
    id: user.id,
    email: user.email,
    user_type: user.user_type,
    userType: user.user_type,
    name: veterinarian.name,
    phone: veterinarian.phone,
    cpf: null,
    trade_name: null,
    corporate_name: null,
    cnpj: null,
    address: null,
    connection_code: null,
    services: null,
    working_hours: null,
    crmv: veterinarian.crmv,
    crmv_uf: veterinarian.crmv_uf,
    specialty: veterinarian.specialty,
    clinic_name: null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export async function getUserProfileById(id: string) {
  const user = await findUserById(id);
  if (!user) {
    return null;
  }

  if (user.user_type === 'tutor') {
    const [rows] = await pool.query<TutorRow[]>(`SELECT * FROM tutors WHERE user_id = ? LIMIT 1`, [id]);
    if (!rows.length) return null;
    return toPublicUserRecord(user, rows[0]);
  }

  if (user.user_type === 'clinic') {
    const [rows] = await pool.query<ClinicRow[]>(`SELECT * FROM clinics WHERE user_id = ? LIMIT 1`, [id]);
    if (!rows.length) return null;
    return toPublicUserRecord(user, rows[0]);
  }

  const [rows] = await pool.query<VeterinarianRow[]>(`SELECT * FROM veterinarians WHERE user_id = ? LIMIT 1`, [id]);
  if (!rows.length) return null;
  return toPublicUserRecord(user, rows[0]);
}

export async function getUserProfileByEmail(email: string) {
  const user = await findUserByEmail(email);
  if (!user) {
    return null;
  }

  return getUserProfileById(user.id);
}

function parseServices(value: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
  } catch {
    return value
      .split(',')
      .map((service) => service.trim())
      .filter(Boolean);
  }

  return null;
}

function parseObjectJson(value: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

export async function listTutorProfiles() {
  const [rows] = await pool.query<AuthUserRow[]>(`SELECT id FROM users WHERE user_type = 'tutor' ORDER BY created_at DESC`);
  const profiles = await Promise.all(rows.map(row => getUserProfileById(row.id)));
  return profiles.filter((profile): profile is PublicUserRecord => profile !== null);
}


export async function listClinicProfiles(query?: string) {
  const search = query?.trim().toLowerCase() ?? '';
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT u.id
      FROM users u
      INNER JOIN clinics c ON c.user_id = u.id
      WHERE u.user_type = 'clinic'
        AND (
          ? = ''
          OR LOWER(c.trade_name) LIKE ?
          OR LOWER(COALESCE(c.corporate_name, '')) LIKE ?
          OR LOWER(COALESCE(c.address, '')) LIKE ?
          OR LOWER(COALESCE(c.connection_code, '')) LIKE ?
        )
      ORDER BY c.trade_name ASC
      LIMIT 50
    `,
    [search, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
  );

  const profiles = await Promise.all(rows.map((row) => getUserProfileById(String(row.id))));
  return profiles.filter((profile): profile is PublicUserRecord => profile !== null && profile.user_type === 'clinic');
}

export async function listVeterinarianProfiles(query?: string, specialty?: string, clinicId?: string) {
  const search = query?.trim().toLowerCase() ?? '';
  const specialtySearch = specialty?.trim().toLowerCase() ?? '';
  const clinicFilter = clinicId?.trim() ?? '';
  const whereParts = [
    `u.user_type = 'veterinarian'`,
    `(
      ? = ''
      OR LOWER(v.name) LIKE ?
      OR LOWER(COALESCE(v.crmv, '')) LIKE ?
      OR LOWER(COALESCE(v.specialty, '')) LIKE ?
    )`,
    `(? = '' OR LOWER(COALESCE(v.specialty, '')) LIKE ?)`,
  ];
  const values: Array<string> = [search, `%${search}%`, `%${search}%`, `%${search}%`, specialtySearch, `%${specialtySearch}%`];

  if (clinicFilter) {
    whereParts.push(`EXISTS (
      SELECT 1
      FROM clinic_veterinarians cv
      JOIN clinics cl ON cl.id = cv.clinic_id
      WHERE cv.veterinarian_id = v.id
        AND (cl.id = ? OR cl.user_id = ?)
        AND cv.status = 'approved'
    )`);
    values.push(clinicFilter, clinicFilter);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT DISTINCT u.id, v.name
      FROM users u
      INNER JOIN veterinarians v ON v.user_id = u.id
      WHERE ${whereParts.join(' AND ')}
      ORDER BY v.name ASC
      LIMIT 50
    `,
    values
  );

  const profiles = await Promise.all(rows.map((row) => getUserProfileById(String(row.id))));
  return profiles.filter((profile): profile is PublicUserRecord => profile !== null && profile.user_type === 'veterinarian');
}
