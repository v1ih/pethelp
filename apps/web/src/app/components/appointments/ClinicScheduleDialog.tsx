import React, { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { getApiBase, getAuthHeaders } from '../../context/shared';
import { useInteraction } from '../../context/InteractionContext';
import { useSession } from '../../context/SessionContext';

// A clínica marca a consulta pelo responsável — é o que acontece no balcão e no
// telefone. O veterinário é opcional: com plantão e rotação, nem sempre se sabe na
// hora quem vai atender.

type Client = {
  id: string;
  name: string;
  email: string;
  pets: Array<{ id: string; name: string; species: string | null }>;
};

type VetOption = { veterinarianId: string; veterinarianName: string };

const inputClass =
  'min-h-12 w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-base text-foreground outline-none transition-colors focus:border-primary';

export function ClinicScheduleDialog({
  vets,
  defaultDate,
  onClose,
}: {
  vets: VetOption[];
  defaultDate?: string;
  onClose: () => void;
}) {
  const API_BASE = getApiBase();
  const { user } = useSession();
  const { addAppointment } = useInteraction();

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [tutorId, setTutorId] = useState('');
  const [petId, setPetId] = useState('');
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('09:00');
  const [veterinarianId, setVeterinarianId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/payments/clients`, { headers: getAuthHeaders() });
        if (!resp.ok) throw new Error('falha');
        const payload = await resp.json();
        if (!cancelled) setClients((payload?.data ?? []) as Client[]);
      } catch {
        if (!cancelled) toast.error('Não foi possível carregar a lista de responsáveis.');
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [API_BASE]);

  const selectedClient = useMemo(() => clients.find((client) => client.id === tutorId) ?? null, [clients, tutorId]);
  const selectedPet = selectedClient?.pets.find((pet) => pet.id === petId) ?? null;
  const selectedVet = vets.find((vet) => vet.veterinarianId === veterinarianId) ?? null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!petId) {
      toast.error('Escolha o responsável e o pet.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Informe o motivo da consulta.');
      return;
    }

    setSaving(true);
    try {
      await addAppointment({
        petId,
        petName: selectedPet?.name ?? '',
        // O servidor aceita o id do perfil da clínica ou o id do usuário dela.
        clinicId: user?.id ?? null,
        clinicName: user?.clinicName ?? user?.name ?? null,
        veterinarianId: veterinarianId || null,
        veterinarianName: selectedVet?.veterinarianName ?? null,
        veterinarianEmail: null,
        veterinarianPhone: null,
        targetType: 'clinic',
        date,
        time,
        reason: reason.trim(),
        status: 'scheduled',
        ownerId: user?.id ?? '',
      } as never);

      toast.success(
        `Consulta marcada para ${new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')} às ${time}.`
      );
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível agendar a consulta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Agendar consulta"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col rounded-t-[28px] border border-border bg-card shadow-2xl sm:max-w-[520px] sm:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CalendarPlus className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-medium text-foreground">Agendar consulta</h2>
              <p className="text-sm text-muted-foreground">O responsável recebe o aviso da consulta marcada.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <label htmlFor="scheduleTutor" className="mb-2 block text-foreground">
              Responsável <span className="text-destructive">*</span>
            </label>
            <select
              id="scheduleTutor"
              value={tutorId}
              onChange={(event) => {
                setTutorId(event.target.value);
                setPetId('');
              }}
              className={inputClass}
              required
            >
              <option value="">{loadingClients ? 'Carregando...' : 'Selecione o responsável'}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.email})
                </option>
              ))}
            </select>
            {!loadingClients && clients.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhum responsável atendido ainda. Cadastre o pet ou peça para o responsável vincular pelo código.
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="schedulePet" className="mb-2 block text-foreground">
              Pet <span className="text-destructive">*</span>
            </label>
            <select
              id="schedulePet"
              value={petId}
              onChange={(event) => setPetId(event.target.value)}
              className={inputClass}
              disabled={!selectedClient}
              required
            >
              <option value="">{selectedClient ? 'Selecione o pet' : 'Escolha o responsável primeiro'}</option>
              {(selectedClient?.pets ?? []).map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                  {pet.species ? ` · ${pet.species}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="scheduleDate" className="mb-2 block text-foreground">
                Data <span className="text-destructive">*</span>
              </label>
              <input
                id="scheduleDate"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="scheduleTime" className="mb-2 block text-foreground">
                Horário <span className="text-destructive">*</span>
              </label>
              <input
                id="scheduleTime"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="scheduleVet" className="mb-2 block text-foreground">
              Veterinário (opcional)
            </label>
            <select
              id="scheduleVet"
              value={veterinarianId}
              onChange={(event) => setVeterinarianId(event.target.value)}
              className={inputClass}
            >
              <option value="">A definir — plantão / rotação</option>
              {vets.map((vet) => (
                <option key={vet.veterinarianId} value={vet.veterinarianId}>
                  {vet.veterinarianName}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-muted-foreground">
              Sem veterinário definido, a clínica pode marcar mais de um atendimento no mesmo horário.
            </p>
          </div>

          <div>
            <label htmlFor="scheduleReason" className="mb-2 block text-foreground">
              Motivo <span className="text-destructive">*</span>
            </label>
            <textarea
              id="scheduleReason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-base text-foreground outline-none transition-colors focus:border-primary"
              placeholder="Ex: retorno da cirurgia"
              required
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-12 items-center justify-center rounded-[18px] border border-border bg-background px-5 py-3 text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              <CalendarPlus className="h-5 w-5" />
              {saving ? 'Agendando...' : 'Agendar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ClinicScheduleDialog;
