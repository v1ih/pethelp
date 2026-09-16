import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  CalendarDays,
  Clock3,
  Languages,
  Save,
  ShieldAlert,
  Stethoscope,
  Trash2,
} from 'lucide-react';
import { ClinicShell } from '../components/layout/ClinicShell';
import { useSession } from '../context/SessionContext';
import { useAppNavigation, useDashboardBackLogout } from '../navigation';

const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function createDefaultWorkingHours() {
  return {
    Seg: { open: '08:00', close: '18:00' },
    Ter: { open: '08:00', close: '18:00' },
    Qua: { open: '08:00', close: '18:00' },
    Qui: { open: '08:00', close: '18:00' },
    Sex: { open: '08:00', close: '18:00' },
    Sáb: { open: '08:00', close: '12:00' },
    Dom: { open: '', close: '' },
  };
}

export default function ClinicSettingsScreen() {
  const navigate = useNavigate();
  const { user, updateClinicProfile, deleteCurrentUserAccount } = useSession();
  const { goToLogin } = useAppNavigation();
  useDashboardBackLogout();

  const [tradeName, setTradeName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [services, setServices] = useState('');
  const [language, setLanguage] = useState('pt-BR');
  const [workingHours, setWorkingHours] = useState<Record<string, { open: string; close: string }>>(createDefaultWorkingHours());
  const [saving, setSaving] = useState(false);
  const [dangerBusy, setDangerBusy] = useState(false);

  useEffect(() => {
    setTradeName(user?.clinicName ?? '');
    setPhone(user?.phone ?? '');
    setAddress(user?.address ?? '');
    setCnpj(user?.cnpj ?? '');
    setServices(user?.services?.join(', ') ?? '');
    setLanguage(user?.language ?? 'pt-BR');
    setWorkingHours((user?.workingHours as Record<string, { open: string; close: string }>) ?? createDefaultWorkingHours());
  }, [user]);

  const clinicName = user?.clinicName || user?.name || 'Clínica';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateClinicProfile({
        tradeName: tradeName.trim(),
        phone: phone.trim() || null,
        address: address.trim(),
        cnpj: cnpj.trim() || null,
        services: services.split(',').map((item) => item.trim()).filter(Boolean),
        workingHours,
        language,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleWorkingHoursChange = (day: string, field: 'open' | 'close', value: string) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        open: field === 'open' ? value : (prev[day]?.open ?? ''),
        close: field === 'close' ? value : (prev[day]?.close ?? ''),
      },
    }));
  };

  const handleDeactivateAccount = async () => {
    if (!confirm('Desativar a conta da clínica é uma ação irreversível. Continuar?')) return;

    setDangerBusy(true);
    try {
      await deleteCurrentUserAccount();
      goToLogin();
    } finally {
      setDangerBusy(false);
    }
  };

  const handleResetForm = () => {
    setTradeName(user?.clinicName ?? '');
    setPhone(user?.phone ?? '');
    setAddress(user?.address ?? '');
    setCnpj(user?.cnpj ?? '');
    setServices(user?.services?.join(', ') ?? '');
    setLanguage(user?.language ?? 'pt-BR');
    setWorkingHours((user?.workingHours as Record<string, { open: string; close: string }>) ?? createDefaultWorkingHours());
  };

  return (
    <ClinicShell active="settings" title="Configurações da clínica" description="Dados cadastrais, idioma, catálogo de serviços e ações sensíveis ficam centralizados aqui." actions={<button type="button" onClick={() => navigate('/clinic-veterinarians')} className="inline-flex items-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90"><Stethoscope className="h-5 w-5" />Abrir veterinários</button>}>
      <div className="space-y-6">
        <section className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[32px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Stethoscope className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Painel da clínica</p>
                <h1 className="text-3xl font-medium tracking-tight text-foreground sm:text-[38px]">{clinicName}</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Ajuste os dados institucionais, idiomas e horários de funcionamento sem perder a identidade visual do novo layout.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <CalendarDays className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Acesso rápido</p>
                <h2 className="text-2xl font-medium text-foreground">Gerenciamento operacional</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => navigate('/clinic-agenda')} className="rounded-[22px] border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted/60"><p className="text-foreground">Agenda</p><p className="mt-1 text-sm text-muted-foreground">Horários por veterinário.</p></button>
              <button type="button" onClick={() => navigate('/clinic-history')} className="rounded-[22px] border border-border bg-background px-4 py-4 text-left transition-colors hover:bg-muted/60"><p className="text-foreground">Histórico</p><p className="mt-1 text-sm text-muted-foreground">Consultas e avaliações.</p></button>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-foreground">Nome fantasia</label>
                <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} className="w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-foreground">CNPJ</label>
                <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-foreground">Telefone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" />
              </div>
              <div>
                <label className="mb-2 block text-sm text-foreground">Endereço</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[28px] border border-border bg-muted/20 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Languages className="h-4 w-4 text-primary" />
                  <h2 className="text-lg text-foreground">Idioma</h2>
                </div>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full rounded-[18px] border border-border bg-background px-4 py-3 text-foreground outline-none">
                  <option value="pt-BR">Português</option>
                  <option value="en">Inglês</option>
                  <option value="es">Espanhol</option>
                </select>
              </div>

              <div className="rounded-[28px] border border-border bg-muted/20 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-primary" />
                  <h2 className="text-lg text-foreground">Catálogo de serviços</h2>
                </div>
                <textarea value={services} onChange={(e) => setServices(e.target.value)} className="min-h-28 w-full rounded-[18px] border border-border bg-background px-4 py-3 text-foreground outline-none" />
                <p className="mt-2 text-xs text-muted-foreground">Separe os serviços por vírgula para facilitar a organização do catálogo.</p>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-primary" />
                <h2 className="text-lg text-foreground">Horário de funcionamento</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {days.map((day) => (
                  <div key={day} className="rounded-[22px] border border-border bg-muted/20 p-4">
                    <p className="mb-3 text-sm text-foreground">{day}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="time" value={workingHours[day]?.open ?? ''} onChange={(e) => handleWorkingHoursChange(day, 'open', e.target.value)} className="rounded-[14px] border border-border bg-background px-3 py-2 text-foreground outline-none" />
                      <input type="time" value={workingHours[day]?.close ?? ''} onChange={(e) => handleWorkingHoursChange(day, 'close', e.target.value)} className="rounded-[14px] border border-border bg-background px-3 py-2 text-foreground outline-none" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Salvando...' : 'Salvar configurações'}</button>
              <button type="button" onClick={handleResetForm} className="inline-flex items-center gap-2 rounded-[18px] border border-border bg-background px-5 py-3 text-foreground transition-colors hover:bg-muted"><Trash2 className="h-4 w-4" />Limpar dados do formulário</button>
            </div>
          </form>
        </section>

        <section className="rounded-[32px] border border-red-200 bg-red-50/70 p-6 shadow-[0_24px_60px_-36px_rgba(239,68,68,0.1)] sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100">
              <ShieldAlert className="h-7 w-7 text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-medium text-red-700">Zona de perigo</h2>
              <p className="mt-1 text-sm text-red-600/80">A exclusão da conta remove permanentemente o acesso da clínica.</p>

              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={handleDeactivateAccount} disabled={saving || dangerBusy} className="inline-flex items-center gap-2 rounded-[18px] bg-red-600 px-5 py-3 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"><ShieldAlert className="h-4 w-4" />{dangerBusy ? 'Processando...' : 'Desativar conta da clínica'}</button>
                <button type="button" onClick={() => { if (!confirm('Isso vai apenas limpar os campos do formulário nesta tela. Continuar?')) return; handleResetForm(); }} className="inline-flex items-center gap-2 rounded-[18px] border border-red-200 bg-card px-5 py-3 text-red-700 transition-colors hover:bg-red-100"><Trash2 className="h-4 w-4" />Limpar dados locais</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </ClinicShell>
  );
}
