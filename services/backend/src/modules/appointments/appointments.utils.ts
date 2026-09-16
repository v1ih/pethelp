export function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function formatDate(value: Date | string) {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function getWeekdayKey(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][parsed.getDay()] ?? null;
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return -1;
  return hours * 60 + minutes;
}

export function isWithinRange(time: string, open: string, close: string) {
  const current = timeToMinutes(time);
  const start = timeToMinutes(open);
  const end = timeToMinutes(close);
  if (current < 0 || start < 0 || end < 0) return false;
  return current >= start && current < end;
}
