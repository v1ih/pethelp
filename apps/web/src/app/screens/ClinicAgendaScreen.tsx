import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { CalendarDays, CheckCircle2, Clock3, LayoutList, Save, Stethoscope } from 'lucide-react';
import { ClinicShell } from '../components/layout/ClinicShell';
import { useSession } from '../context/SessionContext';
import { useInteraction } from '../context/InteractionContext';
import { getApiBase, getAuthHeaders } from '../context/shared';
import { useDashboardBackLogout } from '../navigation';
import MonthCalendar from '../components/calendar/MonthCalendar';

const STATUS_LABEL: Record<string, string> = { scheduled: 'Agendada', completed: 'Concluída', cancelled: 'Cancelada' };
function formatDayLabelPt(dateStr: string) {
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  } catch {
    return dateStr;
  }
}

type DayHours = { open: string; close: string };
type WorkingHours = Record<string, DayHours>;

type ClinicLink = {
  id: string;
  clinicId?: string;
  veterinarianId: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: 'clinic' | 'veterinarian';
  clinicName?: string;
  veterinarianName: string;
  veterinarianEmail: string;
  veterinarianCrmv: string;
  veterinarianCrmvUf: string;
  veterinarianWorkingHours?: WorkingHours | null;
};

const WEEKDAYS: Array<{ key: string; label: string }> = [
  { key: 'Seg', label: 'Segunda' },
  { key: 'Ter', label: 'Terça' },
  { key: 'Qua', label: 'Quarta' },
  { key: 'Qui', label: 'Quinta' },
  { key: 'Sex', label: 'Sexta' },
  { key: 'Sáb', label: 'Sábado' },
  { key: 'Dom', label: 'Domingo' },
];

function defaultHours(): WorkingHours {
  return {
    Seg: { open: '08:00', close: '18:00' },
    Ter: { open: '08:00', close: '18:00' },
    Qua: { open: '08:00', close: '18:00' },
    Qui: { open: '08:00', close: '18:00' },
    Sex: { open: '08:00', close: '18:00' },
    Sáb: { open: '', close: '' },
    Dom: { open: '', close: '' },
  };
}

function normalizeHours(value: WorkingHours | null | undefined): WorkingHours {
  if (!value || typeof value !== 'object') return defaultHours();
  const out: WorkingHours = {};
  for (const { key } of WEEKDAYS) {
    const d = value[key];
    out[key] = { open: d?.open ?? '', close: d?.close ?? '' };
  }
  return out;
}

export default function ClinicAgendaScreen() {
  const navigate = useNavigate();
  const { user } = useSession();
  useDashboardBackLogout();

  const { appointments } = useInteraction();
  const [view, setView] = useState<'calendar' | 'hours'>('calendar');
  const [selectedDay, setSelectedDay] = useState('');
  const [links, setLinks] = useState<ClinicLink[]>([]);
  const [selectedVetId, setSelectedVetId] = useState('');
  const [hours, setHours] = useState<WorkingHours>(defaultHours());
  const [saving, setSaving] = useState(false);
  const API_BASE = getApiBase();

  const dayAppointments = useMemo(
    () => appointments.filter((a) => a.date === selectedDay).sort((x, y) => (x.time ?? '').localeCompare(y.time ?? '')),
    [appointments, selectedDay]
  );

  useEffect(() => {
    let cancelled = false;
    const loadLinks = async () => {
      const resp = await fetch(`${API_BASE}/api/clinic-links/me`, { headers: getAuthHeaders() });
      if (!resp.ok) {
        if (!cancelled) setLinks([]);
        return;
      }
      const { data } = await resp.json();
      if (!cancelled) setLinks((data ?? []) as ClinicLink[]);
    };
    void loadLinks();
    return () => {
      cancelled = true;
    };
  }, [API_BASE]);

  const approvedLinks = useMemo(() => links.filter((link) => link.status === 'approved'), [links]);
  const selectedVet = approvedLinks.find((link) => link.veterinarianId === selectedVetId) ?? null;

  useEffect(() => {
    if (approvedLinks.length === 0) {
      setSelectedVetId('');
      return;
    }
    if (!selectedVetId || !approvedLinks.some((link) => link.veterinarianId === selectedVetId)) {
      setSelectedVetId(approvedLinks[0].veterinarianId);
    }
  }, [approvedLinks, selectedVetId]);

  useEffect(() => {
    if (!selectedVet) return;
    setHours(normalizeHours(selectedVet.veterinarianWorkingHours));
  }, [selectedVet]);

  const setDay = (key: string, field: 'open' | 'close', value: string) => {
    setHours((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const toggleClosed = (key: string, closed: boolean) => {
    setHours((prev) => ({ ...prev, [key]: closed ? { open: '', close: '' } : { open: '08:00', close: '18:00' } }));
  };

  const handleSave = async () => {
    if (!selectedVet) return;
    setSaving(true);
    try {
      const resp = await fetch(`${API_BASE}/api/clinic-links/veterinarians/${selectedVet.veterinarianId}/working-hours`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ workingHours: hours }),
      });
      if (!resp.ok) {
        const payload = await resp.json().catch(() => null);
        throw new Error(payload?.message ?? 'Falha ao salvar');
      }
      // Atualiza a lista local para refletir o horário salvo.
      setLinks((prev) => prev.map((link) => (link.veterinarianId === selectedVet.veterinarianId ? { ...link, veterinarianWorkingHours: hours } : link)));
      toast.success('Horário de atendimento salvo com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const selectedVetLabel = selectedVet
    ? `${selectedVet.veterinarianName} • CRMV ${selectedVet.veterinarianCrmv}/${selectedVet.veterinarianCrmvUf}`
    : 'Selecione um veterinário';

  const openDays = WEEKDAYS.filter(({ key }) => hours[key]?.open && hours[key]?.close).length;

  return (
    <ClinicShell
      active="agenda"
      title="Agenda da clínica"
      description="Defina o horário de atendimento de cada veterinário. Esses horários controlam os agendamentos disponíveis."
      actions={
        <button
          type="button"
          onClick={() => navigate('/clinic-veterinarians')}
          className="inline-flex items-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90"
        >
          <Stethoscope className="h-5 w-5" />
          Ver veterinários
        </button>
      }
    >
      <div className="space-y-6">

        <div className="flex w-max items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setView('calendar')}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${view === 'calendar' ? 'bg-primary text-white' : 'text-foreground hover:bg-muted'}`}
          >
            <CalendarDays className="h-4 w-4" /> Calendário
          </button>
          <button
            type="button"
            onClick={() => setView('hours')}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${view === 'hours' ? 'bg-primary text-white' : 'text-foreground hover:bg-muted'}`}
          >
            <Clock3 className="h-4 w-4" /> Horários de atendimento
          </button>
        </div>

        {view === 'calendar' ? (
          <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <MonthCalendar appointments={appointments} selectedDate={selectedDay} onSelectDate={setSelectedDay} />
            <div className="rounded-[32px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
              <div className="flex items-center gap-2">
                <LayoutList className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-medium text-foreground">{selectedDay ? formatDayLabelPt(selectedDay) : 'Selecione um dia'}</h2>
              </div>
              <div className="mt-4 space-y-3">
                {!selectedDay ? (
                  <p className="text-sm text-muted-foreground">Clique em um dia no calendário para ver as consultas.</p>
                ) : dayAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma consulta neste dia.</p>
                ) : (
                  dayAppointments.map((a) => (
                    <div key={a.id} className="rounded-[18px] border border-border bg-muted/20 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-foreground">{a.petName}</p>
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">{STATUS_LABEL[a.status] ?? a.status}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{a.time?.slice(0, 5)} • {a.veterinarianName || 'Veterinário'}</p>
                      <p className="text-sm text-muted-foreground">{a.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : (
        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[32px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Profissionais</p>
                <h2 className="text-2xl font-medium text-foreground">Veterinários vinculados</h2>
              </div>
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>

            <div className="mt-5 space-y-3">
              {approvedLinks.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-border bg-muted/20 p-5 text-sm text-muted-foreground">
                  Nenhum veterinário ativo ainda. Vá até a tela de veterinários para liberar vínculos.
                </div>
              ) : (
                approvedLinks.map((link) => {
                  const isSelected = selectedVetId === link.veterinarianId;
                  return (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => setSelectedVetId(link.veterinarianId)}
                      className={`w-full rounded-[22px] border px-4 py-4 text-left transition-colors ${isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-muted/60'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-foreground">{link.veterinarianName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{link.veterinarianEmail}</p>
                          <p className="text-xs text-muted-foreground">CRMV {link.veterinarianCrmv}/{link.veterinarianCrmvUf}</p>
                        </div>
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Selecionado
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-[32px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Horário de atendimento</p>
                <h2 className="text-2xl font-medium text-foreground">{selectedVetLabel}</h2>
              </div>
              <Clock3 className="h-6 w-6 text-primary" />
            </div>

            {selectedVet ? (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  {openDays} dia{openDays === 1 ? '' : 's'} de atendimento na semana.
                </p>

                {WEEKDAYS.map(({ key, label }) => {
                  const day = hours[key] ?? { open: '', close: '' };
                  const closed = !day.open || !day.close;
                  return (
                    <div key={key} className="flex flex-wrap items-center gap-3 rounded-[18px] border border-border bg-muted/20 px-4 py-3">
                      <span className="w-24 text-sm font-medium text-foreground">{label}</span>
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input type="checkbox" checked={!closed} onChange={(e) => toggleClosed(key, !e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                        Atende
                      </label>
                      {!closed ? (
                        <div className="flex items-center gap-2">
                          <input type="time" value={day.open} onChange={(e) => setDay(key, 'open', e.target.value)} className="rounded-[14px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                          <span className="text-muted-foreground">às</span>
                          <input type="time" value={day.close} onChange={(e) => setDay(key, 'close', e.target.value)} className="rounded-[14px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Fechado</span>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="mt-2 inline-flex items-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Salvando...' : 'Salvar horário'}
                </button>

                <p className="text-xs text-muted-foreground">
                  Dica: o horário disponível para agendamento é a combinação do expediente da clínica com o do veterinário.
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-[22px] border border-dashed border-border bg-muted/20 p-6">
                <p className="text-sm text-muted-foreground">Selecione um veterinário ativo para definir o horário de atendimento.</p>
              </div>
            )}
          </div>
        </section>
        )}
      </div>
    </ClinicShell>
  );
}
