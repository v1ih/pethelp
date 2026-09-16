import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Plus, Syringe, Calendar, Trash2, Pencil, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useHealth } from '../context/HealthContext';
import { usePets } from '../context/PetsContext';
import { useAppNavigation } from '../navigation';
import { TutorShell } from '../components/layout/TutorShell';

export default function VaccinationScreen() {
  const navigate = useNavigate();
  const { currentPet } = usePets();
  const { vaccines, addVaccine, updateVaccine, deleteVaccine } = useHealth();
  const { goToPetContext } = useAppNavigation();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [nextDose, setNextDose] = useState('');
  const [veterinarian, setVeterinarian] = useState('');
  const [clinicName, setClinicName] = useState('');

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

  const clearForm = () => {
    setEditingId(null);
    setName('');
    setDate('');
    setNextDose('');
    setVeterinarian('');
    setClinicName('');
    setShowForm(false);
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
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !date) return;

    const payload = {
      name,
      date,
      nextDose: nextDose || undefined,
      veterinarian: veterinarian || undefined,
      clinicName: clinicName || undefined,
    };

    if (editingId) {
      await updateVaccine(editingId, payload);
    } else {
      await addVaccine({ petId: currentPet.id, ...payload });
    }

    clearForm();
  };

  return (
    <TutorShell active="vaccines" title="Carteira de Vacinação" description={`Histórico de imunização de ${currentPet.name}`} actions={<button onClick={() => (showForm ? clearForm() : startCreate())} className="inline-flex items-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90">{showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}<span>{editingId ? 'Editar Vacina' : 'Registrar Vacina'}</span></button>}>
      <div className="space-y-6">
        {showForm && (
          <form onSubmit={handleSubmit} className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
            <h2 className="mb-4 text-2xl font-medium text-foreground">{editingId ? 'Editar Vacina' : 'Nova Vacina'}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-foreground">Nome da Vacina *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: V8, Raiva, Gripe Canina" className="w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" required />
              </div>
              <div>
                <label className="mb-2 block text-sm text-foreground">Data de Aplicação *</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" required />
              </div>
              <div>
                <label className="mb-2 block text-sm text-foreground">Próxima Dose (Opcional)</label>
                <input type="date" value={nextDose} onChange={(e) => setNextDose(e.target.value)} className="w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-foreground">Veterinário Responsável (Opcional)</label>
                <input type="text" value={veterinarian} onChange={(e) => setVeterinarian(e.target.value)} placeholder="Nome do profissional ou CRMV" className="w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-foreground">Clínica / Local de Aplicação (Opcional)</label>
                <input type="text" value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="Ex: Clínica PetHelp" className="w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={clearForm} className="rounded-[18px] border border-border bg-background px-4 py-3 text-muted-foreground transition-colors hover:bg-muted">Cancelar</button>
              <button type="submit" className="rounded-[18px] bg-primary px-4 py-3 text-white transition-colors hover:bg-primary/90">{editingId ? 'Atualizar Registro' : 'Salvar Registro'}</button>
            </div>
          </form>
        )}

        {petVaccines.length === 0 ? (
          <div className="rounded-[34px] border border-border/70 bg-card p-8 text-center shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
            <p className="text-muted-foreground">Nenhuma vacina registrada para este pet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {petVaccines.map((vaccine) => (
              <div key={vaccine.id} className="rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_18px_42px_-30px_rgba(127,162,106,0.2)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Syringe className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg text-foreground">{vaccine.name}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs ${vaccine.status === 'late' ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'}`}>{vaccine.status === 'late' ? 'Atrasada' : 'Em dia'}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Aplicada em {vaccine.date}</p>
                      <p className="text-sm text-muted-foreground">{vaccine.nextDose ? `Próxima dose: ${vaccine.nextDose}` : 'Próxima dose não informada'}</p>
                      <p className="text-sm text-muted-foreground">{vaccine.veterinarian || 'Veterinário não informado'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(vaccine)} className="rounded-full border border-border bg-background p-2 text-muted-foreground transition-colors hover:bg-muted" title="Editar Vacina"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => { if (confirm(`Remover o registro da vacina ${vaccine.name}?`)) void deleteVaccine(vaccine.id); }} className="rounded-full border border-border bg-background p-2 text-red-600 transition-colors hover:bg-red-50" title="Excluir Vacina"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </TutorShell>
  );
}
