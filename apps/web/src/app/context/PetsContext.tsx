import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useInteraction } from './InteractionContext';
import { useSession } from './SessionContext';
import {
  getApiBase,
  getAuthHeaders,
  normalizePetFromApi,
  type Pet,
  type PetMutationPayload,
} from './shared';

interface PetsContextValue {
  currentPet: Pet | null;
  setCurrentPet: (pet: Pet | null) => void;
  pets: Pet[];
  loading: boolean;
  addPet: (pet: PetMutationPayload) => Promise<void>;
  updatePet: (id: string, pet: PetMutationPayload) => Promise<void>;
  deletePet: (id: string) => Promise<void>;
  transferPetOwnership: (petId: string, payload: { targetTutorEmail: string; securityConfirmation: string; petNameConfirmation: string }) => Promise<Pet>;
  linkPetToClinic: (petId: string, clinicCode: string) => Promise<void>;
}

const PetsContext = createContext<PetsContextValue | undefined>(undefined);

export function PetsProvider({ children }: { children: ReactNode }) {
  const { user, authReady } = useSession();
  const { addNotification } = useInteraction();
  const [currentPet, setCurrentPet] = useState<Pet | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const API_BASE = getApiBase();

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      setPets([]);
      setCurrentPet(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const fetchPets = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/pets`, { headers: { ...getAuthHeaders() } });
        if (!resp.ok) {
          if (!cancelled) {
            setPets([]);
            setCurrentPet(null);
          }
          return;
        }

        const data = await resp.json();
        const list: Pet[] = (data.data ?? []).map(normalizePetFromApi);

        if (cancelled) return;

        setPets(list);
        setCurrentPet((prev) => {
          if (prev) {
            const matched = list.find((pet) => pet.id === prev.id);
            if (matched) {
              return matched;
            }
          }

          return list[0] ?? null;
        });
      } catch (error) {
        console.error('fetchPets error', error);
        if (!cancelled) {
          setPets([]);
          setCurrentPet(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchPets();

    return () => {
      cancelled = true;
    };
  }, [API_BASE, authReady, user?.id]);

  const addPet = (pet: PetMutationPayload) => {
    return (async () => {
      try {
        const body = {
          currentTutorId: pet.currentTutorId ?? pet.ownerId,
          ownerId: pet.ownerId,
          name: pet.name?.trim(),
          species: pet.species?.trim(),
          age: pet.age?.trim() || null,
          breed: pet.breed?.trim() || null,
          weight: pet.weight?.trim() || null,
          photo: pet.photo || null,
          allergies: pet.allergies ?? null,
          conditions: pet.conditions ?? null,
          isActive: pet.isActive,
        };

        const resp = await fetch(`${API_BASE}/api/pets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify(body),
        });
        if (!resp.ok) throw new Error((await resp.json()).message ?? 'Create pet failed');
        const { data } = await resp.json();
        const newPet = normalizePetFromApi(data);
        setPets((prev) => [...prev, newPet]);
        setCurrentPet((prev) => prev ?? newPet);
      } catch (error) {
        console.error('addPet error', error);
        throw error;
      }
    })();
  };

  const updatePet = (id: string, petUpdate: PetMutationPayload) => {
    return (async () => {
      try {
        const { linkedClinicId, ...updatableFields } = petUpdate;
        const hasApiFields = Object.values(updatableFields).some((value) => value !== undefined);

        if (!hasApiFields && linkedClinicId !== undefined) {
          setPets((prev) => prev.map((petItem) => (petItem.id === id ? { ...petItem, linkedClinicId } : petItem)));
          setCurrentPet((prev) => (prev?.id === id ? { ...prev, linkedClinicId } : prev));
          return;
        }

        const payload = {
          ...updatableFields,
          currentTutorId: petUpdate.currentTutorId ?? petUpdate.ownerId,
        };

        const resp = await fetch(`${API_BASE}/api/pets/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) throw new Error((await resp.json()).message ?? 'Update failed');
        const { data } = await resp.json();
        const updatedPet = normalizePetFromApi(data);
        setPets((prev) => prev.map((petItem) => (petItem.id === id ? { ...petItem, ...updatedPet } : petItem)));
        setCurrentPet((prev) => {
          if (!prev) return null;
          return prev.id === id ? { ...prev, ...updatedPet } : prev;
        });
      } catch (error) {
        console.error('updatePet error', error);
        throw error;
      }
    })();
  };

  const transferPetOwnership = async (
    petId: string,
    payload: { targetTutorEmail: string; securityConfirmation: string; petNameConfirmation: string }
  ) => {
    const resp = await fetch(`${API_BASE}/api/pets/${petId}/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Transfer failed');
    }

    const { data } = await resp.json();
    const transferredPet = normalizePetFromApi(data);

    setPets((prev) => {
      const nextPets = prev.filter((petItem) => petItem.id !== petId);
      setCurrentPet((current) => {
        if (!current) return nextPets[0] ?? null;
        if (current.id === petId) return nextPets[0] ?? null;
        const matched = nextPets.find((petItem) => petItem.id === current.id);
        return matched ?? nextPets[0] ?? null;
      });
      return nextPets;
    });

    return transferredPet;
  };

  const deletePet = (id: string) => {
    return (async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/pets/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (!resp.ok && resp.status !== 204) throw new Error((await resp.json()).message ?? 'Delete failed');
        setPets((prev) => {
          const nextPets = prev.filter((petItem) => petItem.id !== id);
          setCurrentPet((current) => {
            if (!current) return nextPets[0] ?? null;
            if (current.id === id) return nextPets[0] ?? null;
            const matched = nextPets.find((petItem) => petItem.id === current.id);
            return matched ?? nextPets[0] ?? null;
          });
          return nextPets;
        });
      } catch (error) {
        console.error('deletePet error', error);
        throw error;
      }
    })();
  };

  const linkPetToClinic = async (petId: string, clinicCode: string) => {
    const resp = await fetch(`${API_BASE}/api/pets/${petId}/link-clinic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ connectionCode: clinicCode }),
    });

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Link clinic failed');
    }

    const { data } = await resp.json();
    const updatedPet = normalizePetFromApi(data);

    setPets((prev) => prev.map((petItem) => (petItem.id === petId ? { ...petItem, ...updatedPet } : petItem)));
    setCurrentPet((prev) => (prev?.id === petId ? { ...prev, ...updatedPet } : prev));
    addNotification({
      userId: user?.id || '',
      type: 'connection',
      title: 'Clinic Linked Successfully',
      message: `Your pet has been linked to the clinic with code ${clinicCode}`,
      date: new Date().toISOString().split('T')[0],
      petId,
      read: false,
    });
  };

  return (
    <PetsContext.Provider
      value={{
        currentPet,
        setCurrentPet,
        pets,
        loading,
        addPet,
        updatePet,
        deletePet,
        transferPetOwnership,
        linkPetToClinic,
      }}
    >
      {children}
    </PetsContext.Provider>
  );
}

export function usePets() {
  const context = useContext(PetsContext);
  if (!context) {
    throw new Error('usePets must be used within a PetsProvider');
  }
  return context;
}
