import React, { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '../../context/SessionContext';

export default function EmailVerificationBanner() {
  const { user, verifyEmail, resendVerification } = useSession();
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  if (!user || user.emailVerified) return null;

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      await verifyEmail(code);
      toast.success('E-mail verificado com sucesso! 🎉');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível verificar o e-mail.');
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    try {
      const result = await resendVerification();
      if (result.code) setDevCode(result.code);
      setOpen(true);
      toast.success(result.emailSent ? 'Código reenviado para o seu e-mail.' : 'Código gerado (e-mail não configurado).');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível reenviar o código.');
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-amber-400/70 bg-amber-100 p-4 text-foreground dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex flex-wrap items-center gap-3">
        <MailCheck className="h-5 w-5 shrink-0" />
        <p className="flex-1 text-sm">
          Confirme seu e-mail para manter a conta segura. Enviamos um código para <strong>{user.email}</strong>.
        </p>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            Confirmar agora
          </button>
        ) : null}
      </div>

      {open ? (
        <form onSubmit={handleVerify} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="Código de 6 dígitos"
            className="w-44 rounded-xl border border-amber-400 bg-card px-3 py-2 text-sm tracking-widest text-foreground outline-none focus:border-amber-500 dark:border-amber-500/40"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Verificando...' : 'Verificar'}
          </button>
          <button type="button" onClick={() => void handleResend()} className="text-sm underline underline-offset-2">
            Reenviar código
          </button>
          {devCode ? (
            <span className="text-xs">
              Código (teste): <strong>{devCode}</strong>
            </span>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
