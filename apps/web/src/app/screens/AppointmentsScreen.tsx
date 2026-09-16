import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Calendar, Clock, Lock, Mail, MessageSquare, PenLine, Plus, Star, Trash2, X } from 'lucide-react';
import { useInteraction } from '../context/InteractionContext';
import { usePets } from '../context/PetsContext';
import { useReviews } from '../context/ReviewsContext';
import { useSession } from '../context/SessionContext';
import { getApiBase, getAuthHeaders, type Appointment } from '../context/shared';
import { TutorShell } from '../components/layout/TutorShell';
import SearchablePicker, { type SearchablePickerItem } from '../components/forms/SearchablePicker';

type CatalogEntry = SearchablePickerItem & {
  type: 'clinic' | 'veterinarian';
  name: string;
  clinicName?: string;
  connectionCode?: string | null;
  address?: string | null;
  specialty?: string | null;
  crmv?: string | null;
  crmvUf?: string | null;
  veterinarianEmail?: string | null;
  veterinarianPhone?: string | null;
  workingHours?: Record<string, unknown> | null;
};

type AvailabilityState = {
  loading: boolean;
  isAvailable: boolean | null;
  message: string;
  busyTimes: string[];
};

const initialAvailability: AvailabilityState = {
  loading: false,
  isAvailable: null,
  message: 'Selecione clínica, veterinário, data e horário para verificar disponibilidade.',
  busyTimes: [],
};

function mapCatalogEntry(entry: any, type: 'clinic' | 'veterinarian'): CatalogEntry {
  return {
    id: String(entry.id),
    type,
    name: entry.name,
    label: type === 'veterinarian' ? `${entry.name}${entry.specialty ? ` • ${entry.specialty}` : ''}` : entry.name,
    description:
      type === 'veterinarian'
        ? `${entry.crmv ? `CRMV ${entry.crmv}${entry.crmvUf ? `/${entry.crmvUf}` : ''}` : 'Veterinário cadastrado'}`
        : `${entry.connectionCode ? `Código ${entry.connectionCode}` : entry.address || 'Clínica cadastrada'}`,
    clinicName: entry.clinicName,
    connectionCode: entry.connectionCode,
    address: entry.address,
    specialty: entry.specialty,
    crmv: entry.crmv,
    crmvUf: entry.crmvUf,
    veterinarianEmail: entry.veterinarianEmail,
    veterinarianPhone: entry.veterinarianPhone,
    workingHours: entry.workingHours,
  };
}

const weekdayOrder = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function formatWorkingHours(hours?: Record<string, unknown> | null) {
  if (!hours) return 'Horário não informado';

  const entries = weekdayOrder
    .map((day) => {
      const slot = hours[day];
      if (!slot || typeof slot !== 'object') return null;
      const open = typeof (slot as { open?: unknown }).open === 'string' ? (slot as { open?: string }).open : '';
      const close = typeof (slot as { close?: unknown }).close === 'string' ? (slot as { close?: string }).close : '';
      if (!open || !close) return null;
      return `${day.slice(0, 3)} ${open} - ${close}`;
    })
    .filter((entry): entry is string => Boolean(entry));

  return entries.length > 0 ? entries.join(' • ') : 'Horário não informado';
}

export default function AppointmentsScreen() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { currentPet } = usePets();
  const { appointments, addAppointment } = useInteraction();
  const { getReviewForAppointment, upsertReview, deleteReview } = useReviews();
  const API_BASE = getApiBase();

  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [targetType, setTargetType] = useState<'clinic' | 'veterinarian'>('clinic');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [clinicItems, setClinicItems] = useState<CatalogEntry[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogEntry[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [vetPassCode, setVetPassCode] = useState('');
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityState>(initialAvailability);
  const [reviewAppointmentId, setReviewAppointmentId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // The /api/appointments/me endpoint already scopes results to the current user
  // (by tutor/clinic/veterinarian profile), so no extra client-side owner filter is needed.
  const userAppointments = appointments;
  const scheduled = userAppointments.filter((a) => a.status === 'scheduled');
  const completed = userAppointments.filter((a) => a.status === 'completed');
  const activeReviewAppointment = reviewAppointmentId ? userAppointments.find((appointment) => appointment.id === reviewAppointmentId) ?? null : null;
  const activeReview = activeReviewAppointment ? getReviewForAppointment(activeReviewAppointment.id) : null;
  const selectedClinicItem = clinicItems.find((item) => item.id === selectedClinicId) ?? null;
  const selectedCatalogItem = catalogItems.find((item) => item.id === selectedCatalogId) ?? null;

  useEffect(() => {
    if (!showNewAppointment) return;

    const controller = new AbortController();
    setLoadingClinics(true);

    void fetch(`${API_BASE}/api/users/catalog?type=clinic`, {
      headers: getAuthHeaders(),
      signal: controller.signal,
    })
      .then(async (resp) => {
        if (!resp.ok) {
          setClinicItems([]);
          return;
        }

        const { data } = await resp.json();
        setClinicItems((data ?? []).map((entry: any) => mapCatalogEntry(entry, 'clinic')));
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Falha ao carregar clínicas:', error);
          setClinicItems([]);
        }
      })
      .finally(() => setLoadingClinics(false));

    return () => controller.abort();
  }, [API_BASE, showNewAppointment]);

  useEffect(() => {
    if (!showNewAppointment) {
      setAvailability(initialAvailability);
    }
  }, [showNewAppointment]);

  useEffect(() => {
    if (!showNewAppointment) return;

    if (targetType === 'clinic' && !selectedClinicId) {
      setCatalogItems([]);
      return;
    }

    const controller = new AbortController();
    const loadCatalog = async () => {
      setLoadingCatalog(true);
      try {
        const params = new URLSearchParams();
        params.set('type', 'veterinarian');
        if (catalogQuery.trim()) params.set('query', catalogQuery.trim());
        if (specialtyFilter.trim()) params.set('specialty', specialtyFilter.trim());
        if (selectedClinicId.trim()) params.set('clinicId', selectedClinicId.trim());

        const resp = await fetch(`${API_BASE}/api/users/catalog?${params.toString()}`, {
          headers: getAuthHeaders(),
          signal: controller.signal,
        });

        if (!resp.ok) {
          setCatalogItems([]);
          return;
        }

        const { data } = await resp.json();
        const items = (data ?? []).map((entry: any) => mapCatalogEntry(entry, 'veterinarian')) as CatalogEntry[];
        setCatalogItems(items);
        setSelectedCatalogId((current) => (items.some((item) => item.id === current) ? current : ''));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Falha ao carregar catálogo de agendamentos:', error);
          setCatalogItems([]);
        }
      } finally {
        setLoadingCatalog(false);
      }
    };

    void loadCatalog();

    return () => controller.abort();
  }, [API_BASE, catalogQuery, selectedClinicId, showNewAppointment, specialtyFilter, targetType]);

  useEffect(() => {
    if (!showNewAppointment) {
      setAvailability(initialAvailability);
      return;
    }

    const needsClinic = targetType === 'clinic';
    const hasClinic = Boolean(selectedClinicId);
    const hasVeterinarian = Boolean(selectedCatalogId);

    if (!date || !time || !hasVeterinarian || (needsClinic && !hasClinic)) {
      setAvailability({
        loading: false,
        isAvailable: null,
        message: needsClinic
          ? !hasClinic
            ? 'Selecione a clínica para carregar os veterinários disponíveis.'
            : 'Selecione um veterinário da clínica para verificar disponibilidade.'
          : 'Selecione um veterinário, data e horário para verificar disponibilidade.',
        busyTimes: [],
      });
      return;
    }

    const controller = new AbortController();
    const loadAvailability = async () => {
      setAvailability((current) => ({
        ...current,
        loading: true,
        message: 'Verificando disponibilidade...',
      }));

      try {
        const params = new URLSearchParams({
          date,
          time,
        });

        if (hasClinic) {
          params.set('clinicId', selectedClinicId);
        }

        if (hasVeterinarian) {
          params.set('veterinarianId', selectedCatalogId);
        }

        const resp = await fetch(`${API_BASE}/api/appointments/availability?${params.toString()}`, {
          headers: getAuthHeaders(),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const payload = await resp.json().catch(() => null);
          setAvailability({
            loading: false,
            isAvailable: false,
            message: payload?.message ?? 'Não foi possível verificar a disponibilidade.',
            busyTimes: [],
          });
          return;
        }

        const { data } = await resp.json();
        const issues = Array.isArray(data?.issues) ? data.issues.filter((item: unknown): item is string => typeof item === 'string') : [];
        setAvailability({
          loading: false,
          isAvailable: Boolean(data?.isAvailable),
          message: data?.isAvailable ? 'Horário disponível para agendamento.' : issues[0] ?? 'Horário indisponível.',
          busyTimes: Array.isArray(data?.busyTimes) ? data.busyTimes.filter((item: unknown): item is string => typeof item === 'string') : [],
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('Falha ao verificar disponibilidade:', error);
          setAvailability({
            loading: false,
            isAvailable: false,
            message: 'Não foi possível verificar a disponibilidade.',
            busyTimes: [],
          });
        }
      }
    };

    void loadAvailability();

    return () => controller.abort();
  }, [API_BASE, date, selectedCatalogId, selectedClinicId, showNewAppointment, targetType, time]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!currentPet) {
      setFeedback({ type: 'error', message: 'Selecione um pet antes de agendar.' });
      return;
    }

    if (targetType === 'clinic' && !selectedClinicItem) {
      setFeedback({ type: 'error', message: 'Selecione uma clínica para continuar.' });
      return;
    }

    if (!selectedCatalogItem) {
      setFeedback({
        type: 'error',
        message: targetType === 'clinic' ? 'Selecione um veterinário disponível da clínica.' : 'Selecione um veterinário.',
      });
      return;
    }

    if (!date || !time || !reason.trim()) {
      setFeedback({ type: 'error', message: 'Preencha data, horário e motivo.' });
      return;
    }

    // Vet-Pass é opcional no agendamento.
    const vetPass = vetPassCode.trim().toUpperCase();

    if (availability.loading) {
      setFeedback({ type: 'error', message: 'Aguarde a verificação de disponibilidade.' });
      return;
    }

    if (availability.isAvailable !== true) {
      setFeedback({ type: 'error', message: availability.message || 'Escolha um horário disponível.' });
      return;
    }

    const appointmentPayload: Omit<Appointment, 'id'> = {
      petId: currentPet.id,
      petName: currentPet.name,
      clinicId: selectedClinicItem?.id ?? null,
      clinicName: selectedClinicItem?.name ?? null,
      veterinarianId: selectedCatalogItem.id,
      veterinarianName: selectedCatalogItem.name,
      veterinarianEmail: selectedCatalogItem.veterinarianEmail ?? null,
      veterinarianPhone: selectedCatalogItem.veterinarianPhone ?? null,
      vetPassCode: vetPass,
      targetType,
      date,
      time,
      reason,
      status: 'scheduled',
      ownerId: user?.id ?? '',
    };

    try {
      await addAppointment(appointmentPayload);
      setFeedback({ type: 'success', message: 'Consulta agendada com sucesso.' });
      setShowNewAppointment(false);
      setTargetType('clinic');
      setSelectedClinicId('');
      setSelectedCatalogId('');
      setDate('');
      setTime('');
      setReason('');
      setVetPassCode('');
      setCatalogQuery('');
      setSpecialtyFilter('');
      setAvailability(initialAvailability);
    } catch (error) {
      console.error('Falha ao agendar consulta:', error);
      setFeedback({ type: 'error', message: 'Não foi possível agendar a consulta.' });
    }
  };

  const openReview = (appointmentId: string) => {
    const appointment = userAppointments.find((item) => item.id === appointmentId);
    if (!appointment || appointment.status !== 'completed') return;
    const review = getReviewForAppointment(appointmentId);
    setReviewAppointmentId(appointmentId);
    setReviewRating(review?.rating ?? 5);
    setReviewComment(review?.comment ?? '');
  };

  const closeReview = () => {
    setReviewAppointmentId(null);
    setReviewRating(5);
    setReviewComment('');
  };

  const submitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReviewAppointment || activeReviewAppointment.status !== 'completed' || !user) return;
    upsertReview({
      id: activeReview?.id,
      tutorId: user.id,
      tutorName: user.name,
      veterinarianId: activeReviewAppointment.veterinarianId ?? activeReviewAppointment.clinicId ?? '',
      veterinarianName: activeReviewAppointment.veterinarianName || activeReviewAppointment.clinicName || '',
      clinicName: activeReviewAppointment.clinicName ?? undefined,
      appointmentId: activeReviewAppointment.id,
      petId: activeReviewAppointment.petId,
      rating: reviewRating,
      comment: reviewComment.trim() || 'Sem comentário',
    });
    closeReview();
  };

  const removeReview = () => {
    if (!activeReview) return;
    deleteReview(activeReview.id);
    closeReview();
  };

  const clinicDescription = loadingClinics ? 'Carregando clínicas...' : 'Escolha a clínica quando quiser filtrar os veterinários.';
  const providerDescription =
    targetType === 'clinic'
      ? 'Busque clínicas já cadastradas.'
      : selectedClinicId
        ? 'Busque veterinários vinculados à clínica selecionada.'
        : 'Selecione uma clínica para carregar os veterinários vinculados.';

  return (
    <TutorShell
      active="appointments"
      title="Agenda"
      description="Agendamentos com clínica ou veterinário específico."
      actions={user?.userType === 'owner' ? <button onClick={() => setShowNewAppointment(true)} className="inline-flex items-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90"><Plus className="h-5 w-5" />Nova Consulta</button> : null}
    >
      <div className="space-y-6">
        {feedback ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${feedback.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {feedback.message}
          </div>
        ) : null}

        {showNewAppointment && (
          <section className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-medium text-foreground">Agendar Nova Consulta</h2>
              <button onClick={() => setShowNewAppointment(false)} className="rounded-full border border-border bg-background p-2 text-muted-foreground transition-colors hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-foreground">Destino do agendamento</label>
                  <select
                    value={targetType}
                    onChange={(event) => {
                      const nextType = event.target.value as 'clinic' | 'veterinarian';
                      setTargetType(nextType);
                      setSelectedClinicId('');
                      setSelectedCatalogId('');
                      setAvailability(initialAvailability);
                    }}
                    className="w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none focus:border-primary"
                  >
                    <option value="clinic">Clínica</option>
                    <option value="veterinarian">Veterinário</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-foreground">Código VetPass <span className="text-muted-foreground">(opcional)</span></label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={vetPassCode}
                      onChange={(event) => setVetPassCode(event.target.value.toUpperCase())}
                      placeholder="VET-... (deixe em branco se não tiver)"
                      className="w-full rounded-[18px] border border-border bg-[#efe9de] py-3 pl-12 pr-4 uppercase tracking-wider text-foreground outline-none transition-colors focus:border-primary"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Só é necessário se você quiser liberar exames anexados ao veterinário.</p>
                </div>
              </div>

              {targetType === 'clinic' ? (
                <div className="space-y-4 rounded-[28px] border border-border/70 bg-muted/20 p-4">
                  <div>
                    <label className="mb-2 block text-foreground">Clínica</label>
                    <SearchablePicker
                      key={`clinic-${catalogQuery}`}
                      label="Clínica"
                      placeholder="Buscar clínica"
                      items={clinicItems}
                      selectedId={selectedClinicId}
                      onSelect={(item) => {
                        setSelectedClinicId(item?.id ?? '');
                        setSelectedCatalogId('');
                      }}
                      emptyText={clinicDescription}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-foreground">Veterinário disponível</label>
                    {selectedClinicId ? (
                      <SearchablePicker
                        key={`vet-clinic-${selectedClinicId}-${specialtyFilter}`}
                        label="Veterinário"
                        placeholder="Buscar veterinário"
                        items={catalogItems}
                        selectedId={selectedCatalogId}
                        onSelect={(item) => setSelectedCatalogId(item?.id ?? '')}
                        emptyText={loadingCatalog ? 'Carregando veterinários...' : providerDescription}
                      />
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                        Selecione a clínica para listar os veterinários vinculados.
                      </div>
                    )}
                  </div>

                  {selectedClinicItem ? (
                    <div className="rounded-[22px] border border-border bg-background px-4 py-4">
                      <p className="text-sm text-foreground">Agenda da clínica</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatWorkingHours(selectedClinicItem.workingHours)}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4 rounded-[28px] border border-border/70 bg-muted/20 p-4">
                  <div>
                    <label className="mb-2 block text-foreground">Veterinário</label>
                    <SearchablePicker
                      key={`vet-all-${specialtyFilter}`}
                      label="Veterinário"
                      placeholder="Buscar veterinário"
                      items={catalogItems}
                      selectedId={selectedCatalogId}
                      onSelect={(item) => setSelectedCatalogId(item?.id ?? '')}
                      emptyText={loadingCatalog ? 'Carregando veterinários...' : providerDescription}
                    />
                  </div>

                  {selectedCatalogItem ? (
                    <div className="rounded-[22px] border border-border bg-background px-4 py-4">
                      <p className="text-sm text-foreground">Veterinário selecionado</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedCatalogItem.description || 'Disponível para agendamento direto'}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                      Sem vínculo com clínica também aparece aqui.
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-foreground">Data</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-[18px] border border-border bg-[#efe9de] py-3 pl-12 pr-4 text-foreground outline-none transition-colors focus:border-primary" required />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-foreground">Horário</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-[18px] border border-border bg-[#efe9de] py-3 pl-12 pr-4 text-foreground outline-none transition-colors focus:border-primary" required />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-foreground">Motivo</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[110px] w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" rows={3} placeholder="Ex: Checkup anual, vacinação, sintomas de prostração, etc." required />
              </div>

              <div className={`rounded-[22px] border px-4 py-3 text-sm ${availability.isAvailable === false ? 'border-amber-200 bg-amber-50 text-amber-800' : availability.isAvailable ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-border bg-muted/20 text-muted-foreground'}`}>
                <p>{availability.loading ? 'Verificando disponibilidade...' : availability.message}</p>
                {availability.busyTimes.length > 0 ? <p className="mt-1 text-xs">Horários ocupados: {availability.busyTimes.join(', ')}</p> : null}
              </div>

              <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-primary py-3 text-white transition-colors hover:bg-primary/90">
                Confirmar Agendamento
              </button>
            </form>
          </section>
        )}

        <section className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-medium text-foreground">Agendadas</h2>
            <span className="text-sm text-muted-foreground">{scheduled.length} consulta{scheduled.length === 1 ? '' : 's'}</span>
          </div>
          {scheduled.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Calendar className="h-6 w-6" /></div>
              <p className="text-muted-foreground">Nenhuma consulta agendada</p>
              {user?.userType === 'owner' && (
                <p className="text-sm text-muted-foreground">Clique em <span className="font-medium text-foreground">“Nova Consulta”</span> para marcar uma.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {scheduled.map((appointment) => (
                <div key={appointment.id} className="flex items-center gap-4 rounded-[24px] border border-border/70 bg-muted/25 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Calendar className="h-6 w-6" /></div>
                  <div className="flex-1">
                    <p className="mb-1 text-foreground">{appointment.petName}</p>
                    <p className="text-sm text-muted-foreground">{appointment.reason}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{appointment.veterinarianName || appointment.clinicName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-foreground">{appointment.date}</p>
                    <p className="text-sm text-muted-foreground">{appointment.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-medium text-foreground">Concluídas</h2>
            <span className="text-sm text-muted-foreground">{completed.length} consulta{completed.length === 1 ? '' : 's'}</span>
          </div>
          {completed.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhuma consulta concluída</p>
          ) : (
            <div className="space-y-3">
              {completed.map((appointment) => {
                const review = getReviewForAppointment(appointment.id);
                return (
                  <div key={appointment.id} className="flex items-start gap-4 rounded-[24px] border border-border/70 bg-muted/25 p-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><Calendar className="h-6 w-6" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-foreground">{appointment.petName}</p>
                      <p className="text-sm text-muted-foreground">{appointment.reason}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{appointment.veterinarianName || appointment.clinicName}</p>
                      {appointment.veterinarianEmail && (
                        <a href={`mailto:${appointment.veterinarianEmail}`} className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground transition-colors hover:bg-muted">
                          <Mail className="h-3.5 w-3.5" />Contato direto
                        </a>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {review ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-primary"><MessageSquare className="h-3.5 w-3.5" />Avaliação registrada</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-amber-600"><MessageSquare className="h-3.5 w-3.5" />Sem avaliação</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                      <p className="text-foreground">{appointment.date}</p>
                      <p className="text-sm text-muted-foreground">{appointment.time}</p>
                      {user?.userType === 'owner' && appointment.veterinarianId && (
                        <button onClick={() => openReview(appointment.id)} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground transition-colors hover:bg-muted">
                          <PenLine className="h-3.5 w-3.5" />{review ? 'Editar avaliação' : 'Avaliar'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {activeReviewAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-[32px] border border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h3 className="text-lg text-foreground">Avaliar atendimento</h3>
                <p className="text-xs text-muted-foreground">{activeReviewAppointment.veterinarianName || activeReviewAppointment.clinicName}</p>
              </div>
              <button onClick={closeReview} className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted">Fechar</button>
            </div>
            <form onSubmit={submitReview} className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-2 block text-sm text-foreground">Nota</label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button key={value} type="button" onClick={() => setReviewRating(value)} className={`inline-flex items-center gap-1 rounded-full border px-3 py-2 text-sm transition-colors ${reviewRating >= value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-foreground'}`}>
                      <Star className="h-4 w-4" />{value}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm text-foreground">Comentário</label>
                <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} rows={4} className="w-full rounded-[18px] border border-border bg-background px-4 py-3 text-foreground" placeholder="Descreva a qualidade do atendimento..." />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>{activeReview && <button type="button" onClick={removeReview} className="inline-flex items-center gap-2 rounded-[18px] border border-rose-300 bg-rose-50 px-4 py-2 text-rose-700 transition-colors hover:bg-rose-100"><Trash2 className="h-4 w-4" />Excluir</button>}</div>
                <div className="flex gap-2">
                  <button type="button" onClick={closeReview} className="rounded-[18px] border border-border px-4 py-2 text-foreground transition-colors hover:bg-muted">Cancelar</button>
                  <button type="submit" className="rounded-[18px] bg-primary px-4 py-2 text-white transition-colors hover:bg-primary/90">Salvar avaliação</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </TutorShell>
  );
}







