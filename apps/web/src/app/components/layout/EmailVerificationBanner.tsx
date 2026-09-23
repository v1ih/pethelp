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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3 sm:items-center">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 sm:mt-0" />
          <p className="min-w-0 flex-1 text-sm">
            Confirme seu e-mail para manter a conta segura. Enviamos um código para{' '}
            <strong className="break-all">{user.email}</strong>.
          </p>
        </div>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 sm:w-auto"
          >
            Confirmar agora
          </button>
        ) : null}
      </div>

      {open ? (
        <form onSubmit={handleVerify} className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="Código de 6 dígitos"
            className="min-h-11 w-full rounded-xl border border-amber-400 bg-card px-3 py-2 text-base tracking-widest text-foreground outline-none focus:border-amber-500 dark:border-amber-500/40 sm:w-44"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {busy ? 'Verificando...' : 'Verificar'}
          </button>
          <button
            type="button"
            onClick={() => void handleResend()}
            className="inline-flex min-h-11 items-center justify-center text-sm underline underline-offset-2"
          >
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
