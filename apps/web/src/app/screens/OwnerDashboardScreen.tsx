import React, { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, CheckCircle, ChevronRight, PawPrint, Plus } from 'lucide-react';
import { usePets } from '../context/PetsContext';
import { useDashboardBackLogout } from '../navigation';
import { TutorShell } from '../components/layout/TutorShell';

export default function OwnerDashboardScreen() {
  const navigate = useNavigate();
  const { currentPet, pets, setCurrentPet, loading } = usePets();
  useDashboardBackLogout();

  useEffect(() => {
    if (!currentPet && pets.length > 0) {
      setCurrentPet(pets[0]);
    }
  }, [currentPet, pets, setCurrentPet]);

  if (loading && pets.length === 0) {
    return (
      <TutorShell active="home" title="Meus Pets" description="Gerencie a saúde dos seus companheiros.">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="h-40 animate-pulse rounded-[34px] border border-border/70 bg-card" />
          <div className="h-24 animate-pulse rounded-[28px] border border-border/70 bg-card" />
          <p className="text-center text-sm text-muted-foreground">Carregando seus pets…</p>
        </div>
      </TutorShell>
    );
  }

  if (pets.length === 0) {
    return (
      <TutorShell
        active="home"
        title="Meus Pets"
        description="Gerencie a saúde dos seus companheiros."
        actions={
          <button
            onClick={() => navigate('/pet-registration', { state: { mode: 'create' } })}
            className="inline-flex items-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90"
          >
            <Plus className="h-5 w-5" />
            Adicionar pet
          </button>
        }
      >
        <div className="mx-auto flex min-h-[48vh] max-w-3xl items-center justify-center rounded-[34px] border border-border/70 bg-card p-10 text-center shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
          <div>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
              <PawPrint className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-medium text-foreground">Nenhum pet cadastrado ainda</h2>
            <p className="mt-2 text-sm text-muted-foreground">Cadastre um pet para continuar.</p>
            <button
              onClick={() => navigate('/pet-registration', { state: { mode: 'create' } })}
              className="mt-8 inline-flex items-center gap-2 rounded-[18px] bg-primary px-6 py-3 text-white transition-colors hover:bg-primary/90"
            >
              Adicionar seu pet
            </button>
          </div>
        </div>
      </TutorShell>
    );
  }

  const activePet = currentPet ?? pets[0];

  return (
    <TutorShell
      active="home"
      title="Meus Pets"
      description="Gerencie a saúde dos seus companheiros."
      actions={
        <button
          onClick={() => navigate('/pet-registration', { state: { mode: 'create' } })}
          className="inline-flex items-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="h-5 w-5" />
          Adicionar pet
        </button>
      }
    >
      <div className="space-y-6">
        <section className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="relative shrink-0">
              {activePet.photo ? (
                <img
                  src={activePet.photo}
                  alt={activePet.name}
                  className="h-32 w-32 rounded-[32px] border border-border object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-[32px] border border-border bg-muted/40">
                  <PawPrint className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Pet ativo
                  </div>
                  <h2 className="mt-4 text-3xl font-medium text-foreground">{activePet.name}</h2>
                  <p className="mt-2 text-lg text-muted-foreground">
                    {activePet.species ? `${activePet.species} • ` : ''}
                    {activePet.breed || 'Raça não informada'}
                  </p>
                </div>

                <button
                  onClick={() => navigate('/pet-profile')}
                  className="inline-flex items-center gap-2 self-start rounded-[18px] border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  Ver perfil
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-border bg-muted/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Idade</p>
                  <p className="mt-1 text-sm text-foreground">{activePet.age || 'Não informada'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Peso</p>
                  <p className="mt-1 text-sm text-foreground">{activePet.weight || 'Não informado'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Alergias</p>
                  <p className="mt-1 text-sm text-foreground">{activePet.allergies?.length || 0}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Condições</p>
                  <p className="mt-1 text-sm text-foreground">{activePet.conditions?.length || 0}</p>
                </div>
              </div>

              {((activePet.allergies && activePet.allergies.length > 0) || (activePet.conditions && activePet.conditions.length > 0)) && (
                <div className="mt-6 space-y-4 rounded-[28px] border border-border/70 bg-muted/20 p-5">
                  {activePet.allergies && activePet.allergies.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs text-muted-foreground">Alergias</p>
                      <div className="flex flex-wrap gap-2">
                        {activePet.allergies.map((allergy, index) => (
                          <span key={index} className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs text-primary">
                            {allergy}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activePet.conditions && activePet.conditions.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs text-muted-foreground">Condições médicas</p>
                      <div className="flex flex-wrap gap-2">
                        {activePet.conditions.map((condition, index) => (
                          <span key={index} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground">
                            {condition}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="text-xl font-medium text-foreground">Seus pets</h3>
            <p className="mt-1 text-sm text-muted-foreground">Selecione um pet para alternar o contexto da dashboard.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pets.map((pet) => {
              const isActive = activePet.id === pet.id;

              return (
                <button
                  key={pet.id}
                  onClick={() => setCurrentPet(pet)}
                  className={`group flex items-center gap-4 rounded-[28px] border p-4 text-left transition-all ${
                    isActive
                      ? 'border-primary/30 bg-primary/10 shadow-[0_16px_34px_-24px_rgba(127,162,106,0.45)]'
                      : 'border-border/80 bg-card hover:border-primary/20 hover:bg-muted/40'
                  }`}
                >
                  <div className="shrink-0">
                    {pet.photo ? (
                      <img src={pet.photo} alt={pet.name} className="h-16 w-16 rounded-2xl border border-border object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/40">
                        <PawPrint className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-foreground">{pet.name}</p>
                      {isActive ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {pet.species ? `${pet.species} • ` : ''}
                      {pet.breed || 'Raça não informada'}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {pet.age || 'Idade não informada'} • {pet.weight || 'Peso não informado'}
                    </p>
                  </div>

                  <ChevronRight className={`h-5 w-5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground/60'}`} />
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </TutorShell>
  );
}

