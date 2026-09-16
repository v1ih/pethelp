import type { RowDataPacket } from '../../db/types.js';
import { pool } from '../../db/index.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { findClinicByUserId, findTutorByUserId, findVeterinarianByUserId } from '../users/users.service.js';

type AccessResult =
  | { allowed: true; pet: { id: string; current_tutor_id: string | null; linked_clinic_id: string | null } }
  | { allowed: false; status: 403 | 404; message: 'Forbidden' | 'Pet not found' };

/** Authorizes a pet resource for its tutor, linked clinic, approved veterinarian, or valid Vet-Pass holder. */
export async function canAccessPetHealthData(user: AuthRequest['user'], petId: string): Promise<AccessResult> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, current_tutor_id, linked_clinic_id FROM pets WHERE id = ? AND is_active = TRUE LIMIT 1',
    [petId]
  );
  const pet = rows[0] as { id: string; current_tutor_id: string | null; linked_clinic_id: string | null } | undefined;
  if (!pet) return { allowed: false, status: 404, message: 'Pet not found' };

  if (user?.userType === 'tutor') {
    const tutor = await findTutorByUserId(user.id);
    return tutor?.id === pet.current_tutor_id ? { allowed: true, pet } : { allowed: false, status: 403, message: 'Forbidden' };
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
      'SELECT id FROM vet_passes WHERE pet_id = ? AND redeemed_by_user_id = ? AND expires_at >= CURRENT_TIMESTAMP LIMIT 1',
      [pet.id, user.id]
    );
    if (passes.length > 0) return { allowed: true, pet };
  }

  return { allowed: false, status: 403, message: 'Forbidden' };
}
