import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Edit3, Plus, ShieldAlert, Stethoscope, Trash2 } from 'lucide-react';
import { ClinicShell } from '../components/layout/ClinicShell';
import { useSession } from '../context/SessionContext';
import { getApiBase, getAuthHeaders } from '../context/shared';
import { useDashboardBackLogout } from '../navigation';

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
};

type AvailabilitySlot = {
  id: string;
  day: string;
  start: string;
  end: string;
};

type VetSchedule = {
  specialty: string;
  slots: AvailabilitySlot[];
};

const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function createSlotId() {
  return Math.random().toString(36).slice(2, 10);
}

function formatDayLabel(day: string) {
  return day.slice(0, 3);
}

export default function ClinicAgendaScreen() {
  const navigate = useNavigate();
  const { user } = useSession();
  useDashboardBackLogout();

  const [links, setLinks] = useState<ClinicLink[]>([]);
  const [scheduleMap, setScheduleMap] = useState<Record<string, VetSchedule>>({});
  const [selectedVetId, setSelectedVetId] = useState('');
  const [draftSpecialty, setDraftSpecialty] = useState('');
  const [draftDay, setDraftDay] = useState(days[0]);
  const [draftStart, setDraftStart] = useState('08:00');
  const [draftEnd, setDraftEnd] = useState('12:00');
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const API_BASE = getApiBase();
  const storageKey = user?.id ? `clinic-vet-schedules:${user.id}` : null;

  useEffect(() => {
    let cancelled = false;

    const loadLinks = async () => {
      const resp = await fetch(`${API_BASE}/api/clinic-links/me`, {
        headers: getAuthHeaders(),
      });

      if (!resp.ok) {
        if (!cancelled) setLinks([]);
        return;
      }

      const { data } = await resp.json();
      if (!cancelled) {
        setLinks((data ?? []) as ClinicLink[]);
      }
    };

    void loadLinks();

    return () => {
      cancelled = true;
    };
  }, [API_BASE]);

  useEffect(() => {
    if (!storageKey) return;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      setScheduleMap(JSON.parse(raw) as Record<string, VetSchedule>);
    } catch (error) {
      console.error('Falha ao carregar agendas da clínica:', error);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(scheduleMap));
  }, [scheduleMap, storageKey]);

  const approvedLinks = useMemo(() => links.filter((link) => link.status === 'approved'), [links]);
  const selectedVet = approvedLinks.find((link) => link.veterinarianId === selectedVetId) ?? null;
  const currentSchedule = selectedVet ? scheduleMap[selectedVet.veterinarianId] ?? { specialty: '', slots: [] } : { specialty: '', slots: [] };

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

    const schedule = scheduleMap[selectedVet.veterinarianId];
    setDraftSpecialty(schedule?.specialty ?? '');
  }, [selectedVet, scheduleMap]);

  const selectedVetLabel = selectedVet
    ? `${selectedVet.veterinarianName} • CRMV ${selectedVet.veterinarianCrmv}/${selectedVet.veterinarianCrmvUf}`
    : 'Selecione um veterinário';

  const persistSchedule = (vetId: string, nextSchedule: VetSchedule) => {
    setScheduleMap((prev) => ({
      ...prev,
      [vetId]: nextSchedule,
    }));
  };

  const handleSaveSpecialty = () => {
    if (!selectedVet) return;

    persistSchedule(selectedVet.veterinarianId, {
      ...currentSchedule,
      specialty: draftSpecialty.trim(),
    });

    setFeedback({ type: 'success', message: 'Especialidade salva com sucesso.' });
  };

  const handleAddOrUpdateSlot = () => {
    if (!selectedVet) return;
    if (!draftDay || !draftStart || !draftEnd) return;

    const nextSlot: AvailabilitySlot = {
      id: editingSlotId ?? createSlotId(),
      day: draftDay,
      start: draftStart,
      end: draftEnd,
    };

    const existingSlots = currentSchedule.slots ?? [];
    const nextSlots = editingSlotId ? existingSlots.map((slot) => (slot.id === editingSlotId ? nextSlot : slot)) : [...existingSlots, nextSlot];

    persistSchedule(selectedVet.veterinarianId, {
      specialty: draftSpecialty.trim(),
      slots: nextSlots,
    });

    setEditingSlotId(null);
    setDraftDay(days[0]);
    setDraftStart('08:00');
    setDraftEnd('12:00');
    setFeedback({
      type: 'success',
      message: editingSlotId ? 'Horário atualizado com sucesso.' : 'Horário criado com sucesso.',
    });
  };

  const handleEditSlot = (slot: AvailabilitySlot) => {
    setEditingSlotId(slot.id);
    setDraftDay(slot.day);
    setDraftStart(slot.start);
    setDraftEnd(slot.end);
  };

  const handleDeleteSlot = (slotId: string) => {
    if (!selectedVet) return;

    persistSchedule(selectedVet.veterinarianId, {
      specialty: draftSpecialty.trim(),
      slots: currentSchedule.slots.filter((slot) => slot.id !== slotId),
    });

    if (editingSlotId === slotId) {
      setEditingSlotId(null);
    }
    setFeedback({ type: 'success', message: 'Horário removido.' });
  };

  return (
    <ClinicShell
      active="agenda"
      title="Agenda da clínica"
      description="Organize horários por veterinário e mantenha a agenda operacional centralizada."
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
        {feedback ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
            <p className="text-sm text-muted-foreground">Ativos</p>
            <p className="mt-2 text-3xl font-medium text-foreground">{approvedLinks.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">Veterinários com vínculo aprovado.</p>
          </div>
          <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
            <p className="text-sm text-muted-foreground">Horários</p>
            <p className="mt-2 text-3xl font-medium text-foreground">
              {selectedVet ? currentSchedule.slots.length : 0}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Intervalos cadastrados para o profissional selecionado.</p>
          </div>
          <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
            <p className="text-sm text-muted-foreground">Seleção</p>
            <p className="mt-2 text-3xl font-medium text-foreground">{selectedVet ? '1' : '0'}</p>
            <p className="mt-2 text-sm text-muted-foreground">Veterinário ativo em edição.</p>
          </div>
        </section>

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
                      className={`w-full rounded-[22px] border px-4 py-4 text-left transition-colors ${
                        isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-muted/60'
                      }`}
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

          <div className="space-y-4">
            <div className="rounded-[32px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Agenda por profissional</p>
                  <h2 className="text-2xl font-medium text-foreground">{selectedVetLabel}</h2>
                </div>
                <Clock3 className="h-6 w-6 text-primary" />
              </div>

              {selectedVet ? (
                <div className="mt-6 space-y-4">
                  <div className="rounded-[22px] border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="h-5 w-5 text-primary" />
                      <h3 className="text-lg text-foreground">Especialidade</h3>
                    </div>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <input
                        value={draftSpecialty}
                        onChange={(event) => setDraftSpecialty(event.target.value)}
                        placeholder="Ex.: Dermatologia, Cardiologia, Clínica geral"
                        className="flex-1 rounded-[18px] border border-border bg-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={handleSaveSpecialty}
                        className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-border bg-background px-4 py-3 text-foreground transition-colors hover:bg-muted"
                      >
                        <Plus className="h-4 w-4" />
                        Salvar especialidade
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      <h3 className="text-lg text-foreground">Cadastrar horários disponíveis</h3>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <select
                        value={draftDay}
                        onChange={(event) => setDraftDay(event.target.value)}
                        className="rounded-[18px] border border-border bg-background px-4 py-3 text-foreground outline-none"
                      >
                        {days.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={draftStart}
                        onChange={(event) => setDraftStart(event.target.value)}
                        className="rounded-[18px] border border-border bg-background px-4 py-3 text-foreground outline-none"
                      />
                      <input
                        type="time"
                        value={draftEnd}
                        onChange={(event) => setDraftEnd(event.target.value)}
                        className="rounded-[18px] border border-border bg-background px-4 py-3 text-foreground outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddOrUpdateSlot}
                        className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-primary px-4 py-3 text-white transition-colors hover:bg-primary/90"
                      >
                        <Plus className="h-4 w-4" />
                        {editingSlotId ? 'Atualizar horário' : 'Adicionar horário'}
                      </button>
                    </div>

                    {editingSlotId ? (
                      <p className="mt-3 text-xs text-muted-foreground">Você está editando um horário existente. Salve para substituir o período atual.</p>
                    ) : null}
                  </div>

                  <div className="rounded-[22px] border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg text-foreground">Horários cadastrados</h3>
                        <p className="text-sm text-muted-foreground">
                          {currentSchedule.slots.length} intervalo{currentSchedule.slots.length === 1 ? '' : 's'} disponíve{currentSchedule.slots.length === 1 ? 'l' : 'is'}
                        </p>
                      </div>
                      <Clock3 className="h-5 w-5 text-primary" />
                    </div>

                    <div className="mt-4 space-y-3">
                      {currentSchedule.slots.length === 0 ? (
                        <div className="rounded-[18px] border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                          Nenhum horário cadastrado para este veterinário.
                        </div>
                      ) : (
                        currentSchedule.slots.map((slot) => (
                          <div key={slot.id} className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-muted/20 px-4 py-3">
                            <div>
                              <p className="text-foreground">{formatDayLabel(slot.day)}</p>
                              <p className="text-sm text-muted-foreground">
                                {slot.start} - {slot.end}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditSlot(slot)}
                                className="inline-flex items-center gap-2 rounded-[18px] border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                              >
                                <Edit3 className="h-4 w-4" />
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSlot(slot.id)}
                                className="inline-flex items-center gap-2 rounded-[18px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 transition-colors hover:bg-red-100"
                              >
                                <Trash2 className="h-4 w-4" />
                                Excluir
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-[22px] border border-dashed border-border bg-muted/20 p-6">
                  <p className="text-sm text-muted-foreground">
                    Selecione um veterinário ativo para definir especialidade e horários.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-[32px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Fluxo</p>
                  <h3 className="text-2xl font-medium text-foreground">Ir para os vínculos</h3>
                </div>
                <ArrowRight className="h-6 w-6 text-primary" />
              </div>
              <button
                type="button"
                onClick={() => navigate('/clinic-veterinarians')}
                className="mt-5 inline-flex items-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90"
              >
                <Stethoscope className="h-4 w-4" />
                Abrir tela de veterinários
              </button>
            </div>
          </div>
        </section>
      </div>
    </ClinicShell>
  );
}
