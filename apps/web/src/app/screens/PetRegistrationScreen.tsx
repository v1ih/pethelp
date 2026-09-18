import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Camera, PawPrint } from 'lucide-react';
import { usePets } from '../context/PetsContext';
import { TutorShell } from '../components/layout/TutorShell';
import ImageCropper from '../components/pets/ImageCropper';

export default function PetRegistrationScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentPet, pets, addPet, updatePet } = usePets();
  const selectedPet = location.state?.petId ? pets.find((pet) => pet.id === location.state.petId) ?? currentPet : currentPet;
  const isEditing = location.state?.mode === 'edit' && !!selectedPet;
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  // Seletor de espécie: 'Cachorro' | 'Gato' | 'Outro' (com campo livre) | ''
  const [speciesMode, setSpeciesMode] = useState('');
  const [age, setAge] = useState('');
  const [breed, setBreed] = useState('');
  const [weight, setWeight] = useState('');
  const [photo, setPhoto] = useState('');
  const [rawPhoto, setRawPhoto] = useState<string | null>(null); // imagem escolhida, aguardando recorte
  const [allergiesStr, setAllergiesStr] = useState('');
  const [conditionsStr, setConditionsStr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (location.state?.mode === 'edit' && !selectedPet) {
      navigate('/owner-dashboard', { replace: true });
      return;
    }

    if (!isEditing || !selectedPet) {
      setName('');
      setSpecies('');
      setSpeciesMode('');
      setAge('');
      setBreed('');
      setWeight('');
      setPhoto('');
      setAllergiesStr('');
      setConditionsStr('');
      return;
    }

    setName(selectedPet.name);
    setSpecies(selectedPet.species || '');
    setSpeciesMode(selectedPet.species ? (['Cachorro', 'Gato'].includes(selectedPet.species) ? selectedPet.species : 'Outro') : '');
    // Idade/peso são guardados como "3 anos"/"25 kg"; no formulário editamos só o número.
    setAge((selectedPet.age || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
    setBreed(selectedPet.breed || '');
    setWeight((selectedPet.weight || '').replace(/[^0-9.,]/g, '').replace(',', '.'));
    setPhoto(selectedPet.photo || '');
    setAllergiesStr(selectedPet.allergies ? selectedPet.allergies.join(', ') : '');
    setConditionsStr(selectedPet.conditions ? selectedPet.conditions.join(', ') : '');
  }, [isEditing, selectedPet, pets, location.state?.mode, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const petPayload = {
        name: name.trim(),
        species: species.trim(),
        age: age.trim() ? `${age.trim().replace(',', '.')} ${age.trim().replace(',', '.') === '1' ? 'ano' : 'anos'}` : null,
        breed: breed.trim() || null,
        weight: weight.trim() ? `${weight.trim().replace(',', '.')} kg` : null,
        photo: photo || null,
        allergies: allergiesStr ? allergiesStr.split(',').map((s) => s.trim()).filter(Boolean) : null,
        conditions: conditionsStr ? conditionsStr.split(',').map((s) => s.trim()).filter(Boolean) : null,
      };

      if (isEditing && selectedPet) {
        await updatePet(selectedPet.id, petPayload);
      } else {
        await addPet(petPayload);
      }

      navigate(isEditing ? '/pet-profile' : '/owner-dashboard', { replace: true });
    } catch (error) {
      console.error('Falha no registro do pet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(isEditing ? '/pet-profile' : '/owner-dashboard', { replace: true });
  };

  return (
    <TutorShell
      active="home"
      title={isEditing ? 'Editar pet' : 'Adicionar seu pet'}
      description={isEditing ? 'Atualize as informações do pet.' : 'Conte-nos sobre seu amigo peludo.'}
    >
      <div className="mx-auto max-w-3xl">
        <form onSubmit={handleSubmit} className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-4 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-border bg-muted">
              {photo ? <img src={photo} alt="Pet" className="h-full w-full object-cover" /> : <Camera className="h-12 w-12 text-muted-foreground" />}
            </div>
            {photo ? (
              <div className="mb-3 flex gap-4">
                <button
                  type="button"
                  onClick={() => setRawPhoto(photo)}
                  className="text-sm text-primary underline underline-offset-2 hover:opacity-80"
                >
                  Ajustar recorte
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhoto('');
                    const input = document.getElementById('photo') as HTMLInputElement | null;
                    if (input) input.value = '';
                  }}
                  className="text-sm text-destructive underline underline-offset-2 hover:opacity-80"
                >
                  Remover foto
                </button>
              </div>
            ) : null}
            <div className="w-full">
              <label htmlFor="photo" className="mb-2 block text-center text-sm font-medium text-foreground">
                Foto (opcional)
              </label>
              <input
                type="file"
                id="photo"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  const reader = new FileReader();
                  reader.onloadend = () => {
                    // Abre o recorte com a imagem escolhida.
                    setRawPhoto(reader.result as string);
                  };
                  reader.readAsDataURL(file);
                }}
                className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-center text-foreground outline-none transition-colors focus:border-primary"
              />
            </div>
          </div>

          <div className="grid gap-4">
            <p className="rounded-[14px] border border-border bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
              Apenas <span className="text-foreground">Nome</span> e <span className="text-foreground">Espécie</span> são obrigatórios. Os demais campos são opcionais.
            </p>
            <div>
              <label htmlFor="petName" className="mb-2 block text-foreground">
                Nome do Pet <span className="text-destructive">*</span>
              </label>
              <input type="text" id="petName" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" placeholder="Max" required />
            </div>

            <div>
              <label htmlFor="species" className="mb-2 block text-foreground">
                Espécie <span className="text-destructive">*</span>
              </label>
              <select
                id="species"
                value={speciesMode}
                onChange={(e) => {
                  const value = e.target.value;
                  setSpeciesMode(value);
                  setSpecies(value === 'Outro' ? '' : value);
                }}
                className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary"
                required
              >
                <option value="" disabled>Selecione…</option>
                <option value="Cachorro">Cachorro</option>
                <option value="Gato">Gato</option>
                <option value="Outro">Outro</option>
              </select>
              {speciesMode === 'Outro' && (
                <input
                  type="text"
                  aria-label="Qual espécie?"
                  value={species}
                  onChange={(e) => setSpecies(e.target.value)}
                  className="mt-2 w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary"
                  placeholder="Qual espécie?"
                  required
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="age" className="mb-2 block text-foreground">Idade (anos)</label>
                <div className="relative">
                  <input type="number" inputMode="decimal" min="0" step="0.5" id="age" value={age} onChange={(e) => setAge(e.target.value)} className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 pr-14 text-foreground outline-none transition-colors focus:border-primary" placeholder="3" />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">anos</span>
                </div>
              </div>
              <div>
                <label htmlFor="breed" className="mb-2 block text-foreground">Raça</label>
                <input type="text" id="breed" value={breed} onChange={(e) => setBreed(e.target.value)} className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" placeholder="Golden Retriever" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="weight" className="mb-2 block text-foreground">Peso (kg)</label>
                <div className="relative">
                  <input type="number" inputMode="decimal" min="0" step="0.1" id="weight" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 pr-12 text-foreground outline-none transition-colors focus:border-primary" placeholder="25" />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kg</span>
                </div>
              </div>
              <div>
                <label htmlFor="allergies" className="mb-2 block text-foreground">Alergias</label>
                <input type="text" id="allergies" value={allergiesStr} onChange={(e) => setAllergiesStr(e.target.value)} className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" placeholder="ex: Amendoim, Poeira" />
              </div>
            </div>

            <div>
              <label htmlFor="conditions" className="mb-2 block text-foreground">Condições</label>
              <input type="text" id="conditions" value={conditionsStr} onChange={(e) => setConditionsStr(e.target.value)} className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" placeholder="ex: Diabetes, Artrite" />
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="w-full rounded-[18px] border border-border bg-background px-6 py-3 text-muted-foreground transition-colors hover:bg-muted sm:w-auto"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-primary px-6 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <PawPrint className="h-5 w-5" />
              {loading ? 'Salvando...' : isEditing ? 'Atualizar pet' : 'Salvar pet'}
            </button>
          </div>
        </form>
      </div>

      {rawPhoto ? (
        <ImageCropper
          src={rawPhoto}
          onCancel={() => setRawPhoto(null)}
          onApply={(dataUrl) => {
            setPhoto(dataUrl);
            setRawPhoto(null);
          }}
        />
      ) : null}
    </TutorShell>
  );
}
