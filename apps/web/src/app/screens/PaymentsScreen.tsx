import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  FileDown,
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ProfessionalShell } from '../components/layout/ProfessionalShell';
import { TutorShell } from '../components/layout/TutorShell';
import { useSession } from '../context/SessionContext';
import { getApiBase, getAuthHeaders } from '../context/shared';
import {
  buildPaymentReceiptPdf,
  buildPaymentsStatementPdf,
  type PaymentPdfItem,
} from '../utils/paymentPdf';
import { usePdfDelivery } from '../components/pdf/usePdfDelivery';

// Tela de pagamentos. Clínica e veterinário lançam e controlam as cobranças;
// o responsável vê a mesma lista em modo leitura, para conferir o que deve e o que pagou.

type PaymentStatus = 'pending' | 'paid' | 'cancelled';

type Payment = {
  id: string;
  petId: string | null;
  petName: string | null;
  tutorName: string | null;
  tutorEmail: string | null;
  professionalName: string | null;
  description: string;
  amountCents: number;
  amountLabel: string;
  status: PaymentStatus;
  category: string;
  categoryLabel: string;
  method: string | null;
  methodLabel: string | null;
  serviceDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
};

/** Serviço da tabela de preços, para preencher a cobrança em um clique. */
type PriceItem = {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  amountCents: number;
};

/** Somas que o servidor devolve junto da lista: por tipo e por forma de pagamento. */
type Summary = {
  byCategory: Array<{
    category: string;
    label: string;
    count: number;
    totalCents: number;
    paidCents: number;
    pendingCents: number;
  }>;
  byMethod: Array<{ method: string; label: string; count: number; totalCents: number }>;
};

/** Responsável atendido pelo profissional, com os pets dele. */
type Client = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  pets: Array<{ id: string; name: string; species: string | null }>;
};

const METHODS = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'credito', label: 'Cartão de crédito' },
  { value: 'debito', label: 'Cartão de débito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'outro', label: 'Outro' },
];

/** Mesmos tipos aceitos pelo servidor (price-items/payments). */
const CATEGORIES = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'vacina', label: 'Vacina' },
  { value: 'exame', label: 'Exame' },
  { value: 'cirurgia', label: 'Cirurgia' },
  { value: 'internacao', label: 'Internação' },
  { value: 'banho_tosa', label: 'Banho e tosa' },
  { value: 'medicamento', label: 'Medicamento' },
  { value: 'retorno', label: 'Retorno' },
  { value: 'outro', label: 'Outro' },
];

const STATUS_STYLE: Record<PaymentStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  paid: 'bg-primary/10 text-primary',
  cancelled: 'bg-muted text-muted-foreground',
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: 'Em aberto',
  paid: 'Pago',
  cancelled: 'Cancelada',
};

const inputClass =
  'min-h-12 w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-base text-foreground outline-none transition-colors focus:border-primary';

function formatMoneyFromCents(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDay(value: string | null) {
  if (!value) return null;
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('pt-BR');
}

export default function PaymentsScreen() {
  const { user } = useSession();
  const API_BASE = getApiBase();

  const isTutor = user?.userType === 'owner';
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | PaymentStatus>('all');
  // Competência no formato YYYY-MM; vazio = todos os meses.
  const [month, setMonth] = useState('');
  // Dia no formato YYYY-MM-DD. Quando preenchido, manda no mês: é o fechamento de caixa.
  const [day, setDay] = useState('');
  const [summary, setSummary] = useState<Summary>({ byCategory: [], byMethod: [] });
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tutorId, setTutorId] = useState('');
  const [exporting, setExporting] = useState(false);
  const { present: presentPdf, dialog: pdfDialog } = usePdfDelivery();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [petId, setPetId] = useState('');
  const [method, setMethod] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [markPaid, setMarkPaid] = useState(false);
  const [category, setCategory] = useState('consulta');
  const [priceItemId, setPriceItemId] = useState('');
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // O dia manda no mês: quem escolheu um dia está fechando o caixa daquele dia.
      const query = day ? `?day=${day}` : month ? `?month=${month}` : '';
      const resp = await fetch(`${API_BASE}/api/payments${query}`, { headers: getAuthHeaders() });
      const payload = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(payload?.message ?? 'Não foi possível carregar os pagamentos.');
      setPayments((payload?.data ?? []) as Payment[]);
      setSummary({ byCategory: payload?.byCategory ?? [], byMethod: payload?.byMethod ?? [] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar os pagamentos.');
    } finally {
      setLoading(false);
    }
  }, [API_BASE, month, day]);

  useEffect(() => {
    void load();
  }, [load]);

  // A lista de responsáveis (com os pets de cada um) só interessa a quem lança cobrança.
  useEffect(() => {
    if (isTutor) return;
    let cancelled = false;

    void (async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/payments/clients`, { headers: getAuthHeaders() });
        if (!resp.ok) return;
        const payload = await resp.json();
        if (!cancelled) setClients((payload?.data ?? []) as Client[]);
      } catch {
        // Sem a lista, o formulário ainda funciona sem vincular pet.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [API_BASE, isTutor]);

  // Tabela de preços: preenche descrição, valor e tipo sem digitar.
  useEffect(() => {
    if (isTutor) return;
    let cancelled = false;

    void (async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/price-items`, { headers: getAuthHeaders() });
        if (!resp.ok) return;
        const payload = await resp.json();
        if (!cancelled) setPriceItems((payload?.data ?? []) as PriceItem[]);
      } catch {
        // Sem a tabela, o formulário segue aceitando descrição e valor digitados.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [API_BASE, isTutor]);

  const visible = useMemo(
    () => (filter === 'all' ? payments : payments.filter((item) => item.status === filter)),
    [payments, filter]
  );

  const selectedClient = useMemo(() => clients.find((client) => client.id === tutorId) ?? null, [clients, tutorId]);

  /** Últimos 12 meses + o mês atual, para o seletor de competência. */
  const monthOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const now = new Date();
    for (let index = 0; index < 13; index += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      options.push({
        value,
        label: date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      });
    }
    return options;
  }, []);

  const periodLabel = day
    ? `Dia ${new Date(`${day}T00:00:00`).toLocaleDateString('pt-BR')}`
    : month
      ? monthOptions.find((option) => option.value === month)?.label ?? month
      : 'Todo o período';

  const toPdfItems = (items: Payment[]): PaymentPdfItem[] =>
    items.map((item) => ({
      id: item.id,
      description: item.description,
      amountCents: item.amountCents,
      amountLabel: item.amountLabel,
      status: item.status,
      categoryLabel: item.categoryLabel,
      method: item.method,
      methodLabel: item.methodLabel,
      petName: item.petName,
      tutorName: item.tutorName,
      professionalName: item.professionalName,
      serviceDate: item.serviceDate,
      dueDate: item.dueDate,
      paidAt: item.paidAt,
      notes: item.notes,
      createdAt: item.createdAt,
    }));

  const handleReceiptPdf = async (payment: Payment) => {
    try {
      const result = await buildPaymentReceiptPdf(toPdfItems([payment])[0]);
      presentPdf(result, `PetHelp — ${payment.description}`, `${payment.status === 'paid' ? 'Recibo' : 'Cobrança'} · ${payment.amountLabel}`);
    } catch (error) {
      console.error('Falha ao gerar o PDF do pagamento:', error);
      toast.error('Não foi possível gerar o PDF.');
    }
  };

  const handleStatementPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Com filtro de situação ativo, o resumo tem que bater com o que está na tela.
      const groupsFromVisible = filter !== 'all';
      const byCategory = groupsFromVisible
        ? Array.from(
            visible.reduce((map, item) => {
              const current = map.get(item.categoryLabel) ?? { label: item.categoryLabel, count: 0, totalCents: 0 };
              current.count += 1;
              current.totalCents += item.amountCents;
              map.set(item.categoryLabel, current);
              return map;
            }, new Map<string, { label: string; count: number; totalCents: number }>())
          ).map(([, value]) => value)
        : summary.byCategory.map((entry) => ({
            label: entry.label,
            count: entry.count,
            totalCents: entry.totalCents,
          }));

      const byMethod = groupsFromVisible
        ? []
        : summary.byMethod.map((entry) => ({ label: entry.label, count: entry.count, totalCents: entry.totalCents }));

      const result = await buildPaymentsStatementPdf({
        payments: toPdfItems(visible),
        periodLabel,
        ownerLabel: (isTutor ? user?.name : user?.clinicName || user?.name) ?? 'PetHelp',
        forTutor: isTutor,
        byCategory,
        byMethod,
        title: day && !isTutor ? 'Fechamento do dia' : 'Extrato de pagamentos',
      });
      presentPdf(
        result,
        `PetHelp — ${day && !isTutor ? 'fechamento' : 'extrato'} ${periodLabel}`,
        `${day && !isTutor ? 'Fechamento' : 'Extrato'} · ${periodLabel}`
      );
    } catch (error) {
      console.error('Falha ao gerar o extrato:', error);
      toast.error('Não foi possível gerar o extrato.');
    } finally {
      setExporting(false);
    }
  };

  const totals = useMemo(
    () => ({
      pending: payments.filter((p) => p.status === 'pending').reduce((sum, p) => sum + p.amountCents, 0),
      paid: payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amountCents, 0),
    }),
    [payments]
  );

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setPetId('');
    setTutorId('');
    setMethod('');
    setDueDate('');
    setNotes('');
    setMarkPaid(false);
    setPriceItemId('');
    setCategory('consulta');
    setServiceDate(new Date().toISOString().slice(0, 10));
    setShowForm(false);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const resp = await fetch(`${API_BASE}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          description: description.trim(),
          amount: amount.trim(),
          petId: petId || null,
          priceItemId: priceItemId || null,
          category,
          serviceDate: serviceDate || null,
          method: method || null,
          dueDate: dueDate || null,
          notes: notes.trim() || null,
          status: markPaid ? 'paid' : 'pending',
        }),
      });

      const payload = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(payload?.message ?? 'Não foi possível registrar a cobrança.');

      setPayments((prev) => [payload.data as Payment, ...prev]);
      toast.success(markPaid ? 'Pagamento registrado e confirmado por e-mail.' : 'Cobrança registrada e enviada por e-mail.');
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a cobrança.');
    } finally {
      setSaving(false);
    }
  };

  const patchPayment = async (id: string, body: Record<string, unknown>, successMessage: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/payments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      const payload = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(payload?.message ?? 'Não foi possível atualizar.');
      setPayments((prev) => prev.map((item) => (item.id === id ? (payload.data as Payment) : item)));
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar.');
    }
  };

  const handleDelete = (payment: Payment) => {
    toast(`Excluir a cobrança de ${payment.amountLabel}?`, {
      description: payment.description,
      action: {
        label: 'Excluir',
        onClick: () => {
          void (async () => {
            try {
              const resp = await fetch(`${API_BASE}/api/payments/${payment.id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
              });
              if (!resp.ok && resp.status !== 204) throw new Error('Falha ao excluir');
              setPayments((prev) => prev.filter((item) => item.id !== payment.id));
              toast.success('Cobrança excluída.');
            } catch {
              toast.error('Não foi possível excluir a cobrança.');
            }
          })();
        },
      },
      cancel: { label: 'Manter', onClick: () => {} },
    });
  };

  const content = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[20px] border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Em aberto</p>
          <p className="mt-1 text-2xl font-medium text-foreground">{formatMoneyFromCents(totals.pending)}</p>
        </div>
        <div className="rounded-[20px] border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {isTutor ? 'Já pago' : 'Recebido'}
          </p>
          <p className="mt-1 text-2xl font-medium text-primary">{formatMoneyFromCents(totals.paid)}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="paymentsMonth" className="mb-2 block text-sm text-foreground">
            Mês
          </label>
          <select
            id="paymentsMonth"
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              // Mês escolhido na mão substitui o recorte de um dia só.
              setDay('');
            }}
            disabled={Boolean(day)}
            className={`${inputClass} first-letter:uppercase disabled:opacity-60`}
          >
            <option value="">Todo o período</option>
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="paymentsDay" className="mb-2 block text-sm text-foreground">
            Dia
          </label>
          <input
            id="paymentsDay"
            type="date"
            value={day}
            onChange={(event) => setDay(event.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!isTutor ? (
          <button
            type="button"
            onClick={() => {
              setDay(new Date().toISOString().slice(0, 10));
              setFilter('all');
            }}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] border border-border bg-card px-5 py-3 text-foreground transition-colors hover:bg-muted"
          >
            <CalendarCheck className="h-5 w-5" />
            Fechamento de hoje
          </button>
        ) : null}

        {day ? (
          <button
            type="button"
            onClick={() => setDay('')}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] border border-border bg-card px-5 py-3 text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" />
            Limpar o dia
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => void handleStatementPdf()}
          disabled={exporting}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] border border-border bg-card px-5 py-3 text-foreground transition-colors hover:bg-muted disabled:opacity-60 sm:ml-auto"
        >
          <FileText className="h-5 w-5" />
          {exporting ? 'Gerando...' : day && !isTutor ? 'Fechamento em PDF' : 'Extrato em PDF'}
        </button>
      </div>

      {summary.byCategory.length > 0 ? (
        <section className="rounded-[24px] border border-border/70 bg-card p-4 sm:p-5">
          <h2 className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
            {periodLabel} · por tipo de serviço
          </h2>
          <div className="mt-3 space-y-2">
            {summary.byCategory.map((entry) => (
              <div key={entry.category} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                <span className="min-w-0 truncate text-foreground">
                  {entry.label}
                  <span className="ml-2 text-sm text-muted-foreground">{entry.count}x</span>
                </span>
                <span className="shrink-0 text-foreground">{formatMoneyFromCents(entry.totalCents)}</span>
              </div>
            ))}
          </div>

          {summary.byMethod.length > 0 ? (
            <div className="mt-4 border-t border-border pt-3">
              <h3 className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
                {isTutor ? 'Pago por forma' : 'Recebido por forma'}
              </h3>
              <div className="mt-2 space-y-2">
                {summary.byMethod.map((entry) => (
                  <div key={entry.method} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {entry.label}
                      <span className="ml-2 text-sm">{entry.count}x</span>
                    </span>
                    <span className="shrink-0 text-foreground">{formatMoneyFromCents(entry.totalCents)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {(['all', 'pending', 'paid', 'cancelled'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 py-2 text-sm transition-colors ${
              filter === value ? 'border-primary bg-primary text-white' : 'border-border bg-card text-foreground hover:bg-muted'
            }`}
          >
            {value === 'all' ? 'Todas' : STATUS_LABEL[value]}
          </button>
        ))}
      </div>

      {showForm && !isTutor ? (
        <form onSubmit={handleCreate} className="rounded-[28px] border border-border/70 bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-medium text-foreground">Nova cobrança</h2>
            <button
              type="button"
              onClick={resetForm}
              aria-label="Fechar"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 grid gap-4">
            {priceItems.length > 0 ? (
              <div>
                <label htmlFor="paymentPriceItem" className="mb-2 block text-foreground">
                  Serviço da tabela de preços
                </label>
                <select
                  id="paymentPriceItem"
                  value={priceItemId}
                  onChange={(event) => {
                    const selected = priceItems.find((item) => item.id === event.target.value);
                    setPriceItemId(event.target.value);
                    // Escolher o serviço já preenche descrição, valor e tipo.
                    if (selected) {
                      setDescription(selected.name);
                      setAmount((selected.amountCents / 100).toFixed(2).replace('.', ','));
                      setCategory(selected.category);
                    }
                  }}
                  className={inputClass}
                >
                  <option value="">Digitar manualmente</option>
                  {priceItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {formatMoneyFromCents(item.amountCents)}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-muted-foreground">
                  Você pode ajustar o valor depois de escolher, se este atendimento foi diferente.
                </p>
              </div>
            ) : null}

            <div>
              <label htmlFor="paymentDescription" className="mb-2 block text-foreground">
                O que foi realizado <span className="text-destructive">*</span>
              </label>
              <input
                id="paymentDescription"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={inputClass}
                placeholder="Ex: Consulta + vacina V10"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="paymentAmount" className="mb-2 block text-foreground">
                  Valor (R$) <span className="text-destructive">*</span>
                </label>
                <input
                  id="paymentAmount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className={inputClass}
                  placeholder="180,00"
                  required
                />
              </div>
              <div>
                <label htmlFor="paymentTutor" className="mb-2 block text-foreground">
                  Responsável
                </label>
                <select
                  id="paymentTutor"
                  value={tutorId}
                  onChange={(event) => {
                    setTutorId(event.target.value);
                    // Trocou de pessoa: o pet escolhido antes não vale mais.
                    setPetId('');
                  }}
                  className={inputClass}
                >
                  <option value="">Selecione o responsável</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} ({client.email})
                    </option>
                  ))}
                </select>
                {clients.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhum responsável atendido ainda. Você pode lançar a cobrança sem vincular.
                  </p>
                ) : null}
              </div>
            </div>

            <div>
              <label htmlFor="paymentPet" className="mb-2 block text-foreground">
                Pet
              </label>
              <select
                id="paymentPet"
                value={petId}
                onChange={(event) => setPetId(event.target.value)}
                className={inputClass}
                disabled={!selectedClient}
              >
                <option value="">
                  {selectedClient ? 'Selecione o pet' : 'Escolha o responsável primeiro'}
                </option>
                {(selectedClient?.pets ?? []).map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.name}
                    {pet.species ? ` · ${pet.species}` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedClient && selectedClient.pets.length > 1
                  ? `${selectedClient.name} tem ${selectedClient.pets.length} pets — escolha de qual é o atendimento.`
                  : 'Vincular o pet permite avisar o responsável por e-mail.'}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="paymentMethod" className="mb-2 block text-foreground">
                  Forma de pagamento
                </label>
                <select
                  id="paymentMethod"
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Não informada</option>
                  {METHODS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="paymentDueDate" className="mb-2 block text-foreground">
                  Vencimento
                </label>
                <input
                  id="paymentDueDate"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="paymentCategory" className="mb-2 block text-foreground">
                  Tipo de serviço
                </label>
                <select
                  id="paymentCategory"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className={inputClass}
                >
                  {CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-muted-foreground">
                  É por aqui que sai a soma do dia por consulta, vacina, exame...
                </p>
              </div>

              <div>
                <label htmlFor="paymentServiceDate" className="mb-2 block text-foreground">
                  Data do atendimento
                </label>
                <input
                  id="paymentServiceDate"
                  type="date"
                  value={serviceDate}
                  onChange={(event) => setServiceDate(event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="paymentNotes" className="mb-2 block text-foreground">
                Observações
              </label>
              <textarea
                id="paymentNotes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-base text-foreground outline-none transition-colors focus:border-primary"
                placeholder="Ex: parcelado em 2x"
              />
            </div>

            <label className="flex items-start gap-3 rounded-[18px] border border-border bg-muted/25 p-4 text-sm">
              <input
                type="checkbox"
                checked={markPaid}
                onChange={(event) => setMarkPaid(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
              />
              <span className="text-muted-foreground">
                Já foi pago — registra como recebido e manda a confirmação ao responsável.
              </span>
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-[18px] border border-border bg-background px-5 py-3 text-muted-foreground transition-colors hover:bg-muted sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
              >
                <CircleDollarSign className="h-5 w-5" />
                {saving ? 'Salvando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="rounded-[28px] border border-border/70 bg-card p-6 text-center text-muted-foreground">
          Carregando pagamentos...
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-border bg-card p-6 text-center text-muted-foreground sm:p-8">
          {payments.length === 0
            ? isTutor
              ? 'Nenhuma cobrança registrada para você até agora.'
              : 'Nenhuma cobrança registrada ainda.'
            : 'Nenhuma cobrança nesse filtro.'}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((payment) => (
            <article key={payment.id} className="rounded-[24px] border border-border/70 bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-medium text-foreground">{payment.description}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[
                      payment.categoryLabel,
                      payment.petName,
                      isTutor ? payment.professionalName : payment.tutorName,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Sem pet vinculado'}
                  </p>
                  {payment.serviceDate ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Atendimento em {formatDay(payment.serviceDate)}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-lg font-medium text-foreground">{payment.amountLabel}</p>
                  <span className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs ${STATUS_STYLE[payment.status]}`}>
                    {STATUS_LABEL[payment.status]}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {payment.methodLabel ? <span>{payment.methodLabel}</span> : null}
                {payment.dueDate ? <span>Vence em {formatDay(payment.dueDate)}</span> : null}
                {payment.paidAt ? <span>Pago em {formatDay(payment.paidAt)}</span> : null}
              </div>

              {payment.notes ? <p className="mt-2 text-sm text-muted-foreground">{payment.notes}</p> : null}

              <div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-3">
                <button
                  type="button"
                  onClick={() => void handleReceiptPdf(payment)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <FileDown className="h-4 w-4" />
                  {payment.status === 'paid' ? 'Recibo em PDF' : 'Cobrança em PDF'}
                </button>
              </div>

              {!isTutor ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-3">
                  {payment.status !== 'paid' ? (
                    <button
                      type="button"
                      onClick={() => void patchPayment(payment.id, { status: 'paid' }, 'Pagamento confirmado e avisado.')}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-primary transition-colors hover:bg-muted"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Marcar como pago
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void patchPayment(payment.id, { status: 'pending' }, 'Cobrança voltou para em aberto.')}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <Undo2 className="h-4 w-4" />
                      Reabrir
                    </button>
                  )}

                  {payment.status !== 'cancelled' ? (
                    <button
                      type="button"
                      onClick={() => void patchPayment(payment.id, { status: 'cancelled' }, 'Cobrança cancelada.')}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <X className="h-4 w-4" />
                      Cancelar cobrança
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => handleDelete(payment)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {pdfDialog}
    </div>
  );

  const actions = (
    <>
      {!isTutor ? (
        <button
          type="button"
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 sm:w-auto"
        >
          {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          {showForm ? 'Fechar' : 'Nova cobrança'}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => void load()}
        disabled={loading}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-border bg-card px-5 py-3 text-foreground transition-colors hover:bg-muted disabled:opacity-60 sm:w-auto"
      >
        <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        Atualizar
      </button>
    </>
  );

  if (isTutor) {
    return (
      <TutorShell
        active="payments"
        title="Pagamentos"
        description="O que as clínicas e veterinários registraram de atendimento, com valores e situação."
        actions={actions}
      >
        {content}
      </TutorShell>
    );
  }

  return (
    <ProfessionalShell
      active="payments"
      title="Pagamentos"
      description="Registre o que foi realizado, o valor e a forma de pagamento. O responsável recebe aviso por e-mail."
      actions={actions}
    >
      {content}
    </ProfessionalShell>
  );
}
