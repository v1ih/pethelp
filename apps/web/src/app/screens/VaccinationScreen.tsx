import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Plus, Syringe, Calendar, Trash2, Pencil, X, CheckCircle, AlertCircle, Camera, Download, Eye, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { useHealth } from '../context/HealthContext';
import { usePets } from '../context/PetsContext';
import { useAppNavigation } from '../navigation';
import { TutorShell } from '../components/layout/TutorShell';
import { useSession } from '../context/SessionContext';
import { fileToCompressedDataUrl } from '../utils/image';
import { shareOrDownloadVaccinationCard } from '../utils/vaccinationCardPdf';

export default function VaccinationScreen() {
  const navigate = useNavigate();
  const { currentPet } = usePets();
  const { user } = useSession();
  const { vaccines, addVaccine, updateVaccine, deleteVaccine } = useHealth();
  const { goToPetContext } = useAppNavigation();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [nextDose, setNextDose] = useState('');
  const [veterinarian, setVeterinarian] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Vacina cuja foto está aberta em tela cheia.
  const [photoInView, setPhotoInView] = useState<{ name: string; photo: string } | null>(null);

  if (!currentPet) {
    return (
      <TutorShell active="vaccines" title="Carteira de vacinação" description="Nenhum pet selecionado no momento.">
        <div className="mx-auto max-w-2xl rounded-[34px] border border-border/70 bg-card p-10 text-center shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
          <p className="text-foreground mb-4">Nenhum pet selecionado</p>
          <button onClick={goToPetContext} className="rounded-[18px] bg-primary px-6 py-3 text-white transition-colors hover:bg-primary/90">Voltar</button>
        </div>
      </TutorShell>
    );
  }

  const petVaccines = vaccines.filter((v) => v.petId === currentPet.id);

  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await shareOrDownloadVaccinationCard({
        pet: currentPet,
        vaccines: petVaccines,
        tutorName: user?.name ?? null,
      });
      if (result === 'downloaded') {
        toast.success('Carteirinha em PDF baixada.');
      }
    } catch (error) {
      console.error('Falha ao gerar a carteirinha em PDF:', error);
      toast.error('Não foi possível gerar a carteirinha em PDF.');
    } finally {
      setExporting(false);
    }
  };

  const clearForm = () => {
    setEditingId(null);
    setName('');
    setDate('');
    setNextDose('');
    setVeterinarian('');
    setClinicName('');
    setPhoto(null);
    setShowForm(false);
  };

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Limpa o input para permitir escolher o mesmo arquivo de novo depois de remover.
    event.target.value = '';
    if (!file) return;

    setPhotoLoading(true);
    try {
      setPhoto(await fileToCompressedDataUrl(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível usar essa imagem.');
    } finally {
      setPhotoLoading(false);
    }
  };

  const startCreate = () => {
    clearForm();
    setShowForm(true);
  };

  const startEdit = (vaccine: (typeof petVaccines)[number]) => {
    setEditingId(vaccine.id);
    setName(vaccine.name);
    setDate(vaccine.date);
    setNextDose(vaccine.nextDose || '');
    setVeterinarian(vaccine.veterinarian || '');
    setClinicName(vaccine.clinicName || '');
    setPhoto(vaccine.photo ?? null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!name || !date) return;

    const payload = {
      name,
      date,
      nextDose: nextDose || undefined,
      veterinarian: veterinarian || undefined,
      clinicName: clinicName || undefined,
      // Sempre enviado: null remove a foto de um registro que já tinha uma.
      photo,
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateVaccine(editingId, payload);
      } else {
        await addVaccine({ petId: currentPet.id, ...payload });
      }
      clearForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a vacina.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TutorShell
      active="vaccines"
      title="Carteira de Vacinação"
      description={`Histórico de imunização de ${currentPet.name}`}
      actions={
        <>
          <button
            onClick={() => (showForm ? clearForm() : startCreate())}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 sm:w-auto"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span>{editingId ? 'Editar Vacina' : 'Registrar Vacina'}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={exporting || petVaccines.length === 0}
            title={petVaccines.length === 0 ? 'Registre uma vacina para gerar a carteirinha' : undefined}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-border bg-card px-5 py-3 text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <FileDown className="h-4 w-4" />
            <span>{exporting ? 'Gerando PDF...' : 'Carteirinha em PDF'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {showForm && (
          <form onSubmit={handleSubmit} className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
            <h2 className="mb-4 text-2xl font-medium text-foreground">{editingId ? 'Editar Vacina' : 'Nova Vacina'}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-foreground">Nome da Vacina *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: V8, Raiva, Gripe Canina" className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" required />
              </div>
              <div>
                <label className="mb-2 block text-sm text-foreground">Data de Aplicação *</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" required />
              </div>
              <div>
                <label className="mb-2 block text-sm text-foreground">Próxima Dose (Opcional)</label>
                <input type="date" value={nextDose} onChange={(e) => setNextDose(e.target.value)} className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-foreground">Veterinário Responsável (Opcional)</label>
                <input type="text" value={veterinarian} onChange={(e) => setVeterinarian(e.target.value)} placeholder="Nome do profissional ou CRMV" className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-foreground">Clínica / Local de Aplicação (Opcional)</label>
                <input type="text" value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="Ex: Clínica PetHelp" className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="vaccinePhoto" className="mb-2 block text-sm text-foreground">Foto da vacina ou da carteirinha (Opcional)</label>
                {photo ? (
                  <div className="flex flex-col gap-3 rounded-[18px] border border-border bg-input-background p-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => setPhotoInView({ name: name || 'Foto da vacina', photo })}
                      className="mx-auto shrink-0 overflow-hidden rounded-[14px] border border-border bg-background sm:mx-0"
                      title="Ver foto em tamanho maior"
                    >
                      <img src={photo} alt="Foto da vacina" className="h-28 w-28 object-cover" />
                    </button>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <label
                        htmlFor="vaccinePhoto"
                        className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[18px] border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                      >
                        <Camera className="h-4 w-4" />
                        Trocar foto
                      </label>
                      <button
                        type="button"
                        onClick={() => setPhoto(null)}
                        className="inline-flex min-h-11 items-center justify-center rounded-[18px] border border-border bg-background px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
                      >
                        Remover foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="vaccinePhoto"
                    className="flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-[18px] border border-dashed border-border bg-input-background px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    <Camera className="h-5 w-5" />
                    {photoLoading ? 'Preparando imagem...' : 'Toque para tirar ou escolher uma foto'}
                  </label>
                )}
                <input
                  id="vaccinePhoto"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => void handlePhotoChange(event)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={clearForm} className="rounded-[18px] border border-border bg-background px-4 py-3 text-muted-foreground transition-colors hover:bg-muted">Cancelar</button>
              <button type="submit" disabled={saving} className="rounded-[18px] bg-primary px-4 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Salvando...' : editingId ? 'Atualizar Registro' : 'Salvar Registro'}</button>
            </div>
          </form>
        )}

        {petVaccines.length === 0 ? (
          <div className="rounded-[34px] border border-border/70 bg-card p-5 sm:p-8 text-center shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
            <p className="text-muted-foreground">Nenhuma vacina registrada para este pet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {petVaccines.map((vaccine) => (
              <div key={vaccine.id} className="rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_18px_42px_-30px_rgba(127,162,106,0.2)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    {vaccine.photo ? (
                      <button
                        type="button"
                        onClick={() => setPhotoInView({ name: vaccine.name, photo: vaccine.photo as string })}
                        className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-border bg-background transition-opacity hover:opacity-80"
                        title={`Ver foto de ${vaccine.name}`}
                      >
                        <img src={vaccine.photo} alt={`Foto da vacina ${vaccine.name}`} className="h-full w-full object-cover" />
                      </button>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Syringe className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg text-foreground">{vaccine.name}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs ${vaccine.status === 'late' ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'}`}>{vaccine.status === 'late' ? 'Atrasada' : 'Em dia'}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Aplicada em {vaccine.date}</p>
                      <p className="text-sm text-muted-foreground">{vaccine.nextDose ? `Próxima dose: ${vaccine.nextDose}` : 'Próxima dose não informada'}</p>
                      <p className="text-sm text-muted-foreground">{vaccine.veterinarian || 'Veterinário não informado'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {vaccine.photo ? (
                      <button
                        onClick={() => setPhotoInView({ name: vaccine.name, photo: vaccine.photo as string })}
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                      >
                        <Eye className="h-4 w-4" />
                        Ver foto
                      </button>
                    ) : null}
                    <button onClick={() => startEdit(vaccine)} className="rounded-full border border-border bg-background p-3 text-muted-foreground transition-colors hover:bg-muted" title="Editar Vacina"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => { if (confirm(`Remover o registro da vacina ${vaccine.name}?`)) void deleteVaccine(vaccine.id); }} className="rounded-full border border-border bg-background p-3 text-red-600 transition-colors hover:bg-red-50" title="Excluir Vacina"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {photoInView ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPhotoInView(null)}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg text-foreground">{photoInView.name}</h3>
                <p className="text-xs text-muted-foreground">Foto da vacina / carteirinha</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={photoInView.photo}
                  download={`vacina-${photoInView.name.replace(/[^\w.-]+/g, '-').toLowerCase()}.jpg`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary/90"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Baixar</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPhotoInView(null)}
                  className="inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="max-h-[80vh] overflow-auto bg-muted/30 p-3 sm:p-4">
              <img
                src={photoInView.photo}
                alt={`Foto da vacina ${photoInView.name}`}
                className="mx-auto max-h-[70vh] w-auto max-w-full rounded-[20px] border border-border bg-background object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </TutorShell>
  );
}
