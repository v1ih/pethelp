import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Mail, ShieldCheck, Trash2, XCircle } from 'lucide-react';
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

type TabKey = 'connect' | 'active' | 'pending';

export default function ManageVeterinariansScreen() {
  const { user } = useSession();
  useDashboardBackLogout();

  const [tab, setTab] = useState<TabKey>('connect');
  const [inviteEmail, setInviteEmail] = useState('');
  const [links, setLinks] = useState<ClinicLink[]>([]);
  const [savingInvite, setSavingInvite] = useState(false);
  const [savingLinkId, setSavingLinkId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const API_BASE = getApiBase();

  useEffect(() => {
    let cancelled = false;

    const loadLinks = async () => {
      try {
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
      } catch (error) {
        console.error('Falha ao carregar vínculos da clínica:', error);
        if (!cancelled) setLinks([]);
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
  const incomingRequests = useMemo(
    () => pendingLinks.filter((link) => link.requestedBy === 'veterinarian'),
    [pendingLinks]
  );
  const sentInvites = useMemo(
    () => pendingLinks.filter((link) => link.requestedBy === 'clinic'),
    [pendingLinks]
  );

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setFeedback({ type: 'error', message: 'Informe o e-mail do veterinário.' });
      return;
    }

    setSavingInvite(true);
    try {
      const resp = await fetch(`${API_BASE}/api/clinic-links/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ veterinarianEmail: email }),
      });

      if (!resp.ok) {
        const payload = await resp.json().catch(() => null);
        throw new Error(payload?.message ?? 'Request failed');
      }

      const { data } = await resp.json();
      if (data) {
        setLinks((prev) => [data as ClinicLink, ...prev.filter((link) => link.id !== data.id)]);
      }

      setInviteEmail('');
      setFeedback({ type: 'success', message: 'Convite enviado com sucesso.' });
      setTab('pending');
    } catch (error) {
      console.error('Falha ao convidar veterinário:', error);
      setFeedback({ type: 'error', message: 'Não foi possível enviar o convite.' });
    } finally {
      setSavingInvite(false);
    }
  };

  const handleUpdateLinkStatus = async (linkId: string, nextStatus: 'approved' | 'rejected') => {
    if (savingLinkId) return;

    setSavingLinkId(linkId);
    setFeedback(null);

    try {
      const resp = await fetch(`${API_BASE}/api/clinic-links/${linkId}/${nextStatus === 'approved' ? 'approve' : 'reject'}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!resp.ok) {
        const payload = await resp.json().catch(() => null);
        throw new Error(payload?.message ?? 'Request failed');
      }

      const { data } = await resp.json();
      if (data) {
        setLinks((prev) => [data as ClinicLink, ...prev.filter((link) => link.id !== data.id)]);
      }

      setFeedback({ type: 'success', message: nextStatus === 'approved' ? 'Vínculo aprovado.' : 'Vínculo recusado.' });
    } catch (error) {
      console.error(`Falha ao ${nextStatus === 'approved' ? 'aprovar' : 'recusar'} vínculo:`, error);
      setFeedback({ type: 'error', message: 'Não foi possível atualizar o vínculo.' });
    } finally {
      setSavingLinkId(null);
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    if (savingLinkId) return;

    setSavingLinkId(linkId);
    setFeedback(null);

    try {
      const resp = await fetch(`${API_BASE}/api/clinic-links/${linkId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!(resp.ok || resp.status === 204)) {
        const payload = await resp.json().catch(() => null);
        throw new Error(payload?.message ?? 'Remove failed');
      }

      setLinks((prev) => prev.filter((link) => link.id !== linkId));
      setFeedback({ type: 'success', message: 'Vínculo removido.' });
    } catch (error) {
      console.error('Falha ao remover vínculo:', error);
      setFeedback({ type: 'error', message: 'Não foi possível remover o vínculo.' });
    } finally {
      setSavingLinkId(null);
    }
  };

  return (
    <ClinicShell
      active="veterinarians"
      title="Gerenciar veterinários"
      description="Convide profissionais, aprove vínculos pendentes e remova conexões desnecessárias."
      actions={
        <div className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground">
          {approvedLinks.length} ativo{approvedLinks.length === 1 ? '' : 's'}
        </div>
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
            <p className="text-sm text-muted-foreground">Clínica</p>
            <p className="mt-2 text-2xl font-medium text-foreground">{clinicName}</p>
            <p className="mt-2 text-sm text-muted-foreground">Fluxo de vínculos e gestão de equipe vinculado ao painel da clínica.</p>
          </div>
          <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
            <p className="text-sm text-muted-foreground">Ativos</p>
            <p className="mt-2 text-3xl font-medium text-foreground">{approvedLinks.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">Veterinários já liberados.</p>
          </div>
          <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
            <p className="text-sm text-muted-foreground">Pendentes</p>
            <p className="mt-2 text-3xl font-medium text-foreground">{pendingLinks.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">Convites aguardando resposta.</p>
          </div>
        </section>

        <section className="rounded-[32px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setTab('connect')}
              className={`rounded-[22px] border px-4 py-4 text-left transition-colors ${
                tab === 'connect'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              }`}
            >
              <p className="text-sm font-medium">Convidar</p>
              <p className="mt-1 text-xs opacity-80">Enviar convite por e-mail.</p>
            </button>
            <button
              type="button"
              onClick={() => setTab('pending')}
              className={`rounded-[22px] border px-4 py-4 text-left transition-colors ${
                tab === 'pending'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              }`}
            >
              <p className="text-sm font-medium">Pendentes</p>
              <p className="mt-1 text-xs opacity-80">Aprovar ou recusar solicitações.</p>
            </button>
            <button
              type="button"
              onClick={() => setTab('active')}
              className={`rounded-[22px] border px-4 py-4 text-left transition-colors ${
                tab === 'active'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              }`}
            >
              <p className="text-sm font-medium">Ativos</p>
              <p className="mt-1 text-xs opacity-80">Lista de profissionais liberados.</p>
            </button>
          </div>
        </section>

        {tab === 'connect' ? (
          <section className="rounded-[32px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Novo vínculo</p>
                <h2 className="text-2xl font-medium text-foreground">Convidar veterinário</h2>
              </div>
              <Mail className="h-6 w-6 text-primary" />
            </div>

            <form onSubmit={handleInvite} className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="mb-2 block text-sm text-foreground">E-mail do veterinário</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="veterinario@exemplo.com"
                    className="w-full rounded-[18px] border border-border bg-[#efe9de] py-3 pl-12 pr-4 text-foreground outline-none transition-colors focus:border-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingInvite}
                className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                {savingInvite ? 'Enviando...' : 'Enviar convite'}
              </button>
            </form>
          </section>
        ) : null}

        {tab === 'pending' ? (
          <section className="space-y-4">
            {pendingLinks.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                Nenhuma solicitação pendente no momento.
              </div>
            ) : null}

            {incomingRequests.length > 0 ? (
              <div className="space-y-3 rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
                <div>
                  <p className="text-sm text-muted-foreground">Solicitações recebidas</p>
                  <h3 className="text-xl text-foreground">Veterinários que pediram vínculo com a clínica</h3>
                </div>
                {incomingRequests.map((link) => (
                  <div key={link.id} className="rounded-[24px] border border-border bg-background p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-foreground">{link.veterinarianName}</p>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-700">Pendente</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{link.veterinarianEmail}</p>
                        <p className="text-xs text-muted-foreground">CRMV {link.veterinarianCrmv}/{link.veterinarianCrmvUf}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Solicitação enviada pelo veterinário. Aprove para liberar o acesso.</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleUpdateLinkStatus(link.id, 'approved')}
                          disabled={savingLinkId === link.id}
                          className="inline-flex items-center gap-2 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleUpdateLinkStatus(link.id, 'rejected')}
                          disabled={savingLinkId === link.id}
                          className="inline-flex items-center gap-2 rounded-[18px] border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <XCircle className="h-4 w-4" />
                          Recusar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {sentInvites.length > 0 ? (
              <div className="space-y-3 rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
                <div>
                  <p className="text-sm text-muted-foreground">Convites enviados</p>
                  <h3 className="text-xl text-foreground">Veterinários que ainda não responderam ao convite</h3>
                </div>
                {sentInvites.map((link) => (
                  <div key={link.id} className="rounded-[24px] border border-border bg-background p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-foreground">{link.veterinarianName}</p>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-700">Pendente</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{link.veterinarianEmail}</p>
                        <p className="text-xs text-muted-foreground">CRMV {link.veterinarianCrmv}/{link.veterinarianCrmvUf}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Convite enviado pela clínica. O veterinário precisa aceitar.</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleRemoveLink(link.id)}
                        disabled={savingLinkId === link.id}
                        className="inline-flex items-center gap-2 rounded-[18px] border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        Cancelar convite
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === 'active' ? (
          <section className="space-y-3">
            {approvedLinks.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                Nenhum veterinário ativo ainda.
              </div>
            ) : (
              approvedLinks.map((link) => (
                <div key={link.id} className="rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-foreground">{link.veterinarianName}</p>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs text-emerald-700">Ativo</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{link.veterinarianEmail}</p>
                      <p className="text-xs text-muted-foreground">CRMV {link.veterinarianCrmv}/{link.veterinarianCrmvUf}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleRemoveLink(link.id)}
                      disabled={savingLinkId === link.id}
                      className="inline-flex items-center gap-2 rounded-[18px] border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      Desvincular
                    </button>
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
