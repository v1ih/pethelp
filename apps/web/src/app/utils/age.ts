// Idade do pet. Quando há data de nascimento, ela é calculada na hora de exibir —
// assim o valor envelhece sozinho, sem ninguém precisar editar o cadastro. O campo
// livre "age" continua valendo para pets resgatados, de idade só aproximada.

type AgeSource = { age?: string | null; birthDate?: string | null };

function parseBirthDate(birthDate?: string | null) {
  if (!birthDate) return null;
  const date = new Date(`${String(birthDate).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Diferença em anos e meses completos entre o nascimento e hoje. */
export function getAgeParts(birthDate?: string | null): { years: number; months: number } | null {
  const birth = parseBirthDate(birthDate);
  if (!birth) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (birth.getTime() > today.getTime()) return null;

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months };
}

function pluralize(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

/** Ex.: "3 anos e 2 meses", "5 meses", "recém-nascido". */
export function formatAgeFromBirthDate(birthDate?: string | null): string | null {
  const parts = getAgeParts(birthDate);
  if (!parts) return null;

  const { years, months } = parts;
  if (years === 0 && months === 0) return 'recém-nascido';
  if (years === 0) return pluralize(months, 'mês', 'meses');
  if (months === 0) return pluralize(years, 'ano', 'anos');
  return `${pluralize(years, 'ano', 'anos')} e ${pluralize(months, 'mês', 'meses')}`;
}

/** Idade para exibir: calculada pela data de nascimento ou, na falta dela, o texto salvo. */
export function petAgeLabel(pet: AgeSource | null | undefined, fallback = 'Não informada'): string {
  if (!pet) return fallback;
  return formatAgeFromBirthDate(pet.birthDate) ?? (pet.age || fallback);
}

/** Ex.: "14/03/2021". */
export function formatBirthDate(birthDate?: string | null): string | null {
  const birth = parseBirthDate(birthDate);
  return birth ? birth.toLocaleDateString('pt-BR') : null;
}

/** Dias que faltam para o próximo aniversário (0 = é hoje). */
export function daysUntilBirthday(birthDate?: string | null): number | null {
  const birth = parseBirthDate(birthDate);
  if (!birth) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (next.getTime() < today.getTime()) {
    next.setFullYear(next.getFullYear() + 1);
  }

  return Math.round((next.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}
