import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Mail, PawPrint, ShieldCheck, ShieldOff, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getApiBase, getAuthHeaders, type VetPassRecord } from '../context/shared';
import { usePets } from '../context/PetsContext';
import { TutorShell } from '../components/layout/TutorShell';

function toUiVetPass(item: any): VetPassRecord {
  return {
    code: item.code ?? item.pass_code ?? '',
    ownerId: item.tutorId ?? item.tutor_id ?? item.ownerId ?? '',
    petId: item.petId ?? item.pet_id ?? '',
    petName: item.petName ?? item.pet_name ?? '',
    documents: Array.isArray(item.documents) ? item.documents : [],
    createdAt: item.createdAt ?? item.created_at ?? new Date().toISOString(),
    expiresAt: item.expiresAt ?? item.expires_at ?? new Date().toISOString(),
    redeemedAt: item.redeemedAt ?? item.redeemed_at ?? undefined,
    includesMedicalRecords: item.includesMedicalRecords ?? item.includes_medical_records,
    includesVaccines: item.includesVaccines ?? item.includes_vaccines,
    includesExams: item.includesExams ?? item.includes_exams,
    redeemedByName: item.redeemedByName ?? item.redeemed_name ?? undefined,
    redeemedByEmail: item.redeemedByEmail ?? item.redeemed_email ?? undefined,
    redeemedByType: item.redeemedByType ?? item.redeemed_type ?? undefined,
  };
}

function scopeLabels(pass: VetPassRecord): string[] {
  const labels: string[] = [];
  if (pass.includesMedicalRecords !== false) labels.push('Prontuário');
  if (pass.includesVaccines !== false) labels.push('Vacinas');
  if (pass.includesExams !== false) labels.push('Exames');
  return labels;
}

type PassStatus = { label: string; tone: 'active' | 'used' | 'expired' };

function getStatus(pass: VetPassRecord): PassStatus {
  const expired = new Date(pass.expiresAt).getTime() < Date.now();
  if (expired) return { label: 'Expirado', tone: 'expired' };
  if (pass.redeemedAt || pass.redeemedByName || pass.redeemedByEmail) return { label: 'Em uso', tone: 'used' };
  return { label: 'Aguardando uso', tone: 'active' };
}

const toneClasses: Record<PassStatus['tone'], string> = {
  active: 'bg-emerald-100 text-emerald-700',
  used: 'bg-primary/10 text-primary',
  expired: 'bg-muted text-muted-foreground',
};

export default function SharesScreen() {
  const { clearPetClinicLink } = usePets();
  const [passes, setPasses] = useState<VetPassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const API_BASE = getApiBase();

  const loadPasses = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/vet-passes/me`, { headers: getAuthHeaders() });
      if (!resp.ok) return;
      const { data } = await resp.json();
      setPasses(((data ?? []) as any[]).map(toUiVetPass));
    } catch (error) {
      console.error('Falha ao carregar compartilhamentos:', error);
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  useEffect(() => {
    void loadPasses();
  }, [loadPasses]);

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code);
    toast.success('Código copiado.');
  };

  const handleEmail = async (code: string) => {
    setBusyCode(code);
    try {
      const resp = await fetch(`${API_BASE}/api/vet-passes/${code}/email`, { method: 'POST', headers: getAuthHeaders() });
      const payload = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(payload?.message ?? 'Falha ao enviar');
      if (payload?.data?.sent) {
        toast.success(`Vet-Pass enviado para ${payload.data.email}.`);
      } else {
        toast.message('O envio de e-mail não está configurado no servidor, mas o código continua salvo aqui.');
      }
    } catch (error) {
      console.error('Falha ao enviar Vet-Pass por e-mail:', error);
      toast.error('Não foi possível enviar o Vet-Pass por e-mail.');
    } finally {
      setBusyCode(null);
    }
  };

  const revoke = async (pass: VetPassRecord) => {
    setBusyCode(pass.code);
    try {
      const resp = await fetch(`${API_BASE}/api/vet-passes/${pass.code}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!resp.ok && resp.status !== 204) throw new Error('Falha ao encerrar');

      const payload = await resp.json().catch(() => null);
      setPasses((current) => current.filter((item) => item.code !== pass.code));

      // Quando o passe era de uma clínica, o vínculo do pet com ela também cai.
      if (payload?.unlinkedClinicName) {
        clearPetClinicLink(pass.petId);
        toast.success(`${payload.unlinkedClinicName} não vê mais os dados de ${pass.petName}.`);
      } else {
        toast.success('Compartilhamento encerrado. O código não vale mais.');
      }
    } catch (error) {
      console.error('Falha ao encerrar compartilhamento:', error);
      toast.error('Não foi possível encerrar o compartilhamento.');
    } finally {
      setBusyCode(null);
    }
  };

  const handleRevoke = (pass: VetPassRecord) => {
    const holder = pass.redeemedByName;
    const description =
      pass.redeemedByType === 'clinic'
        ? `${holder ?? 'A clínica'} deixa de ver o prontuário, as vacinas e os exames de ${pass.petName}, e o pet é desvinculado dela. Consultas e registros já feitos continuam no histórico, e você pode vincular de novo com o código da clínica.`
        : 'O veterinário perde o acesso imediatamente e o código deixa de funcionar.';

    toast(`Encerrar o compartilhamento de ${pass.petName}?`, {
      description,
      duration: 12000,
      action: { label: 'Encerrar', onClick: () => void revoke(pass) },
      cancel: { label: 'Cancelar', onClick: () => {} },
    });
  };

  const sortedPasses = useMemo(
    () => passes.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [passes]
  );

  return (
    <TutorShell
      active="shares"
      title="Compartilhamentos"
      description="Veja todos os Vet-Pass que você gerou, com quem cada um está compartilhado e encerre o acesso quando quiser."
    >
      {loading ? (
        <div className="rounded-[28px] border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          Carregando compartilhamentos...
        </div>
      ) : sortedPasses.length === 0 ? (
        <div className="rounded-[34px] border border-border/70 bg-card p-10 text-center shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="text-foreground">Você ainda não compartilhou nenhum Vet-Pass.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Gere um código na tela de Exames para liberar os dados do seu pet a um veterinário. Ele aparece aqui para você acompanhar e encerrar quando quiser.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedPasses.map((pass) => {
            const status = getStatus(pass);
            const isExpired = status.tone === 'expired';
            const sharedWith = pass.redeemedByName || pass.redeemedByEmail;
            return (
              <section key={pass.code} className="rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <PawPrint className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <p className="text-lg text-foreground">{pass.petName}</p>
                        <p className="break-all font-mono text-xs text-muted-foreground">{pass.code}</p>
                      </div>
                      <span className={`ml-1 rounded-full px-3 py-1 text-xs ${toneClasses[status.tone]}`}>{status.label}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {scopeLabels(pass).map((label) => (
                        <span key={label} className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-foreground">{label}</span>
                      ))}
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>
                        {isExpired ? 'Expirou em ' : 'Válido até '}
                        {new Date(pass.expiresAt).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5" />
                        {sharedWith ? (
                          <span>
                            Compartilhado com <strong className="text-foreground">{pass.redeemedByName || 'Veterinário'}</strong>
                            {pass.redeemedByEmail ? ` (${pass.redeemedByEmail})` : ''}
                          </span>
                        ) : (
                          'Ainda não foi usado por nenhum veterinário'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => handleCopy(pass.code)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleEmail(pass.code)}
                      disabled={busyCode === pass.code}
                      className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      <Mail className="h-4 w-4" />
                      E-mail
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevoke(pass)}
                      disabled={busyCode === pass.code}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                    >
                      <ShieldOff className="h-4 w-4" />
                      Encerrar
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </TutorShell>
  );
}
