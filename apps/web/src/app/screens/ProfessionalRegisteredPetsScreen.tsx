import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { History, Mail, PawPrint, Phone, RefreshCw, Search, ShieldCheck, ShieldOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { ProfessionalShell } from '../components/layout/ProfessionalShell';
import PetAuditTrail from '../components/audit/PetAuditTrail';
import { useSession } from '../context/SessionContext';
import { getApiBase, getAuthHeaders } from '../context/shared';
import { petAgeLabel } from '../utils/age';

type RegisteredPet = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  age: string | null;
  weight: string | null;
  sex: string | null;
  neutered: boolean | null;
  birthDate: string | null;
  photo: string | null;
  allergies: string[] | null;
  conditions: string[] | null;
  isActive: boolean;
  registeredAt: string | null;
  stillLinked: boolean;
  /** 'registered' = cadastrado aqui; 'linked' = o responsável vinculou pelo código. */
  origin?: 'registered' | 'linked';
  tutor: {
    id: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    emailVerified: boolean;
    /** False quando o responsável foi cadastrado sem e-mail e não tem acesso ao app. */
    hasAccount?: boolean;
  };
  vetPass: { code: string; expiresAt: string | null; active: boolean } | null;
};

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('pt-BR');
}

function DataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-border bg-background px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-sm text-foreground">{value}</p>
    </div>
  );
}

export default function ProfessionalRegisteredPetsScreen() {
  const navigate = useNavigate();
  const API_BASE = getApiBase();
  const { user } = useSession();
  const isVet = user?.userType === 'veterinarian';
  const registrationPath = isVet ? '/veterinarian-pet-registration' : '/clinic-pet-registration';
  const registeredPath = isVet ? '/veterinarian-pets' : '/clinic-pets';
  const dashboardPath = isVet ? '/veterinarian-dashboard' : '/clinic-dashboard';

  const [pets, setPets] = useState<RegisteredPet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Pet cujo histórico de alterações está aberto.
  const [auditPet, setAuditPet] = useState<{ id: string; name: string } | null>(null);
  // Responsável sem conta para quem a clínica vai criar o acesso.
  const [inviteTutor, setInviteTutor] = useState<{ id: string; name: string } | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/pet-registrations`, { headers: getAuthHeaders() });
      const payload = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(payload?.message ?? 'Não foi possível carregar os pets cadastrados.');
      }
      setPets((payload?.data ?? []) as RegisteredPet[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar os pets cadastrados.');
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Cria a conta do responsável que foi cadastrado sem e-mail e envia o código. */
  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteTutor || inviting) return;

    const email = inviteEmail.trim();
    if (!email) {
      toast.error('Informe o e-mail do responsável.');
      return;
    }

    setInviting(true);
    try {
      const resp = await fetch(`${API_BASE}/api/pet-registrations/tutors/${inviteTutor.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ email }),
      });
      const payload = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(payload?.message ?? 'Não foi possível criar o acesso.');

      toast.success(payload?.message ?? 'Acesso criado.');
      // Sem e-mail configurado no servidor, o código aparece para a clínica repassar.
      setInviteCode(payload?.data?.accessCode ?? null);
      if (!payload?.data?.accessCode) {
        setInviteTutor(null);
        setInviteEmail('');
      }
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar o acesso.');
    } finally {
      setInviting(false);
    }
  };

  // A busca é local: a lista já vem completa e assim o filtro responde na hora.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return pets;
    return pets.filter((pet) =>
      [pet.name, pet.species, pet.breed, pet.tutor.name, pet.tutor.email]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [pets, search]);

  return (
    <ProfessionalShell
      active="registered"
      title={isVet ? 'Pets que você cadastrou' : 'Pets da clínica'}
      description={
        isVet
          ? 'Todos os pets que você registrou, com os dados do responsável e a situação do compartilhamento.'
          : 'Pets cadastrados pela clínica e pets que os responsáveis vincularam pelo código, com os dados de contato e a situação do acesso.'
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => navigate(registrationPath)}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 sm:w-auto"
          >
            <PawPrint className="h-5 w-5" />
            Cadastrar pet
          </button>
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
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por pet, responsável ou e-mail"
            className="min-h-12 w-full rounded-[18px] border border-border bg-input-background py-3 pl-11 pr-4 text-base text-foreground outline-none transition-colors focus:border-primary"
          />
        </div>

        {loading ? (
          <div className="rounded-[28px] border border-border/70 bg-card p-6 text-center text-muted-foreground">
            Carregando pets cadastrados...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-border bg-card p-6 text-center sm:p-8">
            <p className="text-foreground">
              {pets.length === 0
                ? `${isVet ? 'Você' : 'A clínica'} ainda não cadastrou nenhum pet.`
                : 'Nenhum pet encontrado para essa busca.'}
            </p>
            {pets.length === 0 ? (
              <button
                type="button"
                onClick={() => navigate(registrationPath)}
                className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90"
              >
                <PawPrint className="h-5 w-5" />
                Fazer o primeiro cadastro
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {filtered.length} pet{filtered.length === 1 ? '' : 's'}
              {search.trim() ? ` de ${pets.length}` : ''}{' '}
              {isVet
                ? `cadastrado${filtered.length === 1 ? '' : 's'} por você.`
                : `na clínica: cadastrado${filtered.length === 1 ? '' : 's'} aqui ou vinculado${
                    filtered.length === 1 ? '' : 's'
                  } pelo responsável.`}
            </p>

            <div className="space-y-4">
              {filtered.map((pet) => {
                const registered = formatDate(pet.registeredAt);
                const passExpires = formatDate(pet.vetPass?.expiresAt ?? null);
                // De onde vem o acesso muda por perfil e por origem do pet:
                // - veterinário: sempre pelo Vet-Pass, que o responsável encerra;
                // - clínica que cadastrou o pet: pelo próprio cadastro, que não expira;
                // - clínica com pet vinculado por código: pelo vínculo, que o responsável desfaz.
                const linkedByTutor = pet.origin === 'linked';
                const registeredHere = !isVet && pet.origin !== 'linked';
                const sharing = isVet
                  ? Boolean(pet.vetPass?.active)
                  : linkedByTutor
                    ? pet.stillLinked
                    : true;

                return (
                  <article
                    key={pet.id}
                    className="rounded-[28px] border border-border/70 bg-card p-4 shadow-[0_18px_42px_-30px_rgba(127,162,106,0.2)] sm:p-6"
                  >
                    <header className="flex items-start gap-3">
                      {pet.photo ? (
                        <img
                          src={pet.photo}
                          alt={pet.name}
                          className="h-14 w-14 shrink-0 rounded-2xl border border-border object-cover"
                        />
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <PawPrint className="h-6 w-6" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-lg font-medium text-foreground">{pet.name}</h2>
                        <p className="text-sm text-muted-foreground">
                          {[pet.species, pet.breed].filter(Boolean).join(' · ') || 'Espécie não informada'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                              sharing ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {sharing ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                            {linkedByTutor
                              ? sharing
                                ? 'Vínculo ativo'
                                : 'Vínculo encerrado'
                              : registeredHere
                                ? 'Cadastrado pela clínica'
                                : sharing
                                  ? 'Vet-Pass ativo'
                                  : 'Compartilhamento encerrado'}
                          </span>
                          {linkedByTutor ? (
                            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                              Vinculado pelo responsável
                            </span>
                          ) : null}
                          {!pet.isActive ? (
                            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Pet inativo</span>
                          ) : null}
                          {registered ? (
                            <span className="text-xs text-muted-foreground">
                              {linkedByTutor ? 'No PetHelp desde' : 'Cadastrado em'} {registered}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </header>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <DataItem label="Idade" value={petAgeLabel(pet)} />
                      <DataItem label="Peso" value={pet.weight || 'Não informado'} />
                      <DataItem label="Sexo" value={pet.sex || 'Não informado'} />
                      <DataItem
                        label="Castrado(a)"
                        value={pet.neutered === null ? 'Não informado' : pet.neutered ? 'Sim' : 'Não'}
                      />
                      <DataItem label="Alergias" value={pet.allergies?.join(', ') || 'Nenhuma registrada'} />
                      <DataItem label="Condições" value={pet.conditions?.join(', ') || 'Nenhuma registrada'} />
                    </div>

                    <div className="mt-4 rounded-[20px] border border-border bg-muted/25 p-3 sm:p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Responsável</p>
                      <p className="mt-1 text-base text-foreground">{pet.tutor.name || 'Não informado'}</p>
                      <div className="mt-2 space-y-1.5">
                        {pet.tutor.email ? (
                          <a
                            href={`mailto:${pet.tutor.email}`}
                            className="flex min-h-11 items-center gap-2 text-sm text-foreground underline-offset-2 hover:underline"
                          >
                            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="break-all">{pet.tutor.email}</span>
                          </a>
                        ) : null}
                        {pet.tutor.phone ? (
                          <a
                            href={`tel:${pet.tutor.phone.replace(/\D/g, '')}`}
                            className="flex min-h-11 items-center gap-2 text-sm text-foreground underline-offset-2 hover:underline"
                          >
                            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                            {pet.tutor.phone}
                          </a>
                        ) : null}
                      </div>
                      {/* Responsável sem conta: cadastrado sem e-mail. A clínica pode
                          criar o acesso depois, quando a pessoa tiver um e-mail. */}
                      {pet.tutor.hasAccount === false ? (
                        <div className="mt-3 border-t border-border pt-3">
                          <p className="text-xs text-muted-foreground">
                            Sem e-mail: este responsável não acessa o app. O cadastro fica aqui no sistema.
                          </p>
                          {pet.tutor.id ? (
                            <button
                              type="button"
                              onClick={() => setInviteTutor({ id: pet.tutor.id as string, name: pet.tutor.name ?? 'responsável' })}
                              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-[16px] border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                            >
                              <Mail className="h-4 w-4" />
                              Enviar acesso por e-mail
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {pet.tutor.emailVerified
                            ? 'Responsável já confirmou o e-mail e acessa o app.'
                            : 'Responsável ainda não confirmou o e-mail.'}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setAuditPet({ id: pet.id, name: pet.name })}
                      className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-[16px] border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <History className="h-4 w-4" />
                      Histórico de alterações
                    </button>

                    {pet.vetPass ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Vet-Pass <strong className="font-mono text-foreground">{pet.vetPass.code}</strong>
                        {passExpires ? ` · ${sharing ? 'válido até' : 'expirou em'} ${passExpires}` : ''}
                      </p>
                    ) : linkedByTutor ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {sharing
                          ? 'O responsável vinculou este pet à clínica com o código de conexão, e pode encerrar o vínculo quando quiser.'
                          : 'O responsável encerrou o vínculo deste pet com a clínica.'}
                      </p>
                    ) : registeredHere ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Foi a clínica que cadastrou este pet, e por isso acompanha o prontuário, as vacinas e os
                        exames deste atendimento.
                      </p>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        O responsável encerrou o compartilhamento deste pet.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>

      {auditPet ? (
        <PetAuditTrail petId={auditPet.id} petName={auditPet.name} onClose={() => setAuditPet(null)} />
      ) : null}

      {inviteTutor ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Enviar acesso ao responsável"
          onClick={() => {
            setInviteTutor(null);
            setInviteEmail('');
            setInviteCode(null);
          }}
        >
          <div
            className="w-full rounded-t-[28px] border border-border bg-card p-5 shadow-2xl sm:max-w-[460px] sm:rounded-[28px] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-medium text-foreground">Enviar acesso</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cria a conta de {inviteTutor.name} no PetHelp e envia o código para definir a senha.
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => {
                  setInviteTutor(null);
                  setInviteEmail('');
                  setInviteCode(null);
                }}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {inviteCode ? (
              <div className="mt-4 rounded-[20px] border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-sm text-muted-foreground">Código de primeiro acesso</p>
                <p className="mt-2 font-mono text-2xl tracking-[0.3em] text-foreground">{inviteCode}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Passe este código ao responsável: ele usa em "Esqueci minha senha", na tela de login.
                </p>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="inviteEmail" className="mb-2 block text-foreground">
                    E-mail do responsável
                  </label>
                  <input
                    id="inviteEmail"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="ana@email.com"
                    className="min-h-12 w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-base text-foreground outline-none transition-colors focus:border-primary"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={inviting}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  <Mail className="h-5 w-5" />
                  {inviting ? 'Criando...' : 'Criar acesso e enviar'}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </ProfessionalShell>
  );
}
