export type UserType = 'owner' | 'clinic' | 'veterinarian';

export interface Pet {
  id: string;
  currentTutorId: string | null;
  ownerId: string | null;
  name: string;
  species: string | null;
  age: string | null;
  breed: string | null;
  weight: string | null;
  photo: string | null;
  allergies: string[] | null;
  conditions: string[] | null;
  linkedClinicId?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type PetMutationPayload = {
  currentTutorId?: string | null;
  ownerId?: string | null;
  name?: string;
  species?: string | null;
  age?: string | null;
  breed?: string | null;
  weight?: string | null;
  photo?: string | null;
  allergies?: string[] | null;
  conditions?: string[] | null;
  isActive?: boolean;
  linkedClinicId?: string | null;
};

export interface MedicalRecord {
  id: string;
  petId: string;
  date: string;
  description: string;
  treatment?: string;
  clinicId?: string;
  clinicName?: string;
  veterinarianName?: string;
  documents?: string[];
}

export interface ExamDocument {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface Vaccine {
  id: string;
  petId: string;
  name: string;
  date: string;
  nextDose?: string;
  status: 'up-to-date' | 'late';
  veterinarian?: string;
  clinicId?: string;
  clinicName?: string;
}

export interface Appointment {
  id: string;
  petId: string;
  petName: string;
  clinicId?: string | null;
  clinicName?: string | null;
  veterinarianId?: string | null;
  veterinarianName?: string | null;
  veterinarianEmail?: string | null;
  veterinarianPhone?: string | null;
  vetPassCode?: string;
  targetType?: 'clinic' | 'veterinarian';
  date: string;
  time: string;
  reason: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  ownerId: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'vaccine' | 'appointment' | 'connection' | 'referral';
  title: string;
  message: string;
  date: string;
  read: boolean;
  petId?: string;
  appointmentId?: string;
  sourceKey?: string;
}

export interface Review {
  id: string;
  tutorId: string;
  tutorName: string;
  veterinarianId: string;
  veterinarianName: string;
  clinicName?: string;
  appointmentId: string;
  petId: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface VetPassRecord {
  code: string;
  ownerId: string;
  petId: string;
  petName: string;
  documents: ExamDocument[];
  createdAt: string;
  expiresAt: string;
  redeemedAt?: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  userType: UserType;
  specialty?: string;
  clinicName?: string;
  language?: string;
  cnpj?: string;
  address?: string;
  phone?: string;
  cpf?: string;
  connectionCode?: string;
  services?: string[] | null;
  workingHours?: Record<string, unknown> | null;
  crmv?: string;
  crmvUf?: string;
}

export type RegisterPayload = {
  name?: string;
  email: string;
  password: string;
  userType: UserType;
  cpf?: string;
  clinicName?: string;
  tradeName?: string;
  address?: string;
  phone?: string;
  crmv?: string;
  crmvUf?: string;
  specialty?: string;
  corporateName?: string;
  cnpj?: string;
  connectionCode?: string;
  services?: string[] | string | null;
  workingHours?: Record<string, unknown> | string | null;
};

export function getApiBase() {
  return ((import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3333').trim();
}

export function getAuthHeaders() {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStoredValue<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function generateVetPassCode() {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `VET-${Date.now().toString(36).toUpperCase()}-${randomPart}`;
}

export function mapApiUserTypeToUi(userType: string): UserType {
  if (userType === 'tutor') return 'owner';
  if (userType === 'veterinarian') return 'veterinarian';
  return 'clinic';
}

export function mapProfileToUser(profile: any): User {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    userType: mapApiUserTypeToUi(profile.user_type),
    specialty: profile.specialty ?? profile.specialty_name ?? undefined,
    clinicName: profile.clinic_name ?? undefined,
    language: profile.language ?? undefined,
    cnpj: profile.cnpj ?? undefined,
    address: profile.address ?? undefined,
    phone: profile.phone ?? undefined,
    cpf: profile.cpf ?? undefined,
    connectionCode: profile.connection_code ?? undefined,
    services: parseServices(profile.services),
    workingHours: parseJsonObject(profile.working_hours),
    crmv: profile.crmv ?? undefined,
    crmvUf: profile.crmv_uf ?? undefined,
  };
}

export function parseServices(value: unknown): string[] | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parseServices(parsed);
    } catch {
      return value
        .split(',')
        .map((service) => service.trim())
        .filter(Boolean);
    }
  }

  return null;
}

export function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parseJsonObject(parsed);
    } catch {
      return null;
    }
  }

  return null;
}

export function parsePetArray(value: unknown): string[] | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsePetArray(parsed);
    } catch {
      return value.trim().length > 0 ? [value] : null;
    }
  }

  return null;
}

export function parseDocumentArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => parseDocumentArray(item) ?? [])
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    try {
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parseDocumentArray(parsed);
      }

      if (parsed !== null && typeof parsed === 'object') {
        return [JSON.stringify(parsed)];
      }

      if (typeof parsed === 'string') {
        return [parsed.trim()].filter(Boolean);
      }

      return [trimmed];
    } catch {
      return [trimmed];
    }
  }

  if (typeof value === 'object') {
    return [JSON.stringify(value)];
  }

  return undefined;
}

export function normalizePetFromApi(pet: any): Pet {
  return {
    id: pet.id,
    currentTutorId: pet.currentTutorId ?? pet.current_tutor_id ?? null,
    ownerId: pet.ownerId ?? pet.currentTutorId ?? pet.current_tutor_id ?? null,
    name: pet.name ?? '',
    species: pet.species ?? null,
    age: pet.age ?? null,
    breed: pet.breed ?? null,
    weight: pet.weight ?? null,
    photo: pet.photo ?? null,
    allergies: parsePetArray(pet.allergies),
    conditions: parsePetArray(pet.conditions),
    linkedClinicId: pet.linkedClinicId ?? null,
    isActive: Boolean(pet.isActive ?? pet.is_active ?? false),
    createdAt: pet.createdAt ?? pet.created_at,
    updatedAt: pet.updatedAt ?? pet.updated_at,
  };
}

export function normalizeMedicalRecordFromApi(record: any): MedicalRecord {
  return {
    id: record.id,
    petId: record.petId ?? record.pet_id,
    date: record.date ?? record.recordDate ?? record.record_date,
    description: record.description ?? '',
    treatment: record.treatment ?? undefined,
    clinicId: record.clinicId ?? record.clinic_id ?? undefined,
    clinicName: record.clinicName ?? record.clinic_name ?? undefined,
    veterinarianName: record.veterinarianName ?? record.veterinarian_name ?? undefined,
    documents: parseDocumentArray(record.documents),
  };
}

export function encodeExamDocument(document: ExamDocument) {
  return JSON.stringify(document);
}

export function decodeExamDocument(value: string): ExamDocument | null {
  try {
    const parsed = JSON.parse(value) as Partial<ExamDocument>;
    if (
      typeof parsed.name === 'string' &&
      typeof parsed.type === 'string' &&
      typeof parsed.size === 'number' &&
      typeof parsed.dataUrl === 'string'
    ) {
      return {
        name: parsed.name,
        type: parsed.type,
        size: parsed.size,
        dataUrl: parsed.dataUrl,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function normalizeVaccineFromApi(vaccine: any): Vaccine {
  return {
    id: vaccine.id,
    petId: vaccine.petId ?? vaccine.pet_id,
    name: vaccine.name ?? '',
    date: vaccine.date ?? vaccine.applied_date,
    nextDose: vaccine.nextDose ?? vaccine.next_dose_date ?? undefined,
    status: vaccine.status === 'late' ? 'late' : 'up-to-date',
    veterinarian: vaccine.veterinarian ?? vaccine.veterinarianName ?? vaccine.veterinarian_name ?? undefined,
    clinicId: vaccine.clinicId ?? vaccine.clinic_id ?? undefined,
    clinicName: vaccine.clinicName ?? vaccine.clinic_name ?? undefined,
  };
}

export function decodeJwtPayload(token: string) {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = `${payload}${'='.repeat((4 - (payload.length % 4)) % 4)}`;
    return JSON.parse(atob(paddedPayload)) as { sub?: string };
  } catch {
    return null;
  }
}

export function getDashboardRouteForUserType(userType?: UserType | null) {
  if (userType === 'clinic') return '/clinic-dashboard';
  if (userType === 'veterinarian') return '/veterinarian-dashboard';
  return '/owner-dashboard';
}

export function getSettingsRouteForUserType(userType?: UserType | null) {
  if (userType === 'clinic') return '/clinic-settings';
  if (userType === 'veterinarian') return '/veterinarian-settings';
  return '/settings';
}

