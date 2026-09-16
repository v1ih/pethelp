import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, Star, ThumbsUp } from 'lucide-react';
import { ClinicShell } from '../components/layout/ClinicShell';
import { useInteraction } from '../context/InteractionContext';
import { useReviews } from '../context/ReviewsContext';
import { useSession } from '../context/SessionContext';
import { getApiBase, getAuthHeaders } from '../context/shared';
import { useDashboardBackLogout } from '../navigation';

type ClinicLink = {
  id: string;
  veterinarianId: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: 'clinic' | 'veterinarian';
  veterinarianName: string;
  veterinarianEmail: string;
  veterinarianCrmv: string;
  veterinarianCrmvUf: string;
};

type HistoryTab = 'appointments' | 'reviews';

function RatingStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1 text-[#f4a64a]">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className={`h-4 w-4 ${index < Math.round(value) ? 'fill-current' : 'opacity-30'}`} />
      ))}
    </div>
  );
}

export default function ClinicHistoryScreen() {
  const { user } = useSession();
  const { appointments } = useInteraction();
  const { reviews } = useReviews();
  useDashboardBackLogout();

  const [tab, setTab] = useState<HistoryTab>('appointments');
  const [links, setLinks] = useState<ClinicLink[]>([]);
  const API_BASE = getApiBase();

  useEffect(() => {
    let cancelled = false;

    const loadLinks = async () => {
      const resp = await fetch(`${API_BASE}/api/clinic-links/me`, {
        headers: getAuthHeaders(),
      });

      if (!resp.ok) return;

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

  const clinicName = user?.clinicName || user?.name || 'Clínica';
  const approvedLinks = useMemo(() => links.filter((link) => link.status === 'approved'), [links]);
  const clinicVeterinarianIds = useMemo(() => approvedLinks.map((link) => link.veterinarianId), [approvedLinks]);

  const clinicAppointments = useMemo(
    () =>
      appointments.filter((appointment) =>
        appointment.clinicName ? appointment.clinicName === clinicName : clinicVeterinarianIds.includes(appointment.veterinarianId ?? '')
      ),
    [appointments, clinicName, clinicVeterinarianIds]
  );

  const clinicReviews = useMemo(
    () =>
      reviews.filter((review) =>
        review.clinicName ? review.clinicName === clinicName : clinicVeterinarianIds.includes(review.veterinarianId)
      ),
    [clinicName, clinicVeterinarianIds, reviews]
  );

  const completedAppointments = clinicAppointments.filter((appointment) => appointment.status === 'completed');
  const averageRating = clinicReviews.length > 0 ? clinicReviews.reduce((sum, review) => sum + review.rating, 0) / clinicReviews.length : 0;

  const formatDate = (value: string | undefined) => {
    if (!value) return 'Data indisponível';
    // Date-only strings (YYYY-MM-DD) parse as UTC midnight, which shifts a day back
    // in negative-offset timezones. Anchor them to local noon to keep the calendar date.
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const parsed = new Date(isDateOnly ? `${value}T12:00:00` : value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('pt-BR');
  };

  return (
    <ClinicShell
      active="history"
      title="Histórico de atendimentos"
      description="Consulte consultas concluídas e avaliações recebidas pela clínica."
      actions={
        <div className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground">
          {completedAppointments.length} atendimento{completedAppointments.length === 1 ? '' : 's'}
        </div>
      }
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
            <p className="text-sm text-muted-foreground">Consultas</p>
            <p className="mt-2 text-3xl font-medium text-foreground">{completedAppointments.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">Atendimentos concluídos associados à clínica.</p>
          </div>
          <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
            <p className="text-sm text-muted-foreground">Avaliações</p>
            <p className="mt-2 text-3xl font-medium text-foreground">{clinicReviews.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">Retorno dos tutores após os atendimentos.</p>
          </div>
          <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
            <p className="text-sm text-muted-foreground">Média</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-3xl font-medium text-foreground">{averageRating > 0 ? averageRating.toFixed(1) : '0.0'}</p>
              <RatingStars value={averageRating} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Indicador geral do histórico da clínica.</p>
          </div>
        </section>

        <section className="rounded-[32px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTab('appointments')}
              className={`rounded-[22px] border px-4 py-4 text-left transition-colors ${
                tab === 'appointments'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              }`}
            >
              <p className="text-sm font-medium">Consultas realizadas</p>
              <p className="mt-1 text-xs opacity-80">Histórico clínico da operação.</p>
            </button>
            <button
              type="button"
              onClick={() => setTab('reviews')}
              className={`rounded-[22px] border px-4 py-4 text-left transition-colors ${
                tab === 'reviews'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              }`}
            >
              <p className="text-sm font-medium">Avaliações recebidas</p>
              <p className="mt-1 text-xs opacity-80">Notas e comentários dos tutores.</p>
            </button>
          </div>
        </section>

        {tab === 'appointments' ? (
          <section className="space-y-3">
            {completedAppointments.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                Nenhuma consulta concluída encontrada.
              </div>
            ) : (
              completedAppointments.map((appointment) => (
                <div key={appointment.id} className="rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-foreground">{appointment.petName}</p>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">Concluído</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{appointment.veterinarianName || appointment.clinicName || 'Atendimento clínico'}</p>
                      <p className="text-sm text-muted-foreground">{appointment.reason}</p>
                      <div className="rounded-[20px] border border-border bg-muted/20 px-4 py-3">
                        <p className="text-sm text-foreground">{appointment.veterinarianName || appointment.clinicName || 'Atendimento clínico'}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Status do atendimento {appointment.status}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-start gap-3 text-left lg:items-end lg:text-right">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <span className="text-sm text-foreground">{formatDate(appointment.date)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{appointment.time}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        ) : null}

        {tab === 'reviews' ? (
          <section className="space-y-3">
            {clinicReviews.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                Nenhuma avaliação encontrada.
              </div>
            ) : (
              clinicReviews.map((review) => (
                <div key={review.id} className="rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-foreground">{review.tutorName}</p>
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-700">Avaliação</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{review.veterinarianName}</p>
                      <p className="text-sm text-muted-foreground">"{review.comment}"</p>
                    </div>

                    <div className="flex flex-col items-start gap-3 lg:items-end">
                      <RatingStars value={review.rating} />
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ThumbsUp className="h-4 w-4 text-primary" />
                        {formatDate(review.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        ) : null}
      </div>
    </ClinicShell>
  );
}
