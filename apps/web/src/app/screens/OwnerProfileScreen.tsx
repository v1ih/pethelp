import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { IdCard, Mail, Phone, Save, Settings, ShieldAlert, Trash2, User } from 'lucide-react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { useSession } from '../context/SessionContext';
import { TutorShell } from '../components/layout/TutorShell';

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function formatCpf(value: string) {
  const digits = digitsOnly(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function formatPhone(value: string) {
  const digits = digitsOnly(value).slice(0, 11);

  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : '';
  }

  const area = digits.slice(0, 2);
  const rest = digits.slice(2);

  if (rest.length <= 4) {
    return `(${area}) ${rest}`;
  }

  if (digits.length <= 10) {
    return `(${area}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }

  return `(${area}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
}

export default function OwnerProfileScreen() {
  const navigate = useNavigate();
  const { user, updateCurrentUserProfile, deleteCurrentUserAccount } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setName(user?.name ?? '');
    setPhone(formatPhone(user?.phone ?? ''));
    setCpf(formatCpf(user?.cpf ?? ''));
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      await updateCurrentUserProfile({
        name: name.trim(),
        phone: phone.trim() || null,
        cpf: cpf.trim() || null,
      });

      setFeedback({ type: 'success', message: 'Configurações salvas com sucesso.' });
    } catch (error) {
      console.error('Falha ao atualizar perfil:', error);
      setFeedback({ type: 'error', message: 'Não foi possível atualizar as configurações.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmation.trim().toUpperCase() !== 'EXCLUIR') {
      setFeedback({ type: 'error', message: 'Digite EXCLUIR para confirmar a remoção da conta.' });
      return;
    }

    setDeleting(true);
    setFeedback(null);

    try {
      await deleteCurrentUserAccount();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Falha ao excluir conta:', error);
      setFeedback({ type: 'error', message: 'Nao foi possivel excluir a conta. Verifique se existem registros vinculados.' });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteConfirmation('');
    }
  };

  return (
    <TutorShell active="settings" title="Configurações" description="Atualize seus dados, idioma e preferências da conta.">
      <div className="space-y-6">
        <section className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Settings className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-medium text-foreground">Configurações da conta</h1>
              <p className="text-muted-foreground">Edite seus dados e gerencie sua experiência no sistema.</p>
            </div>
          </div>

          {feedback && (
            <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${feedback.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {feedback.message}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="mb-2 block text-foreground">Nome completo</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-[18px] border border-border bg-[#efe9de] py-3 pl-12 pr-4 text-foreground outline-none transition-colors focus:border-primary" required />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-foreground">E-mail</label>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Bloqueado</span>
              </div>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input type="email" value={user?.email ?? ''} disabled aria-readonly="true" className="w-full rounded-[18px] border border-border bg-muted py-3 pl-12 pr-4 text-muted-foreground cursor-not-allowed" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">O e-mail não pode ser alterado nesta conta.</p>
            </div>

            <div>
              <label className="mb-2 block text-foreground">Telefone</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} className="w-full rounded-[18px] border border-border bg-[#efe9de] py-3 pl-12 pr-4 text-foreground outline-none transition-colors focus:border-primary" placeholder="(11) 99999-9999" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-foreground">CPF</label>
              <div className="relative">
                <IdCard className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} className="w-full rounded-[18px] border border-border bg-[#efe9de] py-3 pl-12 pr-4 text-foreground outline-none transition-colors focus:border-primary" placeholder="000.000.000-00" />
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={saving || deleting} className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                <Save className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-[34px] border border-red-200 bg-red-50 p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-3xl font-medium text-red-700">Zona de perigo</h2>
              <p className="text-red-600/80">A exclusão da conta remove permanentemente seus dados de acesso.</p>
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-1 text-red-700">Excluir conta</p>
              <p className="text-sm text-red-600/80">Seus pets vinculados permanecem no sistema sem tutor. Se houver registros dependentes, a exclusão pode ser bloqueada.</p>
            </div>
            <button type="button" onClick={() => setDeleteDialogOpen(true)} disabled={saving || deleting} className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-red-600 px-5 py-3 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Excluindo...' : 'Excluir conta'}
            </button>
          </div>
        </section>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteConfirmation(''); }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão da conta</AlertDialogTitle>
            <AlertDialogDescription>Digite EXCLUIR para confirmar. Seus pets continuarão no sistema sem tutor, e quaisquer dependências podem impedir a exclusão.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="block text-sm text-foreground">Confirme digitando EXCLUIR</label>
            <input type="text" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} className="w-full rounded-[18px] border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-red-400" placeholder="EXCLUIR" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <button type="button" onClick={handleDelete} disabled={deleting || deleteConfirmation.trim().toUpperCase() !== 'EXCLUIR'} className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Excluindo...' : 'Excluir conta'}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TutorShell>
  );
}
