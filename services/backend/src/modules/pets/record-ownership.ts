import type { AuthRequest } from '../../middlewares/auth.js';

/**
 * Informação lançada por clínica ou veterinário é registro profissional: o responsável
 * pode ver, pode acrescentar o que é dele (um exame feito em outro lugar, uma vacina
 * antiga), mas não pode alterar nem apagar o que o profissional escreveu. Sem isso, a
 * clínica fica exposta — alguém poderia mudar o que foi registrado e depois acusá-la.
 */
export function blockTutorEditingProfessionalEntry(
  user: AuthRequest['user'],
  addedBy: string | null | undefined,
  subject = 'este registro'
): string | null {
  if (user?.userType !== 'tutor') return null;
  if ((addedBy ?? 'veterinarian') === 'tutor') return null;

  const author = addedBy === 'clinic' ? 'pela clínica' : 'pelo veterinário';
  return `Esta informação foi registrada ${author} e não pode ser alterada pelo responsável. Você pode adicionar ${subject === 'esta vacina' ? 'outra vacina' : 'um novo registro'} com as suas informações.`;
}

/** True quando o registro foi lançado por um profissional (clínica ou veterinário). */
export function isProfessionalEntry(addedBy: string | null | undefined) {
  return (addedBy ?? 'veterinarian') !== 'tutor';
}
