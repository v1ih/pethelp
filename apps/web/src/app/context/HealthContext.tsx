import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useInteraction } from './InteractionContext';
import { usePets } from './PetsContext';
import { useSession } from './SessionContext';
import {
  getApiBase,
  getAuthHeaders,
  normalizeMedicalRecordFromApi,
  normalizeVaccineFromApi,
  type MedicalRecord,
  type Vaccine,
} from './shared';

interface HealthContextValue {
  medicalRecords: MedicalRecord[];
  addMedicalRecord: (record: Omit<MedicalRecord, 'id'>) => Promise<void>;
  updateMedicalRecord: (id: string, record: Partial<Omit<MedicalRecord, 'id'>>) => Promise<void>;
  deleteMedicalRecord: (id: string) => Promise<void>;
  vaccines: Vaccine[];
  addVaccine: (vaccine: Omit<Vaccine, 'id' | 'status'>) => Promise<void>;
  updateVaccine: (id: string, vaccine: Partial<Vaccine>) => Promise<void>;
  deleteVaccine: (id: string) => Promise<void>;
}

const HealthContext = createContext<HealthContextValue | undefined>(undefined);

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function daysUntil(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function HealthProvider({ children }: { children: ReactNode }) {
  const { currentPet } = usePets();
  const { user } = useSession();
  const { addNotification, notifications } = useInteraction();
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const API_BASE = getApiBase();

  useEffect(() => {
    if (!currentPet?.id) {
      setMedicalRecords([]);
      setVaccines([]);
      return;
    }

    let cancelled = false;

    const fetchPetHealthData = async (petId: string) => {
      try {
        const [recordsResp, vaccinesResp] = await Promise.all([
          fetch(`${API_BASE}/api/medical-records/pet/${petId}`, {
            headers: { ...getAuthHeaders() },
          }),
          fetch(`${API_BASE}/api/vaccines/pet/${petId}`, {
            headers: { ...getAuthHeaders() },
          }),
        ]);

        if (cancelled) return;

        if (recordsResp.ok) {
          const recordsData = await recordsResp.json();
          setMedicalRecords((recordsData.data ?? []).map(normalizeMedicalRecordFromApi));
        } else {
          setMedicalRecords([]);
        }

        if (vaccinesResp.ok) {
          const vaccinesData = await vaccinesResp.json();
          setVaccines((vaccinesData.data ?? []).map(normalizeVaccineFromApi));
        } else {
          setVaccines([]);
        }
      } catch (error) {
        console.error('fetchPetHealthData error', error);
        if (!cancelled) {
          setMedicalRecords([]);
          setVaccines([]);
        }
      }
    };

    void fetchPetHealthData(currentPet.id);

    return () => {
      cancelled = true;
    };
  }, [API_BASE, currentPet?.id]);

  useEffect(() => {
    if (!user?.id || !currentPet?.id) return;

    for (const vaccine of vaccines) {
      if (!vaccine.nextDose) continue;

      const remainingDays = daysUntil(vaccine.nextDose);
      if (remainingDays > 30) continue;

      const sourceKey = `vaccine-reminder:${vaccine.id}`;
      if (notifications.some((notification) => notification.userId === user.id && notification.sourceKey === sourceKey)) {
        continue;
      }

      addNotification({
        userId: user.id,
        type: 'vaccine',
        title: remainingDays < 0 ? 'Vacina vencida' : 'Vacina próxima do vencimento',
        message:
          remainingDays < 0
            ? `${vaccine.name} está atrasada para ${currentPet.name}.`
            : `${vaccine.name} vence em ${Math.max(remainingDays, 0)} dia(s) para ${currentPet.name}.`,
        date: new Date().toISOString().slice(0, 10),
        read: false,
        petId: currentPet.id,
        sourceKey,
      });
    }
  }, [addNotification, currentPet?.id, currentPet?.name, notifications, user?.id, vaccines]);

  const addMedicalRecord = async (record: Omit<MedicalRecord, 'id'>) => {
    if (!currentPet?.id) {
      throw new Error('Nenhum pet selecionado');
    }

    const resp = await fetch(`${API_BASE}/api/medical-records/pet/${currentPet.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(record),
    });

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Create medical record failed');
    }

    const { data } = await resp.json();
    const newRecord = normalizeMedicalRecordFromApi(data);
    setMedicalRecords((prev) => [newRecord, ...prev]);
  };

  const updateMedicalRecord = async (id: string, recordUpdate: Partial<Omit<MedicalRecord, 'id'>>) => {
    const resp = await fetch(`${API_BASE}/api/medical-records/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(recordUpdate),
    });

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Update medical record failed');
    }

    const { data } = await resp.json();
    const updatedRecord = normalizeMedicalRecordFromApi(data);
    setMedicalRecords((prev) =>
      prev.map((recordItem) => (recordItem.id === id ? { ...recordItem, ...updatedRecord } : recordItem))
    );
  };

  const deleteMedicalRecord = async (id: string) => {
    const resp = await fetch(`${API_BASE}/api/medical-records/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!resp.ok && resp.status !== 204) {
      throw new Error((await resp.json()).message ?? 'Delete medical record failed');
    }

    setMedicalRecords((prev) => prev.filter((record) => record.id !== id));
  };

  const addVaccine = async (vaccine: Omit<Vaccine, 'id' | 'status'>) => {
    if (!currentPet?.id) {
      throw new Error('Nenhum pet selecionado');
    }

    const resp = await fetch(`${API_BASE}/api/vaccines/pet/${currentPet.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(vaccine),
    });

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Create vaccine failed');
    }

    const { data } = await resp.json();
    const newVaccine = normalizeVaccineFromApi(data);
    setVaccines((prev) => [...prev, newVaccine]);
  };

  const deleteVaccine = async (id: string) => {
    const resp = await fetch(`${API_BASE}/api/vaccines/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!resp.ok && resp.status !== 204) {
      throw new Error((await resp.json()).message ?? 'Delete vaccine failed');
    }

    setVaccines((prev) => prev.filter((vaccine) => vaccine.id !== id));
  };

  const updateVaccine = async (id: string, vaccineUpdate: Partial<Vaccine>) => {
    const resp = await fetch(`${API_BASE}/api/vaccines/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(vaccineUpdate),
    });

    if (!resp.ok) {
      throw new Error((await resp.json()).message ?? 'Update vaccine failed');
    }

    const { data } = await resp.json();
    const updatedVaccine = normalizeVaccineFromApi(data);
    setVaccines((prev) =>
      prev.map((vaccineItem) => (vaccineItem.id === id ? { ...vaccineItem, ...updatedVaccine } : vaccineItem))
    );
  };

  return (
    <HealthContext.Provider
      value={{
        medicalRecords,
        addMedicalRecord,
        updateMedicalRecord,
        deleteMedicalRecord,
        vaccines,
        addVaccine,
        updateVaccine,
        deleteVaccine,
      }}
    >
      {children}
    </HealthContext.Provider>
  );
}

export function useHealth() {
  const context = useContext(HealthContext);
  if (!context) {
    throw new Error('useHealth must be used within a HealthProvider');
  }
  return context;
}

