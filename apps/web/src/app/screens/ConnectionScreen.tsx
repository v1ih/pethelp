import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Link as LinkIcon, QrCode, Check } from 'lucide-react';
import { getDashboardRouteForUserType } from '../context/shared';
import { usePets } from '../context/PetsContext';
import { useSession } from '../context/SessionContext';
import { useAppNavigation } from '../navigation';
import { TutorShell } from '../components/layout/TutorShell';

export default function ConnectionScreen() {
  const navigate = useNavigate();
  const { currentPet, linkPetToClinic } = usePets();
  const { user } = useSession();
  const { goToPetContext } = useAppNavigation();
  const [clinicCode, setClinicCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPet) return;
    setLoading(true);
    try {
      await linkPetToClinic(currentPet.id, clinicCode);
      setSuccess(true);
      setTimeout(() => { navigate(getDashboardRouteForUserType(user?.userType), { replace: true }); }, 2000);
    } catch (error) {
      console.error('Falha na conexão:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TutorShell active="connection" title="Vincular à clínica" description={`Conecte ${currentPet?.name || 'seu pet'} usando o código fornecido pela clínica.`}>
      {success ? (
        <div className="mx-auto max-w-2xl rounded-[34px] border border-border/70 bg-card p-8 text-center shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-medium text-foreground mb-2">Conectado com sucesso!</h2>
          <p className="text-muted-foreground">Seu pet agora está vinculado à clínica. Redirecionando...</p>
        </div>
      ) : (
        <div className="mx-auto grid max-w-3xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><LinkIcon className="h-7 w-7" /></div>
              <div>
                <h2 className="text-2xl font-medium text-foreground">Como funciona</h2>
                <p className="mt-1 text-sm text-muted-foreground">Siga o fluxo abaixo para vincular o pet à clínica.</p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                ['1', 'Receba o código da clínica', 'A clínica exibe esse código no painel dela e compartilha com você'],
                ['2', 'Insira o código', 'Digite o código recebido no campo ao lado para estabelecer a conexão'],
                ['3', 'Pronto para compartilhar', 'Profissionais autorizados poderão visualizar o histórico do pet'],
              ].map(([step, title, description]) => (
                <div key={step} className="flex items-start gap-3 rounded-[24px] border border-border bg-muted/25 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm text-primary">{step}</div>
                  <div>
                    <p className="text-foreground">{title}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><QrCode className="h-5 w-5" /></div>
              <div>
                <h2 className="text-2xl font-medium text-foreground">Código de conexão</h2>
                <p className="text-sm text-muted-foreground">Digite o código fornecido pela clínica.</p>
              </div>
            </div>
            <form onSubmit={handleConnect}>
              <label className="mb-3 block text-foreground">Código de Conexão da Clínica</label>
              <div className="relative mb-6">
                <QrCode className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={clinicCode} onChange={(e) => setClinicCode(e.target.value.toUpperCase())} className="w-full rounded-[18px] border border-border bg-[#efe9de] py-4 pl-12 pr-4 text-center text-lg tracking-wider uppercase text-foreground outline-none transition-colors focus:border-primary" placeholder="CLINICA1234" required />
              </div>
              <button type="submit" disabled={loading || !currentPet} className="inline-flex w-full items-center justify-center gap-2 rounded-[18px] bg-primary py-4 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Conectando...' : 'Vincular Clínica'}</button>
            </form>
          </section>
        </div>
      )}

      {currentPet?.linkedClinicId && (
        <div className="mx-auto mt-6 max-w-3xl rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_18px_42px_-30px_rgba(127,162,106,0.2)]">
          <h3 className="mb-2 text-foreground">Vinculado Atualmente</h3>
          <p className="text-sm text-muted-foreground">Este pet já possui um vínculo ativo com um estabelecimento</p>
        </div>
      )}
    </TutorShell>
  );
}

