import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeftRight, Mail, ShieldAlert, Sparkles, User, Check } from 'lucide-react';
import { getDashboardRouteForUserType } from '../context/shared';
import { usePets } from '../context/PetsContext';
import { useSession } from '../context/SessionContext';
import { TutorShell } from '../components/layout/TutorShell';

export default function PetTransferScreen() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { currentPet, pets, transferPetOwnership } = usePets();
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [targetTutorEmail, setTargetTutorEmail] = useState('');
  const [securityConfirmation, setSecurityConfirmation] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setTargetTutorEmail('');
    setSecurityConfirmation('');
    setFeedback(null);
  }, [currentPet?.id]);

  useEffect(() => {
    setSelectedPetIds((current) => {
      const filtered = current.filter((petId) => pets.some((pet) => pet.id === petId));
      if (filtered.length > 0) return filtered;
      if (currentPet && pets.some((pet) => pet.id === currentPet.id)) return [currentPet.id];
      if (pets.length > 0) return [pets[0].id];
      return [];
    });
  }, [currentPet, pets]);

  const selectedPets = useMemo(() => pets.filter((pet) => selectedPetIds.includes(pet.id)), [pets, selectedPetIds]);

  if (pets.length === 0) {
    return (
      <TutorShell active="transfer" title="Transferir pet" description="Escolha um ou mais pets para transferir. Nenhum pet disponível no momento.">
        <div className="mx-auto max-w-2xl rounded-[34px] border border-border/70 bg-card p-10 text-center shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
          <p className="text-foreground mb-4">Nenhum pet disponível para transferência</p>
          <button onClick={() => navigate('/owner-dashboard')} className="rounded-[18px] bg-primary px-6 py-3 text-white transition-colors hover:bg-primary/90">Voltar</button>
        </div>
      </TutorShell>
    );
  }

  const toggleSelection = (petId: string) => {
    setSelectedPetIds((current) => {
      if (current.includes(petId)) {
        return current.filter((id) => id !== petId);
      }

      return [...current, petId];
    });
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (selectedPets.length === 0) {
      setFeedback({ type: 'error', message: 'Selecione pelo menos um pet para transferir.' });
      return;
    }

    if (securityConfirmation.trim().toUpperCase() !== 'TRANSFERIR') {
      setFeedback({ type: 'error', message: 'Digite TRANSFERIR para confirmar a operação.' });
      return;
    }

    const email = targetTutorEmail.trim();
    if (!email) {
      setFeedback({ type: 'error', message: 'Informe o e-mail do novo tutor.' });
      return;
    }

    setTransferring(true);

    const transferredNames: string[] = [];

    try {
      for (const pet of selectedPets) {
        await transferPetOwnership(pet.id, {
          targetTutorEmail: email,
          securityConfirmation,
          petNameConfirmation: pet.name,
        });
        transferredNames.push(pet.name);
      }

      setFeedback({
        type: 'success',
        message: transferredNames.length === 1
          ? `Pet transferido com sucesso: ${transferredNames[0]}.`
          : `Pets transferidos com sucesso: ${transferredNames.join(', ')}.`,
      });
      setSelectedPetIds([]);
      setTargetTutorEmail('');
      setSecurityConfirmation('');
    } catch (error) {
      console.error('Falha ao transferir pet(s):', error);
      setFeedback({ type: 'error', message: 'Não foi possível transferir a titularidade de um ou mais pets.' });
    } finally {
      setTransferring(false);
    }
  };

  return (
    <TutorShell active="transfer" title="Transferir pet" description="Escolha um ou mais pets da sua lista para transferir para outro tutor.">
      <div className="space-y-6">
        <section className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ArrowLeftRight className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-medium text-foreground">Transferir titularidade</h1>
              <p className="text-muted-foreground">Selecione um ou mais pets e confirme a operação.</p>
            </div>
          </div>

          {feedback && (
            <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${feedback.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {feedback.message}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-foreground">Pets disponíveis</p>
                  <p className="text-sm text-muted-foreground">Clique para selecionar mais de um pet.</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSelectedPetIds(pets.map((pet) => pet.id))} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted">
                    Selecionar todos
                  </button>
                  <button type="button" onClick={() => setSelectedPetIds([])} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted">
                    Limpar
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {pets.map((pet) => {
                  const isSelected = selectedPetIds.includes(pet.id);
                  return (
                    <button
                      key={pet.id}
                      type="button"
                      onClick={() => toggleSelection(pet.id)}
                      className={`flex items-center gap-3 rounded-[28px] border p-4 text-left transition-all ${
                        isSelected
                          ? 'border-primary/30 bg-primary/10 shadow-[0_16px_34px_-24px_rgba(127,162,106,0.45)]'
                          : 'border-border/80 bg-card hover:border-primary/20 hover:bg-muted/40'
                      }`}
                    >
                      <div className="shrink-0">
                        {pet.photo ? (
                          <img src={pet.photo} alt={pet.name} className="h-16 w-16 rounded-2xl border border-border object-cover" />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/40">
                            <User className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-foreground">{pet.name}</p>
                          {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {pet.species ? `${pet.species} • ` : ''}
                          {pet.breed || 'Raça não informada'}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {pet.age || 'Idade não informada'} • {pet.weight || 'Peso não informado'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <form onSubmit={handleTransfer} className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
                <h2 className="mb-4 text-2xl font-medium text-foreground">Confirmar transferência</h2>

                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-foreground">E-mail do novo tutor</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="email"
                        value={targetTutorEmail}
                        onChange={(e) => setTargetTutorEmail(e.target.value)}
                        className="w-full rounded-[18px] border border-border bg-[#efe9de] py-3 pl-12 pr-4 text-foreground outline-none transition-colors focus:border-primary"
                        placeholder="novo.tutor@email.com"
                        required
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">O e-mail deve pertencer a uma conta de tutor já cadastrada.</p>
                  </div>

                  <div>
                    <label className="mb-2 block text-foreground">Confirmação de segurança</label>
                    <div className="relative">
                      <ShieldAlert className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={securityConfirmation}
                        onChange={(e) => setSecurityConfirmation(e.target.value)}
                        className="w-full rounded-[18px] border border-border bg-[#efe9de] py-3 pl-12 pr-4 text-foreground uppercase outline-none transition-colors focus:border-primary"
                        placeholder="TRANSFERIR"
                        required
                      />
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-border bg-muted/25 p-4">
                    <p className="text-foreground">Resumo da seleção</p>
                    {selectedPets.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {selectedPets.map((pet) => (
                          <li key={pet.id}>{pet.name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Nenhum pet selecionado.</p>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-2">
                  <button
                    type="submit"
                    disabled={transferring || selectedPets.length === 0}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    {transferring ? 'Transferindo...' : `Transferir ${selectedPets.length > 1 ? 'pets' : 'pet'}`}
                  </button>
                </div>
              </form>

              <section className="rounded-[34px] border border-red-200 bg-red-50 p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                    <ShieldAlert className="h-7 w-7" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-medium text-red-700">Atenção</h2>
                    <p className="text-red-600/80">Após a transferência, o novo tutor passa a ser o responsável principal pelos pets selecionados.</p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-dashed border-red-200 bg-card/60 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="mb-1 text-red-700">Confirmação irreversível</p>
                      <p className="text-sm text-red-600/80">Garanta que o e-mail informado pertence ao tutor correto antes de concluir a operação.</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs text-red-700">Transferência</span>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3 text-sm text-red-700">
                  <Sparkles className="h-4 w-4" />
                  <span>O histórico de cada pet permanece no sistema após a transferência.</span>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </TutorShell>
  );
}

