export { getDashboardRouteForUserType } from './shared';
export type {
  Appointment,
  MedicalRecord,
  Notification,
  Pet,
  PetMutationPayload,
  RegisterPayload,
  User,
  UserType,
  Vaccine,
} from './shared';

export { useSession } from './SessionContext';
export { usePets } from './PetsContext';
export { useHealth } from './HealthContext';
export { useInteraction } from './InteractionContext';
