import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileText,
  Paperclip,
  Plus,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Upload,
} from 'lucide-react';
import { decodeExamDocument, encodeExamDocument, getApiBase, getAuthHeaders, type MedicalRecord, type Vaccine, type VetPassRecord } from '../context/shared';
import { useInteraction } from '../context/InteractionContext';
import { useSession } from '../context/SessionContext';
import { useDashboardBackLogout } from '../navigation';
import VeterinarianShell from '../components/layout/VeterinarianShell';

type PreviewAttachment = {
  name: string;
  type: string;
  dataUrl: string;
};

type RemotePetSummary = {
  id: string;
  name: string;
  species?: string | null;
  breed?: string | null;
  age?: string | null;
  weight?: string | null;
  photo?: string | null;
  allergies?: string[] | null;
  conditions?: string[] | null;
};

function bytesToLabel(size: number) {
  if (!Number.isFinite(size) || size <= 0) return 'Tamanho desconhecido';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateLabel(value: string) {
  if (!value) return 'Data não informada';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function isSupportedFile(file: File) {
  const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  const supportedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
  const lowerName = file.name.toLowerCase();
  return supportedTypes.includes(file.type) || supportedExtensions.some((extension) => lowerName.endsWith(extension));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

function encodeFile(file: File, dataUrl: string) {
  return encodeExamDocument({
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    dataUrl,
  });
}

function normalizeVetPassRecord(value: any): VetPassRecord {
  return {
    code: value.code,
    ownerId: value.ownerId ?? value.owner_id,
    petId: value.petId ?? value.pet_id,
    petName: value.petName ?? value.pet_name ?? 'Pet',
    documents: Array.isArray(value.documents) ? value.documents : [],
    createdAt: value.createdAt ?? value.created_at ?? new Date().toISOString(),
    expiresAt: value.expiresAt ?? value.expires_at ?? new Date().toISOString(),
    redeemedAt: value.redeemedAt ?? value.redeemed_at ?? null,
  };
}

function normalizePetSummary(value: any): RemotePetSummary {
  return {
    id: value.id,
    name: value.name ?? 'Pet',
    species: value.species ?? null,
    breed: value.breed ?? null,
    age: value.age ?? null,
    weight: value.weight ?? null,
    photo: value.photo ?? null,
    allergies: Array.isArray(value.allergies) ? value.allergies : null,
    conditions: Array.isArray(value.conditions) ? value.conditions : null,
  };
}

function getStorageKey(userId?: string) {
  return userId ? `veterinarian-vet-pass:${userId}` : null;
}

function readStoredPass(key: string | null) {
  if (!key || typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = normalizeVetPassRecord(JSON.parse(raw));
    if (new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function readApiErrorMessage(resp: Response, fallback: string) {
  try {
    const data = await resp.json();
    return typeof data?.message === 'string' ? data.message : fallback;
  } catch {
    return fallback;
  }
}

function mapMedicalRecord(record: any): MedicalRecord {
  return {
    id: record.id,
    petId: record.petId ?? record.pet_id,
    date: record.date ?? record.recordDate ?? record.record_date,
    description: record.description ?? '',
    treatment: record.treatment ?? undefined,
    clinicId: record.clinicId ?? record.clinic_id ?? undefined,
    clinicName: record.clinicName ?? record.clinic_name ?? undefined,
    veterinarianName: record.veterinarianName ?? record.veterinarian_name ?? undefined,
    documents: Array.isArray(record.documents) ? record.documents : undefined,
  };
}

function mapVaccine(vaccine: any): Vaccine {
  return {
    id: vaccine.id,
    petId: vaccine.petId ?? vaccine.pet_id,
    name: vaccine.name ?? '',
    date: vaccine.date ?? vaccine.applied_date,
    nextDose: vaccine.nextDose ?? vaccine.next_dose_date ?? undefined,
    status: vaccine.status === 'late' ? 'late' : 'up-to-date',
    veterinarian: vaccine.veterinarian ?? vaccine.veterinarianName ?? vaccine.veterinarian_name ?? undefined,
    clinicId: vaccine.clinicId ?? vaccine.clinic_id ?? undefined,
    clinicName: vaccine.clinicName ?? vaccine.clinic_name ?? undefined,
  };
}

export default function VeterinarianDashboardScreen() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { appointments, updateAppointment } = useInteraction();
  useDashboardBackLogout();

  const [vetPassCode, setVetPassCode] = useState('');
  const [activePass, setActivePass] = useState<VetPassRecord | null>(null);
  const [petSummary, setPetSummary] = useState<RemotePetSummary | null>(null);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<PreviewAttachment | null>(null);
  const [loadingPass, setLoadingPass] = useState(false);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [savingVaccine, setSavingVaccine] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [recordDate, setRecordDate] = useState('');
  const [recordDescription, setRecordDescription] = useState('');
  const [recordClinicName, setRecordClinicName] = useState('');
  const [recordTreatment, setRecordTreatment] = useState('');
  const [recordFiles, setRecordFiles] = useState<File[]>([]);

  const [vaccineName, setVaccineName] = useState('');
  const [vaccineDate, setVaccineDate] = useState('');
  const [vaccineNextDose, setVaccineNextDose] = useState('');
  const [vaccineClinicName, setVaccineClinicName] = useState('');

  const API_BASE = getApiBase();
  const storageKey = getStorageKey(user?.id);

  useEffect(() => {
    const restored = readStoredPass(storageKey);
    if (restored) {
      setActivePass(restored);
      setVetPassCode(restored.code);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;

    if (activePass) {
      localStorage.setItem(storageKey, JSON.stringify(activePass));
      setVetPassCode(activePass.code);
      return;
    }

    localStorage.removeItem(storageKey);
  }, [activePass, storageKey]);
  useEffect(() => {
    if (!activePass) {
      setPetSummary(null);
      setMedicalRecords([]);
      setVaccines([]);
      return;
    }

    let cancelled = false;

    const loadPatientContext = async () => {
      setLoadingPatient(true);

      try {
        const [petResp, recordsResp, vaccinesResp] = await Promise.all([
          fetch(`${API_BASE}/api/pets/${activePass.petId}`, { headers: getAuthHeaders() }),
          fetch(`${API_BASE}/api/medical-records/pet/${activePass.petId}`, { headers: getAuthHeaders() }),
          fetch(`${API_BASE}/api/vaccines/pet/${activePass.petId}`, { headers: getAuthHeaders() }),
        ]);

        if (cancelled) return;

        if (petResp.ok) {
          const petJson = await petResp.json();
          setPetSummary(normalizePetSummary(petJson.data ?? petJson));
        } else {
          setPetSummary({ id: activePass.petId, name: activePass.petName });
        }

        if (recordsResp.ok) {
          const recordsJson = await recordsResp.json();
          setMedicalRecords((recordsJson.data ?? []).map(mapMedicalRecord));
        } else {
          setMedicalRecords([]);
        }

        if (vaccinesResp.ok) {
          const vaccinesJson = await vaccinesResp.json();
          setVaccines((vaccinesJson.data ?? []).map(mapVaccine));
        } else {
          setVaccines([]);
        }
      } catch (error) {
        console.error('Falha ao carregar dados do paciente:', error);
        if (!cancelled) {
          setFeedback({ type: 'error', message: 'Não foi possível carregar os dados do paciente validado.' });
        }
      } finally {
        if (!cancelled) {
          setLoadingPatient(false);
        }
      }
    };

    void loadPatientContext();

    return () => {
      cancelled = true;
    };
  }, [API_BASE, activePass]);

  const sortedRecords = useMemo(
    () => medicalRecords.slice().sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()),
    [medicalRecords]
  );

  const sortedVaccines = useMemo(
    () => vaccines.slice().sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()),
    [vaccines]
  );

  const hasActivePatient = !!activePass;
  const currentPetName = petSummary?.name ?? activePass?.petName ?? 'Paciente';
  const activeAppointment = useMemo(
    () =>
      activePass
        ? appointments
            .filter((appointment) => appointment.petId === activePass.petId && appointment.status === 'scheduled')
            .slice()
            .sort((left, right) => new Date(`${right.date}T${right.time}`).getTime() - new Date(`${left.date}T${left.time}`).getTime())[0] ?? null
        : null,
    [activePass, appointments]
  );
  const handleCopyPassCode = async (code: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      }
    } catch (error) {
      console.error('Falha ao copiar Vet-Pass:', error);
    }
  };

  const handleRedeemVetPass = async () => {
    const code = vetPassCode.trim().toUpperCase();
    if (!code) {
      setFeedback({ type: 'error', message: 'Informe o código do Vet-Pass.' });
      return;
    }

    setLoadingPass(true);
    setFeedback(null);

    try {
      const resp = await fetch(`${API_BASE}/api/vet-passes/${code}/redeem`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!resp.ok) {
        throw new Error(await readApiErrorMessage(resp, 'Redeem Vet-Pass failed'));
      }

      const json = await resp.json();
      setActivePass(normalizeVetPassRecord(json.data));
      setFeedback({ type: 'success', message: 'Vet-Pass validado com sucesso. O prontuário foi liberado para atendimento.' });
    } catch (error) {
      console.error('Falha ao validar Vet-Pass:', error);
      setFeedback({ type: 'error', message: 'Código inválido, expirado ou já utilizado.' });
      setActivePass(null);
    } finally {
      setLoadingPass(false);
    }
  };

  const handleEndSession = async () => {
    if (!activePass) return;

    try {
      if (activeAppointment) {
        await updateAppointment(activeAppointment.id, { status: 'completed' });
      }

      setActivePass(null);
      setVetPassCode('');
      setPetSummary(null);
      setMedicalRecords([]);
      setVaccines([]);
      setPreviewAttachment(null);
      setRecordDate('');
      setRecordDescription('');
      setRecordClinicName('');
      setRecordTreatment('');
      setRecordFiles([]);
      setVaccineName('');
      setVaccineDate('');
      setVaccineNextDose('');
      setVaccineClinicName('');
      setFeedback({ type: 'success', message: 'Sessão encerrada com sucesso.' });
    } catch (error) {
      console.error('Falha ao encerrar a sessão:', error);
      setFeedback({ type: 'error', message: 'Não foi possível encerrar a sessão.' });
    }
  };

  const handleMedicalRecordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activePass) return;

    if (!recordDate || !recordDescription.trim()) {
      setFeedback({ type: 'error', message: 'Data e descrição do atendimento são obrigatórias.' });
      return;
    }

    const invalidFile = recordFiles.find((file) => !isSupportedFile(file));
    if (invalidFile) {
      setFeedback({ type: 'error', message: 'Apenas arquivos PDF, JPG e PNG são aceitos nos anexos.' });
      return;
    }

    setSavingRecord(true);
    setFeedback(null);

    try {
      const documents = await Promise.all(recordFiles.map(async (file) => encodeFile(file, await fileToDataUrl(file))));
      const resp = await fetch(`${API_BASE}/api/medical-records/pet/${activePass.petId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          date: recordDate,
          description: recordDescription.trim(),
          clinicName: recordClinicName.trim() || undefined,
          treatment: recordTreatment.trim() || undefined,
          veterinarianName: user?.name || undefined,
          documents: documents.length > 0 ? documents : undefined,
        }),
      });

      if (!resp.ok) {
        throw new Error(await readApiErrorMessage(resp, 'Create medical record failed'));
      }

      setFeedback({ type: 'success', message: 'Novo registro clínico adicionado com sucesso.' });
      setRecordDate('');
      setRecordDescription('');
      setRecordClinicName('');
      setRecordTreatment('');
      setRecordFiles([]);

      const recordsResp = await fetch(`${API_BASE}/api/medical-records/pet/${activePass.petId}`, { headers: getAuthHeaders() });
      if (recordsResp.ok) {
        const json = await recordsResp.json();
        setMedicalRecords((json.data ?? []).map(mapMedicalRecord));
      }
    } catch (error) {
      console.error('Falha ao salvar registro clínico:', error);
      setFeedback({ type: 'error', message: 'Não foi possível salvar o registro clínico.' });
    } finally {
      setSavingRecord(false);
    }
  };

  const handleVaccineSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activePass) return;

    if (!vaccineName.trim() || !vaccineDate) {
      setFeedback({ type: 'error', message: 'Nome e data da vacina são obrigatórios.' });
      return;
    }

    setSavingVaccine(true);
    setFeedback(null);

    try {
      const resp = await fetch(`${API_BASE}/api/vaccines/pet/${activePass.petId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: vaccineName.trim(),
          date: vaccineDate,
          nextDose: vaccineNextDose.trim() || undefined,
          veterinarian: user?.name || undefined,
          clinicName: vaccineClinicName.trim() || undefined,
        }),
      });

      if (!resp.ok) {
        throw new Error(await readApiErrorMessage(resp, 'Create vaccine failed'));
      }

      setFeedback({ type: 'success', message: 'Vacina registrada com sucesso.' });
      setVaccineName('');
      setVaccineDate('');
      setVaccineNextDose('');
      setVaccineClinicName('');

      const vaccinesResp = await fetch(`${API_BASE}/api/vaccines/pet/${activePass.petId}`, { headers: getAuthHeaders() });
      if (vaccinesResp.ok) {
        const json = await vaccinesResp.json();
        setVaccines((json.data ?? []).map(mapVaccine));
      }
    } catch (error) {
      console.error('Falha ao registrar vacina:', error);
      setFeedback({ type: 'error', message: 'Não foi possível registrar a vacina.' });
    } finally {
      setSavingVaccine(false);
    }
  };
  return (
    <VeterinarianShell active="dashboard">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <section className="rounded-[28px] border border-border bg-card px-6 py-6 shadow-lg sm:px-8 sm:py-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
                <Stethoscope className="h-3.5 w-3.5" />
                Acesso seguro por Vet-Pass
              </div>
              <div className="space-y-1">
                <h1 className="text-3xl text-foreground sm:text-[40px]">Dashboard do veterinário</h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Valide o código do tutor para acessar histórico, exames e registrar o atendimento.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[440px]">
              <div className="flex min-h-[92px] flex-col items-center justify-center rounded-2xl border border-border bg-muted/20 px-4 py-4 text-center">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Consultas</p>
                <p className="mt-2 text-2xl leading-none text-foreground">{medicalRecords.length}</p>
              </div>
              <div className="flex min-h-[92px] flex-col items-center justify-center rounded-2xl border border-border bg-muted/20 px-4 py-4 text-center">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Vacinas</p>
                <p className="mt-2 text-2xl leading-none text-foreground">{vaccines.length}</p>
              </div>
              <div className="flex min-h-[92px] flex-col items-center justify-center rounded-2xl border border-border bg-muted/20 px-4 py-4 text-center">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Anexos</p>
                <p className="mt-2 text-2xl leading-none text-foreground">{activePass?.documents.length ?? 0}</p>
              </div>
              <div className="flex min-h-[92px] flex-col items-center justify-center rounded-2xl border border-border bg-muted/20 px-4 py-4 text-center">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Vet-Pass</p>
                <p className="mt-2 text-xl leading-none text-foreground">{hasActivePatient ? 'Liberado' : 'Pendente'}</p>
              </div>
            </div>
          </div>
        </section>

        {feedback && (
          <div
            className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {feedback.message}
          </div>
        )}

        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
          <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Vet-Pass do tutor</p>
                <h2 className="text-2xl text-foreground">Validar código</h2>
              </div>
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-sm text-foreground">Código do Vet-Pass</label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={vetPassCode}
                  onChange={(event) => setVetPassCode(event.target.value.toUpperCase())}
                  placeholder="VET-..."
                  className="flex-1 rounded-2xl border border-border bg-input px-4 py-3 uppercase tracking-wider text-foreground"
                />
                <button
                  type="button"
                  onClick={() => void handleRedeemVetPass()}
                  disabled={loadingPass}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {loadingPass ? 'Validando...' : 'Validar'}
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Após a validação, o histórico médico, vacinas e anexos do pet ficam disponíveis.
              </p>
              {hasActivePatient && activePass && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-foreground">Vet-Pass ativo</p>
                      <p className="text-sm text-muted-foreground">{activePass.code}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Expira em {new Date(activePass.expiresAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyPassCode(activePass.code)}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </button>
                  </div>
                </div>
              )}
              {hasActivePatient ? (
                <button
                  type="button"
                  onClick={() => void handleEndSession()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 transition-colors hover:bg-red-100"
                >
                  Encerrar sessão
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Paciente liberado</p>
                <h2 className="text-2xl text-foreground">{currentPetName}</h2>
              </div>
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>

            {loadingPatient ? (
              <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                Carregando informações do paciente...
              </div>
            ) : hasActivePatient ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-3">
                    {petSummary?.photo ? (
                      <img src={petSummary.photo} alt={currentPetName} className="h-14 w-14 rounded-2xl object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-background">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="text-foreground">{currentPetName}</p>
                      <p className="text-sm text-muted-foreground">
                        {petSummary?.species ? `${petSummary.species} • ` : ''}
                        {petSummary?.breed || 'Raça não informada'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-border bg-background px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Idade</p>
                    <p className="mt-1 text-sm text-foreground">{petSummary?.age || 'Não informada'}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Peso</p>
                    <p className="mt-1 text-sm text-foreground">{petSummary?.weight || 'Não informado'}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Alergias</p>
                    <p className="mt-1 text-sm text-foreground">{petSummary?.allergies?.length ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Condições</p>
                    <p className="mt-1 text-sm text-foreground">{petSummary?.conditions?.length ?? 0}</p>
                  </div>
                </div>

                {(petSummary?.allergies?.length || petSummary?.conditions?.length) ? (
                  <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                    {petSummary?.allergies?.length ? (
                      <div>
                        <p className="mb-2 text-xs text-muted-foreground">Alergias</p>
                        <div className="flex flex-wrap gap-2">
                          {petSummary.allergies.map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs text-primary"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {petSummary?.conditions?.length ? (
                      <div>
                        <p className="mb-2 text-xs text-muted-foreground">Condições médicas</p>
                        <div className="flex flex-wrap gap-2">
                          {petSummary.conditions.map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                Nenhum Vet-Pass validado ainda. Use o código do tutor para liberar o atendimento.
              </div>
            )}
          </div>
        </section>

        {hasActivePatient && (
          <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.92fr]">
            <form onSubmit={handleMedicalRecordSubmit} className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Atendimento</p>
                  <h2 className="text-2xl text-foreground">Novo registro clínico</h2>
                </div>
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-foreground">Data *</label>
                  <input
                    type="date"
                    value={recordDate}
                    onChange={(e) => setRecordDate(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-foreground">Clínica / Hospital</label>
                  <input
                    type="text"
                    value={recordClinicName}
                    onChange={(e) => setRecordClinicName(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-foreground"
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm text-foreground">Descrição do atendimento *</label>
                <textarea
                  value={recordDescription}
                  onChange={(e) => setRecordDescription(e.target.value)}
                  className="min-h-[120px] w-full rounded-2xl border border-border bg-input px-4 py-3 text-foreground"
                  placeholder="Descreva a avaliação, achados, hipóteses e conduta"
                  required
                />
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm text-foreground">Tratamento / conduta</label>
                <textarea
                  value={recordTreatment}
                  onChange={(e) => setRecordTreatment(e.target.value)}
                  className="min-h-[100px] w-full rounded-2xl border border-border bg-input px-4 py-3 text-foreground"
                  placeholder="Prescrição, orientações e próximos passos"
                />
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm text-foreground">Anexar exames</label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(e) => setRecordFiles(Array.from(e.target.files ?? []))}
                  className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary/90"
                />
                <p className="mt-2 text-xs text-muted-foreground">PDF, JPG e PNG são aceitos.</p>
              </div>

              {recordFiles.length > 0 && (
                <div className="mt-4 rounded-2xl border border-border bg-muted/20 p-4">
                  <p className="mb-2 text-sm text-foreground">Arquivos selecionados</p>
                  <div className="flex flex-wrap gap-2">
                    {recordFiles.map((file, index) => (
                      <span
                        key={`${file.name}-${index}`}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {file.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={savingRecord}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {savingRecord ? 'Salvando...' : 'Registrar atendimento'}
              </button>
            </form>

            <form onSubmit={handleVaccineSubmit} className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Imunização</p>
                  <h2 className="text-2xl text-foreground">Vacina aplicada</h2>
                </div>
                <Syringe className="h-6 w-6 text-primary" />
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-foreground">Nome da vacina *</label>
                  <input
                    type="text"
                    value={vaccineName}
                    onChange={(e) => setVaccineName(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-foreground"
                    placeholder="Ex.: V8, antirrábica"
                    required
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-foreground">Data da aplicação *</label>
                    <input
                      type="date"
                      value={vaccineDate}
                      onChange={(e) => setVaccineDate(e.target.value)}
                      className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-foreground"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm text-foreground">Próxima dose</label>
                    <input
                      type="date"
                      value={vaccineNextDose}
                      onChange={(e) => setVaccineNextDose(e.target.value)}
                      className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-foreground"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-foreground">Clínica / Local da aplicação</label>
                  <input
                    type="text"
                    value={vaccineClinicName}
                    onChange={(e) => setVaccineClinicName(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-foreground"
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingVaccine}
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-5 py-3 text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {savingVaccine ? 'Registrando...' : 'Registrar vacina'}
              </button>
            </form>
          </section>
        )}

        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
          <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Anexos liberados</p>
                <h2 className="text-2xl text-foreground">Exames do Vet-Pass</h2>
              </div>
              <FileText className="h-6 w-6 text-primary" />
            </div>

            <div className="mt-5 space-y-3">
              {!hasActivePatient || activePass?.documents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Nenhum exame foi liberado neste Vet-Pass.
                </div>
              ) : (
                activePass.documents.map((document, index) => {
                  const decoded = decodeExamDocument(document);
                  return (
                    <div key={`${document}-${index}`} className="rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-foreground">{decoded?.name ?? 'Arquivo anexado'}</p>
                          <p className="text-xs text-muted-foreground">
                            {decoded?.type ?? 'Tipo não informado'} • {bytesToLabel(decoded?.size ?? 0)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              decoded &&
                              setPreviewAttachment({
                                name: decoded.name,
                                type: decoded.type,
                                dataUrl: decoded.dataUrl,
                              })
                            }
                            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                          >
                            <Eye className="h-4 w-4" />
                            Visualizar
                          </button>
                          <a
                            href={decoded?.dataUrl ?? document}
                            download={decoded?.name ?? 'exame'}
                            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm text-white transition-colors hover:bg-primary/90"
                          >
                            <Download className="h-4 w-4" />
                            Baixar
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Histórico </p>
                <h2 className="text-2xl text-foreground">Registros médicos</h2>
              </div>
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>

            <div className="mt-5 space-y-3">
              {sortedRecords.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Nenhum registro clínico foi encontrado para este paciente.
                </div>
              ) : (
                sortedRecords.map((record) => {
                  const attachments = (record.documents ?? []).map((item, index) => ({
                    raw: item,
                    decoded: decodeExamDocument(item),
                    index,
                  }));

                  return (
                    <article key={record.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-foreground">{formatDateLabel(record.date)}</p>
                          {record.clinicName && <p className="text-sm text-muted-foreground">{record.clinicName}</p>}
                        </div>
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                          {attachments.length} anexo(s)
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-relaxed text-foreground">{record.description}</p>

                      {record.treatment && (
                        <div className="mt-3 rounded-2xl border border-border bg-background p-3">
                          <p className="mb-1 text-xs uppercase tracking-wide text-primary">Tratamento</p>
                          <p className="text-sm text-muted-foreground">{record.treatment}</p>
                        </div>
                      )}

                      {attachments.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-border pt-3">
                          <p className="text-sm text-foreground">Anexos</p>
                          <div className="space-y-2">
                            {attachments.map((attachment) => (
                              <div
                                key={`${record.id}-${attachment.index}`}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm text-foreground">
                                    {attachment.decoded?.name ?? 'Arquivo anexado'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {attachment.decoded?.type ?? 'Tipo não informado'} •{' '}
                                    {bytesToLabel(attachment.decoded?.size ?? 0)}
                                  </p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      attachment.decoded &&
                                      setPreviewAttachment({
                                        name: attachment.decoded.name,
                                        type: attachment.decoded.type,
                                        dataUrl: attachment.decoded.dataUrl,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Ver
                                  </button>
                                  <a
                                    href={attachment.decoded?.dataUrl ?? attachment.raw}
                                    download={attachment.decoded?.name ?? 'arquivo'}
                                    className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs text-white transition-colors hover:bg-primary/90"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    Baixar
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Imunização</p>
              <h2 className="text-2xl text-foreground">Vacinas aplicadas</h2>
            </div>
            <Syringe className="h-6 w-6 text-primary" />
          </div>

          <div className="mt-5 space-y-3">
            {sortedVaccines.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                Nenhuma vacina foi registrada para este paciente.
              </div>
            ) : (
              sortedVaccines.map((vaccine) => (
                <div key={vaccine.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-foreground">{vaccine.name}</p>
                      <p className="text-sm text-muted-foreground">Aplicada em {formatDateLabel(vaccine.date)}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${
                        vaccine.status === 'late' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {vaccine.status === 'late' ? 'Atrasada' : 'Em dia'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {vaccine.nextDose ? (
                      <span className="rounded-full border border-border bg-background px-3 py-1">
                        Próxima dose: {formatDateLabel(vaccine.nextDose)}
                      </span>
                    ) : null}
                    {vaccine.veterinarian ? (
                      <span className="rounded-full border border-border bg-background px-3 py-1">
                        Veterinário: {vaccine.veterinarian}
                      </span>
                    ) : null}
                    {vaccine.clinicName ? (
                      <span className="rounded-full border border-border bg-background px-3 py-1">
                        Local: {vaccine.clinicName}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <h3 className="text-lg text-foreground">Fluxo validado</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                O atendimento só fica disponível após a validação do Vet-Pass. Use a agenda dedicada para manter
                horários separados do fluxo clínico.
              </p>
              <button
                type="button"
                onClick={() => navigate('/veterinarian-schedule')}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-foreground transition-colors hover:bg-muted"
              >
                <ClipboardList className="h-4 w-4" />
                Abrir agenda dedicada
              </button>
            </div>
          </div>
        </section>
      </div>

      {previewAttachment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h3 className="text-lg text-foreground">{previewAttachment.name}</h3>
                <p className="text-xs text-muted-foreground">{previewAttachment.type}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
              >
                Fechar
              </button>
            </div>
            <div className="max-h-[80vh] bg-muted/30 p-4">
              {previewAttachment.type.startsWith('image/') ? (
                <img
                  src={previewAttachment.dataUrl}
                  alt={previewAttachment.name}
                  className="mx-auto max-h-[75vh] w-auto max-w-full rounded-2xl border border-border bg-background object-contain"
                />
              ) : (
                <iframe
                  src={previewAttachment.dataUrl}
                  title={previewAttachment.name}
                  className="h-[75vh] w-full rounded-2xl border border-border bg-background"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </VeterinarianShell>
  );
}

















