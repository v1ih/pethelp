import React, { useCallback, useEffect, useState } from 'react';
import { History, RefreshCw, X } from 'lucide-react';
import { getApiBase, getAuthHeaders } from '../../context/shared';

// Histórico de quem lançou ou alterou cada informação do pet. Serve para a clínica
// mostrar, depois, que tal dado foi registrado por tal pessoa — e para o responsável
// enxergar o mesmo, sem depender da palavra de ninguém.

type AuditChange = { field: string; label: string; from: unknown; to: unknown };

type AuditEntry = {
  id: string;
  entityType: string;
  action: 'create' | 'update' | 'delete';
  actorRole: string | null;
  actorName: string | null;
  summary: string;
  changes: AuditChange[];
  createdAt: string;
};

const ROLE_LABEL: Record<string, string> = {
  tutor: 'Responsável',
  clinic: 'Clínica',
  veterinarian: 'Veterinário',
};

const ACTION_STYLE: Record<AuditEntry['action'], string> = {
  create: 'bg-primary/10 text-primary',
  update: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  delete: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};

const ACTION_LABEL: Record<AuditEntry['action'], string> = {
  create: 'Incluiu',
  update: 'Alterou',
  delete: 'Removeu',
};

function formatMoment(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'sim' : 'não';

  const text = String(value);

  // Data solta no formato do banco fica ilegível para quem lê o histórico.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00`).toLocaleDateString('pt-BR');
  }

  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export function PetAuditTrail({
  petId,
  petName,
  onClose,
}: {
  petId: string;
  petName?: string | null;
  onClose: () => void;
}) {
  const API_BASE = getApiBase();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/api/audit/pet/${petId}`, { headers: getAuthHeaders() });
      const payload = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(payload?.message ?? 'Não foi possível carregar o histórico.');
      setEntries((payload?.data ?? []) as AuditEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o histórico.');
    } finally {
      setLoading(false);
    }
  }, [API_BASE, petId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Histórico de alterações"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-[28px] border border-border bg-card shadow-2xl sm:max-w-[560px] sm:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <History className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-medium text-foreground">Histórico de alterações</h2>
              <p className="text-sm text-muted-foreground">
                {petName ? `Tudo que foi lançado ou alterado em ${petName}.` : 'Tudo que foi lançado ou alterado.'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => void load()}
              aria-label="Atualizar"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : entries.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-border p-6 text-center">
              <p className="text-foreground">Nenhuma alteração registrada ainda.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A partir de agora, cada lançamento e cada alteração aparece aqui com o autor e a data.
              </p>
            </div>
          ) : (
            <ol className="space-y-3">
              {entries.map((entry) => (
                <li key={entry.id} className="rounded-[22px] border border-border bg-background p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs ${ACTION_STYLE[entry.action]}`}>
                      {ACTION_LABEL[entry.action]}
                    </span>
                    <span className="text-sm text-muted-foreground">{formatMoment(entry.createdAt)}</span>
                  </div>

                  <p className="mt-2 text-foreground">{entry.summary}</p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {ROLE_LABEL[entry.actorRole ?? ''] ?? 'Usuário'}: {entry.actorName ?? 'não identificado'}
                  </p>

                  {entry.changes?.length ? (
                    <ul className="mt-3 space-y-1 border-t border-border pt-3">
                      {entry.changes.map((change, index) => (
                        <li key={`${entry.id}-${change.field}-${index}`} className="text-sm">
                          <span className="text-muted-foreground">{change.label}: </span>
                          <span className="text-muted-foreground line-through">{formatValue(change.from)}</span>
                          <span className="text-muted-foreground"> → </span>
                          <span className="text-foreground">{formatValue(change.to)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

export default PetAuditTrail;
