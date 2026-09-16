import { useNavigate } from 'react-router';
import { ArrowLeft, ArrowLeftRight, AlertCircle, Calendar, Edit, FileUp, FileText, PawPrint, Syringe } from 'lucide-react';
import { getDashboardRouteForUserType } from '../context/shared';
import { useHealth } from '../context/HealthContext';
import { usePets } from '../context/PetsContext';
import { useSession } from '../context/SessionContext';
import { useAppNavigation } from '../navigation';
import { TutorShell } from '../components/layout/TutorShell';

export default function PetProfileScreen() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { currentPet, deletePet } = usePets();
  const { medicalRecords, vaccines } = useHealth();
  const { goToDashboard } = useAppNavigation();

  if (!currentPet) {
    return (
      <TutorShell active="profile" title="Perfil do pet" description="Nenhum pet selecionado no momento.">
        <div className="mx-auto max-w-2xl rounded-[34px] border border-border/70 bg-card p-10 text-center shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
          <p className="text-foreground mb-4">Nenhum pet selecionado</p>
          <button onClick={() => goToDashboard(user?.userType)} className="inline-flex items-center gap-2 rounded-[18px] bg-primary px-6 py-3 text-white transition-colors hover:bg-primary/90">
            Voltar
          </button>
        </div>
      </TutorShell>
    );
  }

  const petRecords = medicalRecords.filter((record) => record.petId === currentPet.id);
  const petVaccines = vaccines.filter((vaccine) => vaccine.petId === currentPet.id);
  const petExams = medicalRecords.filter((record) => record.petId === currentPet.id && (record.documents?.length ?? 0) > 0);

  return (
    <TutorShell active="profile" title={`Perfil de ${currentPet.name}`} description="Visão geral do histórico, vacinas e consultas do pet.">
      <div className="space-y-6">
        <section className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {currentPet.photo ? (
              <img
                src={currentPet.photo}
                alt={currentPet.name}
                className="h-32 w-32 rounded-[28px] object-cover border border-border shadow-sm"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-[28px] border border-border bg-muted">
                <PawPrint className="h-12 w-12 text-muted-foreground" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-3xl font-medium text-foreground">{currentPet.name}</h2>
                  <p className="mt-2 text-lg text-muted-foreground">
                    {currentPet.species ? `${currentPet.species} - ` : ''}{currentPet.breed || 'Raça não informada'}
                  </p>
                </div>

                {user?.userType === 'owner' && (
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => navigate('/pet-registration', { state: { mode: 'edit', petId: currentPet.id } })} className="inline-flex items-center gap-2 rounded-[18px] border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted" title="Editar Pet">
                      <Edit className="h-4 w-4" />
                      Editar
                    </button>
                    <button onClick={() => navigate('/pet-transfer')} className="inline-flex items-center gap-2 rounded-[18px] border border-border bg-background px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted" title="Transferir titularidade">
                      <ArrowLeftRight className="h-4 w-4" />
                      Transferir
                    </button>
                    <button
                      onClick={async () => {
                        if (!currentPet) return;
                        if (confirm(`Tem certeza que deseja excluir o perfil de ${currentPet.name}?`)) {
                          try {
                            await deletePet(currentPet.id);
                            navigate(getDashboardRouteForUserType(user?.userType), { replace: true });
                          } catch (err) {
                            console.error('Erro ao excluir pet:', err);
                          }
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 transition-colors hover:bg-red-100"
                      title="Excluir Pet"
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-border bg-muted/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Idade</p>
                  <p className="mt-1 text-sm text-foreground">{currentPet.age || 'Não informada'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Peso</p>
                  <p className="mt-1 text-sm text-foreground">{currentPet.weight || 'Não informado'}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Alergias</p>
                  <p className="mt-1 text-sm text-foreground">{currentPet.allergies?.length || 0}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/35 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Condições</p>
                  <p className="mt-1 text-sm text-foreground">{currentPet.conditions?.length || 0}</p>
                </div>
              </div>

              {((currentPet.allergies && currentPet.allergies.length > 0) || (currentPet.conditions && currentPet.conditions.length > 0)) && (
                <div className="mt-6 space-y-4 rounded-[28px] border border-border/70 bg-muted/20 p-5">
                  {currentPet.allergies && currentPet.allergies.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertCircle className="h-3 w-3 text-primary" /> Alergias
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {currentPet.allergies.map((allergy, index) => (
                          <span key={index} className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs text-primary">{allergy}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {currentPet.conditions && currentPet.conditions.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs text-muted-foreground">Condições médicas</p>
                      <div className="flex flex-wrap gap-2">
                        {currentPet.conditions.map((condition, index) => (
                          <span key={index} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground">{condition}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <button onClick={() => navigate('/medical-history')} className="rounded-[28px] border border-border/70 bg-card p-6 text-left transition-colors hover:bg-muted/40">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="mb-1 text-lg text-foreground">Histórico Médico</h3>
            <p className="text-sm text-muted-foreground">{petRecords.length} registros</p>
          </button>
          <button onClick={() => navigate('/vaccines')} className="rounded-[28px] border border-border/70 bg-card p-6 text-left transition-colors hover:bg-muted/40">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Syringe className="h-6 w-6" />
            </div>
            <h3 className="mb-1 text-lg text-foreground">Vacinação</h3>
            <p className="text-sm text-muted-foreground">{petVaccines.length} vacinas</p>
          </button>
          <button onClick={() => navigate('/exams')} className="rounded-[28px] border border-border/70 bg-card p-6 text-left transition-colors hover:bg-muted/40">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileUp className="h-6 w-6" />
            </div>
            <h3 className="mb-1 text-lg text-foreground">Exames</h3>
            <p className="text-sm text-muted-foreground">{petExams.length} laudos</p>
          </button>
          <button onClick={() => navigate('/appointments')} className="rounded-[28px] border border-border/70 bg-card p-6 text-left transition-colors hover:bg-muted/40">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="mb-1 text-lg text-foreground">Consultas</h3>
            <p className="text-sm text-muted-foreground">Agendar visitas</p>
          </button>
        </section>

        {petRecords.length > 0 && (
          <section className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-medium text-foreground">Histórico Médico Recente</h2>
              <button onClick={() => navigate('/medical-history')} className="text-sm text-primary transition-colors hover:text-primary/80">Ver Todos</button>
            </div>
            <div className="space-y-3">
              {petRecords.slice(0, 3).map((record) => (
                <div key={record.id} className="rounded-[24px] border border-border/70 bg-muted/25 p-4">
                  <div className="mb-2 flex justify-between gap-4">
                    <p className="text-foreground">{record.date}</p>
                    {record.clinicName && <p className="text-sm text-muted-foreground">{record.clinicName}</p>}
                  </div>
                  <p className="text-sm text-muted-foreground">{record.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </TutorShell>
  );
}

