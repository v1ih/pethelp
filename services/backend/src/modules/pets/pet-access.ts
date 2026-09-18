import type { RowDataPacket } from '../../db/types.js';
import { pool } from '../../db/index.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { findClinicByUserId, findTutorByUserId, findVeterinarianByUserId } from '../users/users.service.js';

type AccessResult =
  | { allowed: true; pet: { id: string; current_tutor_id: string | null; linked_clinic_id: string | null } }
  | { allowed: false; status: 403 | 404; message: 'Forbidden' | 'Pet not found' };

/** True when the tutor is a shared guardian (guarda compartilhada) of the pet. */
export async function isTutorGuardianOfPet(petId: string, tutorId: string): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT 1 FROM pet_guardians WHERE pet_id = ? AND tutor_id = ? LIMIT 1',
    [petId, tutorId]
  );
  return rows.length > 0;
}

/** Categoria de dado de saúde, usada para respeitar o escopo do Vet-Pass. */
export type HealthCategory = 'medical_records' | 'vaccines' | 'exams';

/**
 * Authorizes a pet resource for its tutor, linked clinic, approved veterinarian, or valid Vet-Pass holder.
 * When access comes ONLY from a Vet-Pass, the optional `category` is checked against the pass scope
 * (o responsável pode liberar só vacinas, só prontuário, etc.). Tutor/clínica/vínculo aprovado não são
 * afetados pelo escopo.
 */
export async function canAccessPetHealthData(user: AuthRequest['user'], petId: string, category?: HealthCategory): Promise<AccessResult> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, current_tutor_id, linked_clinic_id FROM pets WHERE id = ? AND is_active = TRUE LIMIT 1',
    [petId]
  );
  const pet = rows[0] as { id: string; current_tutor_id: string | null; linked_clinic_id: string | null } | undefined;
  if (!pet) return { allowed: false, status: 404, message: 'Pet not found' };

  if (user?.userType === 'tutor') {
    const tutor = await findTutorByUserId(user.id);
    if (tutor?.id && (tutor.id === pet.current_tutor_id || (await isTutorGuardianOfPet(pet.id, tutor.id)))) {
      return { allowed: true, pet };
    }
    return { allowed: false, status: 403, message: 'Forbidden' };
  }

  if (user?.userType === 'clinic') {
    const clinic = await findClinicByUserId(user.id);
    return clinic?.id === pet.linked_clinic_id ? { allowed: true, pet } : { allowed: false, status: 403, message: 'Forbidden' };
  }

  if (user?.userType === 'veterinarian') {
    const veterinarian = await findVeterinarianByUserId(user.id);
    if (veterinarian?.id && pet.linked_clinic_id) {
      const [links] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM clinic_veterinarians WHERE clinic_id = ? AND veterinarian_id = ? AND status = 'approved' LIMIT 1`,
        [pet.linked_clinic_id, veterinarian.id]
      );
      if (links.length > 0) return { allowed: true, pet };
    }

    const [passes] = await pool.query<RowDataPacket[]>(
      `SELECT includes_medical_records, includes_vaccines, includes_exams
       FROM vet_passes
       WHERE pet_id = ? AND redeemed_by_user_id = ? AND expires_at >= CURRENT_TIMESTAMP`,
      [pet.id, user.id]
    );
    for (const pass of passes as Array<{ includes_medical_records: boolean; includes_vaccines: boolean; includes_exams: boolean }>) {
      // Sem categoria = checagem genérica (qualquer passe válido serve).
      if (!category) return { allowed: true, pet };
      if (category === 'medical_records' && pass.includes_medical_records) return { allowed: true, pet };
      if (category === 'vaccines' && pass.includes_vaccines) return { allowed: true, pet };
      if (category === 'exams' && pass.includes_exams) return { allowed: true, pet };
    }
  }

  return { allowed: false, status: 403, message: 'Forbidden' };
}
