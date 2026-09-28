import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plus, RefreshCw, Tags, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ProfessionalShell } from '../components/layout/ProfessionalShell';
import { getApiBase, getAuthHeaders } from '../context/shared';

// Tabela de preços da clínica / do veterinário autônomo. É a base do lançamento de
// cobranças: escolhe-se o serviço e o valor já vem preenchido.

type Category = { key: string; label: string };

type PriceItem = {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  amountCents: number;
  notes: string | null;
  isActive: boolean;
};

const EMPTY_FORM = { name: '', category: 'consulta', amount: '', notes: '' };

function formatMoney(amountCents: number) {
  return (amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** "180,00" para o campo de edição. */
function centsToInput(amountCents: number) {
  return (amountCents / 100).toFixed(2).replace('.', ',');
}

export default function PriceTableScreen() {
  const API_BASE = getApiBase();
  const [items, setItems] = useState<PriceItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/price-items?includeInactive=1`, { headers: getAuthHeaders() });
      if (!resp.ok) throw new Error((await resp.json().catch(() => null))?.message ?? 'Não foi possível carregar a tabela.');
      const payload = await resp.json();
      setItems(payload.data ?? []);
      setCategories(payload.categories ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar a tabela de preços.');
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => items.filter((item) => (showInactive ? true : item.isActive)),
    [items, showInactive]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, PriceItem[]>();
    for (const item of visible) {
      const list = map.get(item.categoryLabel) ?? [];
      list.push(item);
      map.set(item.categoryLabel, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [visible]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error('Informe o nome do serviço.');
      return;
    }
    if (!form.amount.trim()) {
      toast.error('Informe o valor do serviço.');
      return;
    }

    setSaving(true);
    try {
      const resp = await fetch(
        editingId ? `${API_BASE}/api/price-items/${editingId}` : `${API_BASE}/api/price-items`,
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            name: form.name.trim(),
            category: form.category,
            amount: form.amount,
            notes: form.notes.trim() || null,
          }),
        }
      );

      const payload = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(payload?.message ?? 'Não foi possível salvar o serviço.');

      toast.success(editingId ? 'Serviço atualizado.' : 'Serviço adicionado à tabela.');
      resetForm();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o serviço.');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (item: PriceItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      amount: centsToInput(item.amountCents),
      notes: item.notes ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleActive = async (item: PriceItem) => {
    try {
      const resp = await fetch(`${API_BASE}/api/price-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!resp.ok) throw new Error((await resp.json().catch(() => null))?.message ?? 'Não foi possível atualizar.');
      toast.success(item.isActive ? 'Serviço desativado.' : 'Serviço reativado.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o serviço.');
    }
  };

  const remove = (item: PriceItem) => {
    toast(`Remover "${item.name}" da tabela?`, {
      description: 'As cobranças já lançadas com esse serviço continuam como estão.',
      duration: 10000,
      action: {
        label: 'Remover',
        onClick: () => {
          void (async () => {
            try {
              const resp = await fetch(`${API_BASE}/api/price-items/${item.id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
              });
              if (!resp.ok) throw new Error((await resp.json().catch(() => null))?.message ?? 'Não foi possível remover.');
              toast.success('Serviço removido da tabela.');
              if (editingId === item.id) resetForm();
              await load();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Não foi possível remover o serviço.');
            }
          })();
        },
      },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  return (
    <ProfessionalShell
      active="prices"
      title="Tabela de preços"
      description="Cadastre os serviços com os valores praticados. Na hora de lançar uma cobrança, basta escolher o serviço."
      actions={
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] border border-border bg-background px-4 py-3 text-foreground transition-colors hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      }
    >
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[34px] border border-border/70 bg-card p-5 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Tags className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-medium text-foreground">
                {editingId ? 'Editar serviço' : 'Novo serviço'}
              </h2>
              <p className="text-sm text-muted-foreground">Nome, tipo e valor cobrado.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-foreground" htmlFor="price-name">
                Serviço
              </label>
              <input
                id="price-name"
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Consulta clínica geral"
                className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-foreground" htmlFor="price-category">
                  Tipo
                </label>
                <select
                  id="price-category"
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary"
                >
                  {categories.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-foreground" htmlFor="price-amount">
                  Valor (R$)
                </label>
                <input
                  id="price-amount"
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="180,00"
                  className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-foreground" htmlFor="price-notes">
                Observação (opcional)
              </label>
              <input
                id="price-notes"
                type="text"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Inclui retorno em 15 dias"
                className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar à tabela'}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] border border-border bg-background px-5 py-3 text-foreground transition-colors hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-[34px] border border-border/70 bg-card p-5 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-medium text-foreground">Serviços cadastrados</h2>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Mostrar desativados
            </label>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : visible.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-border p-6 text-center">
              <p className="text-foreground">Nenhum serviço cadastrado ainda.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Comece pelos mais frequentes: consulta, vacina e retorno.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(([categoryLabel, categoryItems]) => (
                <div key={categoryLabel}>
                  <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">{categoryLabel}</p>
                  <div className="space-y-2">
                    {categoryItems.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-[22px] border border-border p-3 sm:p-4 ${
                          item.isActive ? 'bg-background' : 'bg-muted/40'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-foreground">
                              {item.name}
                              {!item.isActive ? (
                                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  desativado
                                </span>
                              ) : null}
                            </p>
                            {item.notes ? <p className="text-sm text-muted-foreground">{item.notes}</p> : null}
                          </div>
                          <p className="shrink-0 text-lg text-foreground">{formatMoney(item.amountCents)}</p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(item)}
                            className="inline-flex min-h-11 items-center gap-2 rounded-[16px] border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(item)}
                            className="inline-flex min-h-11 items-center gap-2 rounded-[16px] border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                          >
                            {item.isActive ? 'Desativar' : 'Reativar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(item)}
                            className="inline-flex min-h-11 items-center gap-2 rounded-[16px] border border-border bg-background px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </ProfessionalShell>
  );
}
