import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Link2, Trash2 } from 'lucide-react';
import VeterinarianShell from '../components/layout/VeterinarianShell';
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

export default function VeterinarianLinksScreen() {
  const { user } = useSession();
  useDashboardBackLogout();

  const [linkTab, setLinkTab] = useState<'connect' | 'active' | 'pending'>('connect');
  const [connectionCode, setConnectionCode] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [links, setLinks] = useState<ClinicLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const API_BASE = getApiBase();

  useEffect(() => {
    let cancelled = false;

    const loadLinks = async () => {
      setLinksLoading(true);
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
        if (!cancelled) {
          setLinks([]);
        }
      } finally {
        if (!cancelled) {
          setLinksLoading(false);
        }
      }
    };

    void loadLinks();

    return () => {
      cancelled = true;
    };
  }, [API_BASE]);

  const activeLinks = useMemo(() => links.filter((link) => link.status === 'approved'), [links]);
  const pendingLinks = useMemo(
    () => links.filter((link) => link.status === 'pending' || link.status === 'rejected'),
    [links]
  );

  const handleRequestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const code = connectionCode.trim().toUpperCase();
    if (!code) {
      setFeedback({ type: 'error', message: 'Informe o código da clínica.' });
      return;
    }

    setSavingLink(true);
    try {
      const resp = await fetch(`${getApiBase()}/api/clinic-links/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ connectionCode: code }),
      });

      if (!resp.ok) {
        const payload = await resp.json().catch(() => null);
        throw new Error(payload?.message ?? 'Request failed');
      }

      const { data } = await resp.json();
      if (data) {
        setLinks((prev) => [data as ClinicLink, ...prev.filter((link) => link.id !== data.id)]);
      }
      setConnectionCode('');
      setFeedback({ type: 'success', message: 'Solicitação enviada com sucesso.' });
      setLinkTab('pending');
    } catch (error) {
      console.error('Falha ao solicitar vínculo com clínica:', error);
      setFeedback({ type: 'error', message: 'Não foi possível solicitar o vínculo.' });
    } finally {
      setSavingLink(false);
    }
  };

  const handleAcceptLink = async (linkId: string) => {
    setFeedback(null);
    try {
      const resp = await fetch(`${getApiBase()}/api/clinic-links/${linkId}/accept`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!resp.ok) {
        const payload = await resp.json().catch(() => null);
        throw new Error(payload?.message ?? 'Accept failed');
      }

      const { data } = await resp.json();
      if (data) {
        setLinks((prev) => [data as ClinicLink, ...prev.filter((link) => link.id !== data.id)]);
      }
      setFeedback({ type: 'success', message: 'Vínculo aceito.' });
    } catch (error) {
      console.error('Falha ao aceitar vínculo:', error);
      setFeedback({ type: 'error', message: 'Não foi possível aceitar o vínculo.' });
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    setFeedback(null);
    try {
      const resp = await fetch(`${getApiBase()}/api/clinic-links/${linkId}`, {
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
    }
  };

  return (
    <VeterinarianShell
      active="links"
      title="Vínculos institucionais"
      description="Conecte-se a clínicas e administre solicitações pendentes."
      actions={<span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{links.length} vínculo{links.length === 1 ? '' : 's'}</span>}
    >
      <div className="space-y-6">
        <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
          {feedback ? (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                feedback.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setLinkTab('connect')}
              className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                linkTab === 'connect'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              }`}
            >
              <p className="text-sm font-medium">Conectar com Clínica</p>
              <p className="text-xs opacity-80">Solicite vínculo usando o código da clínica.</p>
            </button>
            <button
              type="button"
              onClick={() => setLinkTab('pending')}
              className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                linkTab === 'pending'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              }`}
            >
              <p className="text-sm font-medium">Pendentes</p>
              <p className="text-xs opacity-80">Aceite ou remova solicitações.</p>
            </button>
            <button
              type="button"
              onClick={() => setLinkTab('active')}
              className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                linkTab === 'active'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              }`}
            >
              <p className="text-sm font-medium">Ativos</p>
              <p className="text-xs opacity-80">Clínicas conectadas e liberadas.</p>
            </button>
          </div>
        </section>

        {linkTab === 'connect' ? (
          <section className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Solicitação</p>
                <h2 className="text-2xl text-foreground">Conectar com clínica</h2>
              </div>
              <Link2 className="h-6 w-6 text-primary" />
            </div>

            <form onSubmit={handleRequestLink} className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-foreground">Código da clínica</label>
                <div className="relative">
                  <Link2 className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={connectionCode}
                    onChange={(event) => setConnectionCode(event.target.value.toUpperCase())}
                    placeholder="CL-8X4F2K"
                    className="w-full rounded-2xl border-2 border-border bg-input py-3 pl-12 pr-4 uppercase tracking-wider text-foreground transition-colors focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingLink}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Link2 className="h-4 w-4" />
                {savingLink ? 'Solicitando...' : 'Solicitar vínculo'}
              </button>
            </form>
          </section>
        ) : null}

        {linkTab === 'active' ? (
          <section className="space-y-3">
            {linksLoading ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-sm text-muted-foreground">
                Carregando vínculos...
              </div>
            ) : activeLinks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-sm text-muted-foreground">
                Nenhuma clínica ativa no momento.
              </div>
            ) : (
              activeLinks.map((link) => (
                <div key={link.id} className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-foreground">{link.clinicName || 'Clínica'}</p>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs text-emerald-700">Ativo</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{link.veterinarianEmail}</p>
                      <p className="text-xs text-muted-foreground">CRMV {link.veterinarianCrmv}/{link.veterinarianCrmvUf}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleRemoveLink(link.id)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 transition-colors hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        ) : null}

        {linkTab === 'pending' ? (
          <section className="space-y-3">
            {linksLoading ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-sm text-muted-foreground">
                Carregando vínculos...
              </div>
            ) : pendingLinks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5 text-sm text-muted-foreground">
                Nenhuma solicitação pendente no momento.
              </div>
            ) : (
              pendingLinks.map((link) => (
                <div key={link.id} className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-foreground">{link.clinicName || 'Clínica'}</p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${
                            link.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {link.status === 'pending' ? 'Pendente' : 'Recusado'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{link.veterinarianEmail}</p>
                      <p className="text-xs text-muted-foreground">CRMV {link.veterinarianCrmv}/{link.veterinarianCrmvUf}</p>
                      <p className="text-xs text-muted-foreground">
                        Solicitado por: {link.requestedBy === 'clinic' ? 'clínica' : 'veterinário'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {link.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => void handleAcceptLink(link.id)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary/90"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Aceitar
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleRemoveLink(link.id)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 transition-colors hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        ) : null}
      </div>
    </VeterinarianShell>
  );
}
