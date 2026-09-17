import React, { useEffect, useState } from 'react';
import { Crown, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { getApiBase, getAuthHeaders } from '../../context/shared';
import { useSession } from '../../context/SessionContext';

type Guardian = {
  tutorId: string;
  name: string;
  email: string;
  isPrimary: boolean;
};

export default function SharedGuardians({ petId }: { petId: string }) {
  const { user } = useSession();
  const API_BASE = getApiBase();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/pets/${petId}/guardians`, { headers: getAuthHeaders() });
        if (!resp.ok) {
          if (!cancelled) setGuardians([]);
          return;
        }
        const { data } = await resp.json();
        if (!cancelled) setGuardians((data ?? []) as Guardian[]);
      } catch {
        if (!cancelled) setGuardians([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [API_BASE, petId]);

  const primary = guardians.find((guardian) => guardian.isPrimary);
  const shared = guardians.filter((guardian) => !guardian.isPrimary);
  const isPrimaryOwner = Boolean(primary && user?.email && primary.email.toLowerCase() === user.email.toLowerCase());

  const addGuardian = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!value) return;

    setSaving(true);
    try {
      const resp = await fetch(`${API_BASE}/api/pets/${petId}/guardians`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ email: value }),
      });
      const payload = await resp.json().catch(() => null);
      if (!resp.ok) {
        toast.error(payload?.message ?? 'Não foi possível adicionar o responsável.');
        return;
      }
      setGuardians((payload?.data ?? []) as Guardian[]);
      setEmail('');
      toast.success('Responsável adicionado com sucesso!');
    } catch {
      toast.error('Não foi possível adicionar o responsável.');
    } finally {
      setSaving(false);
    }
  };

  const removeGuardian = async (tutorId: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/pets/${petId}/guardians/${tutorId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const payload = await resp.json().catch(() => null);
      if (!resp.ok) {
        toast.error(payload?.message ?? 'Não foi possível remover o responsável.');
        return;
      }
      setGuardians((payload?.data ?? guardians.filter((guardian) => guardian.tutorId !== tutorId)) as Guardian[]);
      toast.success('Responsável removido.');
    } catch {
      toast.error('Não foi possível remover o responsável.');
    }
  };

  return (
    <section className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
      <div className="mb-1 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl font-medium text-foreground">Guarda compartilhada</h2>
          <p className="text-sm text-muted-foreground">Pessoas que também cuidam deste pet.</p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {loading ? (
          <div className="h-16 animate-pulse rounded-2xl border border-border/70 bg-muted/30" />
        ) : guardians.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nenhum responsável encontrado.</p>
        ) : (
          guardians.map((guardian) => (
            <div key={guardian.tutorId} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/25 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {guardian.isPrimary ? <Crown className="h-5 w-5" /> : <Users className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground">{guardian.name}</p>
                <p className="truncate text-sm text-muted-foreground">{guardian.email}</p>
              </div>
              {guardian.isPrimary ? (
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Responsável principal</span>
              ) : (
                <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">Compartilhado</span>
              )}
              {isPrimaryOwner && !guardian.isPrimary ? (
                <button
                  type="button"
                  onClick={() => void removeGuardian(guardian.tutorId)}
                  aria-label={`Remover ${guardian.name}`}
                  className="shrink-0 rounded-full border border-rose-200 bg-rose-50 p-2 text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>

      {isPrimaryOwner ? (
        <form onSubmit={addGuardian} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-2 block text-sm text-foreground">Adicionar responsável (por e-mail)</label>
            <div className="relative">
              <UserPlus className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@dapessoa.com"
                className="w-full rounded-[18px] border border-border bg-input-background py-3 pl-12 pr-4 text-foreground outline-none transition-colors focus:border-primary"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {saving ? 'Adicionando...' : 'Adicionar'}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">Apenas o responsável principal pode adicionar ou remover pessoas.</p>
      )}
    </section>
  );
}
