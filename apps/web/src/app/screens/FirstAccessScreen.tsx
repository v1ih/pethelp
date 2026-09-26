import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Eye, EyeOff, KeyRound, Lock, Mail, PawPrint } from 'lucide-react';
import { useSession } from '../context/SessionContext';
import { getApiBase, getDashboardRouteForUserType } from '../context/shared';

// Campo de senha próprio: o PasswordInput compartilhado depende do CSS injetado pela
// AuthShell, que não existe nesta tela.
function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-medium">
        {label} <span className="text-destructive">*</span>
      </label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-14 w-full rounded-[18px] border border-border bg-input-background py-3 pl-12 pr-12 text-base outline-none transition-colors focus:border-primary"
          placeholder={placeholder}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Ocultar senha' : 'Exibir senha'}
          className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

/**
 * Primeiro acesso de quem teve a conta criada por uma clínica. A pessoa já recebeu um
 * código por e-mail, então aqui ela só digita o código e cria a senha — pedir para usar
 * "Esqueci minha senha" geraria um código novo e invalidaria o que ela tem em mãos.
 */
export default function FirstAccessScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useSession();
  const API_BASE = getApiBase();

  const [email, setEmail] = useState(searchParams.get('email')?.trim() ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }

    if (password.length < 8) {
      setMessage({ type: 'error', text: 'A senha precisa ter pelo menos 8 caracteres.' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const resp = await fetch(`${API_BASE}/api/auth/password-recovery/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          newPassword: password,
          acceptedTerms: true,
        }),
      });

      const payload = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(payload?.message ?? 'Não foi possível criar sua senha.');
      }

      // Já entra na conta: a pessoa acabou de definir a senha, não faz sentido
      // mandá-la digitar tudo de novo na tela de login.
      try {
        const userType = await login(email.trim(), password, 'owner');
        navigate(getDashboardRouteForUserType(userType), { replace: true });
        return;
      } catch {
        setMessage({ type: 'success', text: 'Senha criada! Entre com seu e-mail e a nova senha.' });
        window.setTimeout(() => navigate('/', { replace: true }), 2200);
      }
    } catch (error) {
      const raw = error instanceof Error ? error.message : '';
      setMessage({
        type: 'error',
        text: /inválido|expirado/i.test(raw)
          ? 'Código inválido ou expirado. Peça à clínica para refazer o convite ou use "Esqueci minha senha" na tela de login para receber um novo código.'
          : raw || 'Não foi possível criar sua senha.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--page-background)] px-4 pb-28 pt-10 text-foreground sm:px-6">
      <div className="mx-auto w-full max-w-[520px]">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <img src="/icon.png" alt="PetHelp" className="h-14 w-14 object-contain" />
          <div>
            <h1 className="text-[28px] font-medium leading-tight tracking-tight">Bem-vindo(a) ao PetHelp</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sua clínica criou seu acesso. Crie sua senha para ver os dados do seu pet.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_22px_60px_-36px_rgba(64,52,39,0.18)] sm:p-7"
        >
          {message ? (
            <div
              className={`mb-5 rounded-[16px] border px-4 py-3 text-sm ${
                message.type === 'success'
                  ? 'border-primary/30 bg-primary/10 text-foreground'
                  : 'border-destructive/30 bg-destructive/10 text-foreground'
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <div className="grid gap-5">
            <div>
              <label htmlFor="firstAccessEmail" className="mb-2 block font-medium">
                E-mail <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="firstAccessEmail"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="min-h-14 w-full rounded-[18px] border border-border bg-input-background py-3 pl-12 pr-4 text-base outline-none transition-colors focus:border-primary"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="firstAccessCode" className="mb-2 block font-medium">
                Código recebido por e-mail <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="firstAccessCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  className="min-h-14 w-full rounded-[18px] border border-border bg-input-background py-3 pl-12 pr-4 text-base tracking-[0.3em] outline-none transition-colors focus:border-primary"
                  placeholder="000000"
                  required
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                É o código de 6 dígitos do e-mail de boas-vindas. Ele vale por 7 dias.
              </p>
            </div>

            <PasswordField
              id="firstAccessPassword"
              label="Crie sua senha"
              value={password}
              onChange={setPassword}
              placeholder="Pelo menos 8 caracteres"
            />

            <PasswordField
              id="firstAccessConfirm"
              label="Confirme a senha"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Repita a senha"
            />

            <label className="flex items-start gap-3 rounded-[18px] border border-border bg-muted/25 p-4 text-sm">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
                required
              />
              <span className="text-muted-foreground">
                Li e concordo com a{' '}
                <Link to="/privacidade" target="_blank" className="text-primary underline underline-offset-2">
                  Política de Privacidade
                </Link>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !acceptedTerms}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-primary px-5 text-[17px] font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PawPrint className="h-5 w-5" />
              {loading ? 'Criando acesso...' : 'Criar senha e entrar'}
            </button>
          </div>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Já tem senha?{' '}
          <Link to="/" className="text-primary underline underline-offset-2">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
