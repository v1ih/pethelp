import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Appointment } from '../../context/shared';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const STATUS_CHIP: Record<Appointment['status'], string> = {
  scheduled: 'bg-primary/15 text-primary',
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  cancelled: 'bg-rose-500/15 text-rose-600 line-through',
};

const STATUS_DOT: Record<Appointment['status'], string> = {
  scheduled: 'bg-primary',
  completed: 'bg-emerald-500',
  cancelled: 'bg-rose-500',
};

interface MonthCalendarProps {
  appointments: Appointment[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

/** Parses a date-only string (YYYY-MM-DD) safely as local time. */
function parseDay(value: string) {
  return parseISO(`${value}T12:00:00`);
}

export default function MonthCalendar({ appointments, selectedDate, onSelectDate }: MonthCalendarProps) {
  const [cursor, setCursor] = useState(() => (selectedDate ? parseDay(selectedDate) : new Date()));

  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appointment of appointments) {
      if (!appointment.date) continue;
      const list = map.get(appointment.date) ?? [];
      list.push(appointment);
      map.set(appointment.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    }
    return map;
  }, [appointments]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-medium text-foreground first-letter:uppercase">
          {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            Hoje
          </button>
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setCursor((current) => subMonths(current, 1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => setCursor((current) => addMonths(current, 1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {weekday}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayAppointments = byDate.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const selected = selectedDate ? isSameDay(day, parseDay(selectedDate)) : false;
          const today = isToday(day);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              className={[
                'flex min-h-[76px] flex-col gap-1 rounded-2xl border p-1.5 text-left align-top transition-colors sm:min-h-[92px] sm:p-2',
                selected
                  ? 'border-primary bg-primary/10'
                  : today
                    ? 'border-primary/40 bg-background hover:bg-muted'
                    : 'border-border/70 bg-background hover:bg-muted',
                inMonth ? '' : 'opacity-40',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                  today ? 'bg-primary text-white' : 'text-foreground',
                ].join(' ')}
              >
                {format(day, 'd')}
              </span>

              <span className="flex flex-col gap-0.5 overflow-hidden">
                {dayAppointments.slice(0, 2).map((appointment) => (
                  <span
                    key={appointment.id}
                    title={`${appointment.time?.slice(0, 5) ?? ''} · ${appointment.petName} · ${appointment.veterinarianName || appointment.clinicName || ''}`}
                    className={`truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight sm:text-[11px] ${STATUS_CHIP[appointment.status]}`}
                  >
                    <span className="tabular-nums">{appointment.time?.slice(0, 5)}</span> {appointment.petName}
                  </span>
                ))}
                {dayAppointments.length > 2 ? (
                  <span className="flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[dayAppointments[2].status]}`} />+
                    {dayAppointments.length - 2} mais
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
