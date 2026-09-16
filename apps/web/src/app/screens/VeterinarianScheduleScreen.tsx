import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, CalendarDays, Clock3, Edit3, Link2, Plus, ShieldAlert, Stethoscope, Trash2, X } from 'lucide-react';
import { useSession } from '../context/SessionContext';
import { getApiBase, getAuthHeaders } from '../context/shared';
import { useAppNavigation, useDashboardBackLogout } from '../navigation';
import VeterinarianShell from '../components/layout/VeterinarianShell';

type ScheduleStatus = 'available' | 'blocked';

type ScheduleItem = {
  id: string;
  day: string;
  start: string;
  end: string;
  title: string;
  status: ScheduleStatus;
};

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

type ClinicProfile = {
  id: string;
  name: string;
  connectionCode?: string | null;
  address?: string | null;
  workingHours?: Record<string, { open?: string; close?: string } | undefined> | null;
};

const dayOrder = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function getStorageKey(userId?: string) {
  return userId ? `veterinarian-schedule:${userId}` : null;
}

function readSchedule(key: string | null) {
  if (!key || typeof window === 'undefined') return [] as ScheduleItem[];

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [] as ScheduleItem[];
    const parsed = JSON.parse(raw) as ScheduleItem[];
    if (!Array.isArray(parsed)) return [] as ScheduleItem[];
    return parsed.filter((item) => typeof item?.id === 'string' && typeof item?.day === 'string');
  } catch {
    return [] as ScheduleItem[];
  }
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : -1;
}

function sortSchedule(left: ScheduleItem, right: ScheduleItem) {
  const dayDelta = dayOrder.indexOf(left.day) - dayOrder.indexOf(right.day);
  if (dayDelta !== 0) return dayDelta;
  return timeToMinutes(left.start) - timeToMinutes(right.start);
}

function intervalsOverlap(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) {
  const leftStartMinutes = timeToMinutes(leftStart);
  const leftEndMinutes = timeToMinutes(leftEnd);
  const rightStartMinutes = timeToMinutes(rightStart);
  const rightEndMinutes = timeToMinutes(rightEnd);
  return leftStartMinutes < rightEndMinutes && rightStartMinutes < leftEndMinutes;
}

function formatWorkingHours(hours?: Record<string, { open?: string; close?: string } | undefined> | null) {
  if (!hours) return 'Horário não informado';

  const entries = dayOrder
    .map((day) => {
      const slot = hours[day];
      if (!slot?.open || !slot?.close) return null;
      return `${day.slice(0, 3)} ${slot.open} - ${slot.close}`;
    })
    .filter((item): item is string => Boolean(item));

  return entries.length > 0 ? entries.join(' • ') : 'Horário não informado';
}

export default function VeterinarianScheduleScreen() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { goToDashboard, confirmAndLogout } = useAppNavigation();
  useDashboardBackLogout();

  const [viewMode, setViewMode] = useState<'autonomous' | 'clinic'>('autonomous');
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [day, setDay] = useState(dayOrder[0]);
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('09:00');
  const [title, setTitle] = useState('Consulta disponível');
  const [status, setStatus] = useState<ScheduleStatus>('available');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [clinicLinks, setClinicLinks] = useState<ClinicLink[]>([]);
  const [clinicProfiles, setClinicProfiles] = useState<ClinicProfile[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [loadingClinics, setLoadingClinics] = useState(false);

  const API_BASE = getApiBase();
  const storageKey = getStorageKey(user?.id);

  useEffect(() => {
    setItems(readSchedule(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, storageKey]);

  useEffect(() => {
    let cancelled = false;

    const loadLinks = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/clinic-links/me`, {
          headers: getAuthHeaders(),
        });

        if (!resp.ok) {
          if (!cancelled) setClinicLinks([]);
          return;
        }

        const { data } = await resp.json();
        if (!cancelled) {
          setClinicLinks((data ?? []) as ClinicLink[]);
        }
      } catch (error) {
        console.error('Falha ao carregar vínculos da clínica:', error);
        if (!cancelled) setClinicLinks([]);
      }
    };

    const loadClinics = async () => {
      setLoadingClinics(true);
      try {
        const resp = await fetch(`${API_BASE}/api/users/catalog?type=clinic`, {
          headers: getAuthHeaders(),
        });

        if (!resp.ok) {
          if (!cancelled) setClinicProfiles([]);
          return;
        }

        const { data } = await resp.json();
        if (!cancelled) {
          setClinicProfiles((data ?? []).map((entry: any) => ({
            id: String(entry.id),
            name: entry.name,
            connectionCode: entry.connectionCode ?? null,
            address: entry.address ?? null,
            workingHours: entry.workingHours ?? null,
          })));
        }
      } catch (error) {
        console.error('Falha ao carregar clínicas vinculadas:', error);
        if (!cancelled) setClinicProfiles([]);
      } finally {
        if (!cancelled) setLoadingClinics(false);
      }
    };

    void loadLinks();
    void loadClinics();

    return () => {
      cancelled = true;
    };
  }, [API_BASE]);

  const approvedLinks = useMemo(() => clinicLinks.filter((link) => link.status === 'approved'), [clinicLinks]);
  const pendingLinks = useMemo(() => clinicLinks.filter((link) => link.status === 'pending'), [clinicLinks]);
  const sortedItems = useMemo(() => items.slice().sort(sortSchedule), [items]);
  const availableCount = sortedItems.filter((item) => item.status === 'available').length;
  const blockedCount = sortedItems.filter((item) => item.status === 'blocked').length;

  useEffect(() => {
    if (approvedLinks.length === 0) {
      setSelectedClinicId('');
      return;
    }

    if (!selectedClinicId || !approvedLinks.some((link) => link.clinicId === selectedClinicId)) {
      setSelectedClinicId(approvedLinks[0].clinicId ?? '');
    }
  }, [approvedLinks, selectedClinicId]);

  const selectedClinicLink = approvedLinks.find((link) => link.clinicId === selectedClinicId) ?? null;
  const selectedClinicProfile = clinicProfiles.find((clinic) => clinic.id === selectedClinicId) ?? null;

  const resetForm = () => {
    setEditingId(null);
    setDay(dayOrder[0]);
    setStart('08:00');
    setEnd('09:00');
    setTitle('Consulta disponível');
    setStatus('available');
  };

  const startEdit = (item: ScheduleItem) => {
    setEditingId(item.id);
    setDay(item.day);
    setStart(item.start);
    setEnd(item.end);
    setTitle(item.title);
    setStatus(item.status);
    setViewMode('autonomous');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);

    if (startMinutes < 0 || endMinutes < 0 || startMinutes >= endMinutes) {
      setFeedback({ type: 'error', message: 'O horário final precisa ser maior que o horário inicial.' });
      return;
    }

    const duplicateConflict = items.some((item) => item.id !== editingId && item.day === day && intervalsOverlap(item.start, item.end, start, end));
    if (duplicateConflict) {
      setFeedback({ type: 'error', message: 'Já existe um horário conflitante nesse mesmo dia da semana.' });
      return;
    }

    const nextItem: ScheduleItem = {
      id: editingId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      day,
      start,
      end,
      title: title.trim() || (status === 'blocked' ? 'Horário bloqueado' : 'Consulta disponível'),
      status,
    };

    setItems((current) => {
      const withoutCurrent = current.filter((item) => item.id !== nextItem.id);
      return [nextItem, ...withoutCurrent];
    });
    setFeedback({
      type: 'success',
      message: editingId ? 'Horário atualizado com sucesso.' : 'Horário criado com sucesso.',
    });
    resetForm();
  };

  const handleDelete = (itemId: string) => {
    if (!window.confirm('Deseja excluir este horário?')) return;
    setItems((current) => current.filter((item) => item.id !== itemId));
    if (editingId === itemId) resetForm();
  };

  const handleRemoveClinicLink = async (linkId: string) => {
    try {
      const resp = await fetch(`${API_BASE}/api/clinic-links/${linkId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!(resp.ok || resp.status === 204)) {
        const payload = await resp.json().catch(() => null);
        throw new Error(payload?.message ?? 'Remove failed');
      }

      setClinicLinks((current) => current.filter((link) => link.id !== linkId));
    } catch (error) {
      console.error('Falha ao remover vínculo da clínica:', error);
    }
  };

  const toggleStatus = (item: ScheduleItem) => {
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? { ...entry, status: entry.status === 'available' ? 'blocked' : 'available', title: entry.status === 'available' ? 'Horário bloqueado' : 'Consulta disponível' }
          : entry
      )
    );
  };

  return (
            <VeterinarianShell active="agenda" title="Agenda" description="Gerencie horários autônomos e vínculos com clínicas." actions={<button type="button" className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90"><Plus className="h-4 w-4" />Novo horário</button>}>

        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setViewMode('autonomous')}
            className={`rounded-[24px] border px-4 py-4 text-left transition-colors ${viewMode === 'autonomous' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-foreground hover:bg-muted/40'}`}
          >
            <p className="text-sm font-medium">Agenda Autônoma</p>
            <p className="mt-1 text-xs opacity-80">Horários particulares e bloqueios pessoais.</p>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('clinic')}
            className={`rounded-[24px] border px-4 py-4 text-left transition-colors ${viewMode === 'clinic' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-foreground hover:bg-muted/40'}`}
          >
            <p className="text-sm font-medium">Agenda de Clínicas</p>
            <p className="mt-1 text-xs opacity-80">Vínculos aprovados e horários operacionais.</p>
          </button>
        </section>

        {viewMode === 'autonomous' ? (
          <section className="mt-6 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <form onSubmit={handleSubmit} className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-sm text-muted-foreground">Novo horário</p><h2 className="text-2xl text-foreground">Cadastrar ou editar</h2></div>
                <Clock3 className="h-6 w-6 text-primary" />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-foreground">Dia da semana</label>
                  <select value={day} onChange={(e) => setDay(e.target.value)} className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-foreground">
                    {dayOrder.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-foreground">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as ScheduleStatus)} className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-foreground">
                    <option value="available">Disponível</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-foreground">Início</label>
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-foreground" />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-foreground">Fim</label>
                  <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-foreground" />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm text-foreground">Título</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-foreground" placeholder="Ex.: Consulta, bloqueio, encaixe" />
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90"><Plus className="h-4 w-4" />{editingId ? 'Atualizar horário' : 'Salvar horário'}</button>
                <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-5 py-3 text-foreground transition-colors hover:bg-muted"><X className="h-4 w-4" />Limpar</button>
              </div>

              <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                Conflitos são recusados quando o mesmo dia já possui um intervalo que se sobrepõe ao novo horário.
              </div>
            </form>

            <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-sm text-muted-foreground">Horários cadastrados</p><h2 className="text-2xl text-foreground">Agenda atual</h2></div>
                <CalendarDays className="h-6 w-6 text-primary" />
              </div>

              <div className="mt-5 space-y-3">
                {sortedItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">Nenhum horário cadastrado ainda.</div>
                ) : (
                  sortedItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-foreground">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.day} • {item.start} às {item.end}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs ${item.status === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {item.status === 'available' ? 'Disponível' : 'Bloqueado'}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => startEdit(item)} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"><Edit3 className="h-4 w-4" />Editar</button>
                        <button type="button" onClick={() => toggleStatus(item)} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"><ShieldAlert className="h-4 w-4" />{item.status === 'available' ? 'Bloquear' : 'Desbloquear'}</button>
                        <button type="button" onClick={() => handleDelete(item.id)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 transition-colors hover:bg-red-100"><Trash2 className="h-4 w-4" />Excluir</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Clínicas aprovadas</p>
                  <h2 className="text-2xl text-foreground">Agenda de clínicas</h2>
                </div>
                <Link2 className="h-6 w-6 text-primary" />
              </div>

              <div className="mt-5 space-y-3">
                {approvedLinks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    Nenhuma clínica vinculada ainda. Use a aba de vínculos para solicitar vínculo.
                  </div>
                ) : (
                  approvedLinks.map((link) => {
                    const clinic = clinicProfiles.find((item) => item.id === link.clinicId);
                    const isSelected = selectedClinicId === link.clinicId;

                    return (
                      <button
                        key={link.id}
                        type="button"
                        onClick={() => setSelectedClinicId(link.clinicId ?? '')}
                        className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${isSelected ? 'border-primary/30 bg-primary/10' : 'border-border bg-background hover:bg-muted/50'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-foreground">{link.clinicName || clinic?.name || 'Clínica'}</p>
                            <p className="text-sm text-muted-foreground">{clinic?.address || 'Endereço não informado'}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{clinic?.connectionCode ? `Código ${clinic.connectionCode}` : 'Código indisponível'}</p>
                          </div>
                          {isSelected ? <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">Selecionada</span> : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate('/veterinarian-links')}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90"
              >
                <Link2 className="h-4 w-4" />
                Conectar com Clínica
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Horários da clínica</p>
                    <h2 className="text-2xl text-foreground">{selectedClinicLink ? selectedClinicLink.clinicName : 'Selecione uma clínica'}</h2>
                  </div>
                  <CalendarDays className="h-6 w-6 text-primary" />
                </div>

                {loadingClinics ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">Carregando informações da clínica...</div>
                ) : selectedClinicProfile ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-border bg-muted/20 p-4">
                      <p className="text-foreground">{selectedClinicProfile.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedClinicProfile.address || 'Endereço não informado'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{selectedClinicProfile.connectionCode ? `Código de conexão: ${selectedClinicProfile.connectionCode}` : 'Sem código exibido'}</p>
                    </div>

                    <div className="rounded-2xl border border-border bg-background p-4">
                      <p className="mb-2 text-sm text-foreground">Funcionamento informado pela clínica</p>
                      <p className="text-sm text-muted-foreground">{formatWorkingHours(selectedClinicProfile.workingHours)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    Selecione uma clínica aprovada para ver os dados de funcionamento.
                  </div>
                )}
              </div>

              <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Vínculos pendentes</p>
                    <h2 className="text-2xl text-foreground">Solicitações em aberto</h2>
                  </div>
                  <ShieldAlert className="h-6 w-6 text-primary" />
                </div>

                <div className="mt-5 space-y-3">
                  {pendingLinks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">Nenhuma solicitação pendente no momento.</div>
                  ) : (
                    pendingLinks.map((link) => (
                      <div key={link.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-foreground">{link.clinicName || 'Clínica'}</p>
                            <p className="text-xs text-muted-foreground">Solicitada por {link.requestedBy === 'clinic' ? 'clínica' : 'veterinário'}</p>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => void handleRemoveClinicLink(link.id)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 transition-colors hover:bg-red-100"><Trash2 className="h-4 w-4" />Remover</button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mt-6 rounded-[28px] border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg text-foreground">Atalho rápido</h3>
              <p className="mt-1 text-sm text-muted-foreground">Use a aba de vínculos para conectar novas clínicas e voltar aqui para consultar os horários vinculados.</p>
            </div>
          </div>
        </section>
    </VeterinarianShell>
  );
}





