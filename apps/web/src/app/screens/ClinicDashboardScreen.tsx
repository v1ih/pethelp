import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { CalendarDays, CheckCircle2, ClipboardList, Copy, Link2, MessageSquare, PawPrint, ShieldAlert, Star, Stethoscope, Users } from 'lucide-react';
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

function RatingStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1 text-[#f4a64a]">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className={`h-4 w-4 ${index < Math.round(value) ? 'fill-current' : 'opacity-30'}`} />
      ))}
    </div>
  );
}

export default function ClinicDashboardScreen() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { notifications, appointments } = useInteraction();
  const { reviews } = useReviews();
  useDashboardBackLogout();

  const [links, setLinks] = useState<ClinicLink[]>([]);
  const [copyFeedback, setCopyFeedback] = useState(false);
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
  const pendingLinks = useMemo(() => links.filter((link) => link.status === 'pending'), [links]);
  const clinicVeterinarianIds = useMemo(() => approvedLinks.map((link) => link.veterinarianId), [approvedLinks]);
  const clinicReviews = useMemo(
    () =>
      reviews.filter((review) =>
        review.clinicName ? review.clinicName === clinicName : clinicVeterinarianIds.includes(review.veterinarianId)
      ),
    [clinicName, clinicVeterinarianIds, reviews]
  );
  const averageRating = clinicReviews.length > 0 ? clinicReviews.reduce((sum, review) => sum + review.rating, 0) / clinicReviews.length : 0;
  const unreadNotifications = notifications.filter((notification) => notification.userId === user?.id && !notification.read).length;
  const connectionCode = user?.connectionCode?.trim() ?? '';
  const todaysAppointments = useMemo(() => {
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);

    return appointments.filter((appointment) => {
      const appointmentDay = String(appointment.date ?? '').slice(0, 10);
      const matchesClinic = appointment.clinicName ? appointment.clinicName === clinicName : clinicVeterinarianIds.includes(appointment.veterinarianId ?? '');
      return matchesClinic && appointmentDay === todayKey;
    });
  }, [appointments, clinicName, clinicVeterinarianIds]);

  const recentReviews = useMemo(() => clinicReviews.slice(0, 3), [clinicReviews]);
  const recentAppointments = useMemo(() => todaysAppointments.slice(0, 3), [todaysAppointments]);

  const handleCopyConnectionCode = async () => {
    if (!connectionCode) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(connectionCode);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = connectionCode;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 2000);
    } catch (error) {
      console.error('Falha ao copiar código da clínica:', error);
    }
  };

  return (
    <ClinicShell
      active="dashboard"
      title="Dashboard da clínica"
      description="Visão geral da operação, vínculos aprovados, notas e acesso rápido ao código de conexão."
      actions={
        <>
          <button
            type="button"
            onClick={() => navigate('/clinic-pet-registration')}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 sm:w-auto"
          >
            <PawPrint className="h-5 w-5" />
            Cadastrar pet
          </button>
          <button
            type="button"
            onClick={() => navigate('/clinic-veterinarians')}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-border bg-card px-5 py-3 text-foreground transition-colors hover:bg-muted sm:w-auto"
          >
            <Users className="h-5 w-5" />
            Gerenciar veterinários
          </button>
          <button
            type="button"
            onClick={() => navigate('/clinic-agenda')}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-border bg-card px-5 py-3 text-foreground transition-colors hover:bg-muted sm:w-auto"
          >
            <CalendarDays className="h-5 w-5" />
            Abrir agenda
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <section>
          <div className="rounded-[32px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
            <div>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <div className="rounded-[24px] border border-border bg-background p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Veterinários</p>
                  <p className="mt-2 text-3xl text-foreground">{approvedLinks.length}</p>
                </div>
                <div className="rounded-[24px] border border-border bg-background p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Pendentes</p>
                  <p className="mt-2 text-3xl text-foreground">{pendingLinks.length}</p>
                </div>
                <div className="rounded-[24px] border border-border bg-background p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Consultas hoje</p>
                  <p className="mt-2 text-3xl text-foreground">{todaysAppointments.length}</p>
                </div>
                <div className="rounded-[24px] border border-border bg-background p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Avaliação</p>
                  <p className="mt-2 text-3xl text-foreground">{averageRating > 0 ? averageRating.toFixed(1) : '0.0'}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="min-w-0 rounded-[28px] border border-primary/15 bg-primary/5 px-4 py-5 sm:px-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Link2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Código da clínica</p>
                    <p className="mt-1 text-sm text-muted-foreground">Compartilhe com veterinários para solicitar vínculo direto com a sua clínica.</p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 break-all rounded-[22px] border border-dashed border-border bg-card px-3 py-3 text-center font-mono text-base tracking-[0.16em] text-foreground sm:px-4 sm:py-4 sm:text-lg sm:tracking-[0.28em]">
                        {connectionCode || 'Sem código disponível'}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyConnectionCode}
                        className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[18px] bg-primary px-4 py-3 text-white transition-colors hover:bg-primary/90"
                      >
                        <Copy className="h-4 w-4" />
                        {copyFeedback ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-w-0 rounded-[28px] border border-border bg-background p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Média geral</p>
                    <h3 className="text-3xl font-medium text-foreground">{averageRating > 0 ? averageRating.toFixed(1) : '0.0'}</h3>
                  </div>
                  <RatingStars value={averageRating} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{clinicReviews.length} avaliaç{clinicReviews.length === 1 ? 'ão' : 'ões'} registrada{clinicReviews.length === 1 ? '' : 's'}</p>
                {recentReviews[0] ? (
                  <div className="mt-4 rounded-[22px] border border-border bg-muted/25 p-4">
                    <p className="text-sm text-foreground">{recentReviews[0].tutorName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{recentReviews[0].comment}</p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-[22px] border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    Nenhuma avaliação registrada ainda.
                  </div>
                )}
              </div>
            </div>
          </div>

        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-[32px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Hoje</p>
                <h3 className="text-2xl font-medium text-foreground">Consultas agendadas</h3>
              </div>
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>

            <div className="mt-5 space-y-3">
              {recentAppointments.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-border bg-muted/20 p-5 text-sm text-muted-foreground">
                  Nenhuma consulta encontrada para hoje.
                </div>
              ) : (
                recentAppointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between gap-4 rounded-[22px] border border-border bg-background px-4 py-4">
                    <div>
                      <p className="text-foreground">{appointment.petName}</p>
                      <p className="text-sm text-muted-foreground">
                        {appointment.veterinarianName || appointment.clinicName || 'Consulta clínica'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-foreground">{appointment.time}</p>
                      <p className="text-xs text-muted-foreground">{appointment.reason}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[32px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Recentes</p>
                <h3 className="text-2xl font-medium text-foreground">Últimas avaliações</h3>
              </div>
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>

            <div className="mt-5 space-y-3">
              {recentReviews.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-border bg-muted/20 p-5 text-sm text-muted-foreground">
                  Nenhuma avaliação registrada ainda.
                </div>
              ) : (
                recentReviews.map((review) => (
                  <div key={review.id} className="rounded-[22px] border border-border bg-background px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-foreground">{review.tutorName}</p>
                    <p className="text-sm text-muted-foreground">{review.veterinarianName}</p>
                      </div>
                      <RatingStars value={review.rating} />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">"{review.comment}"</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </ClinicShell>
  );
}
