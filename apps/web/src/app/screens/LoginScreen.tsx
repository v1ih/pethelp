import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { KeyRound, Mail, ShieldCheck, X } from 'lucide-react';
import { getDashboardRouteForUserType, type UserType } from '../context/shared';
import { useSession } from '../context/SessionContext';
import { PasswordInput } from '../components/ui/password-input';
import { AuthShell } from '../components/layout/AuthShell';

type RecoveryStep = 'request' | 'verify' | 'reset';

function ProgressBar({ step }: { step: RecoveryStep }) {
  const activeIndex = step === 'request' ? 0 : step === 'verify' ? 1 : 2;

  return (
    <div className="auth-progress">
      {[0, 1, 2].map((index) => {
        const stateClass = index < activeIndex ? 'auth-progress-step-complete' : index === activeIndex ? 'auth-progress-step-active' : '';
        return <div key={index} className={`auth-progress-step ${stateClass}`} />;
      })}
    </div>
  );
}

export default function LoginScreen() {
  const navigate = useNavigate();
  const { login } = useSession();
  const API_BASE = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:3333';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<UserType>('owner');
  const [loading, setLoading] = useState(false);
  const [loginMessage, setLoginMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('request');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');

  const openRecovery = () => {
    setRecoveryEmail(email);
    setRecoveryStep('request');
    setRecoveryMessage(null);
    setRecoveryCode('');
    setRecoveryCodeInput('');
    setRecoveryNewPassword('');
    setRecoveryConfirmPassword('');
    setShowPasswordRecovery(true);
  };

  const resetRecoveryState = () => {
    setRecoveryStep('request');
    setRecoveryLoading(false);
    setRecoveryMessage(null);
    setRecoveryEmail('');
    setRecoveryCode('');
    setRecoveryCodeInput('');
    setRecoveryNewPassword('');
    setRecoveryConfirmPassword('');
  };

  const requestRecoveryCode = async (emailToUse: string) => {
    setRecoveryLoading(true);
    setRecoveryMessage(null);

    try {
      const resp = await fetch(`${API_BASE}/api/auth/password-recovery/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToUse.trim() }),
      });

      if (!resp.ok) {
        const error = await resp.json();
        throw new Error(error.message ?? 'Recovery request failed');
      }

      const data = await resp.json();
      setRecoveryCode(data.code);
      setRecoveryCodeInput('');
      setRecoveryStep('verify');
      setRecoveryMessage({ type: 'success', text: `Código enviado para ${emailToUse.trim()}.` });
    } catch (error) {
      console.error('Falha ao solicitar recuperacao de senha:', error);
      setRecoveryMessage({ type: 'error', text: 'Não foi possível enviar o código de recuperação.' });
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginMessage(null);

    try {
      const resolvedUserType = await login(email, password, userType);
      navigate(getDashboardRouteForUserType(resolvedUserType), { replace: true });
    } catch (error) {
      console.error('Falha ao realizar login:', error);
      const raw = error instanceof Error ? error.message : '';
      let text = 'E-mail ou senha incorretos. Confira e tente novamente.';
      if (/servidor|failed to fetch/i.test(raw)) {
        text = 'Não foi possível falar com o servidor. Verifique se o backend está rodando.';
      } else if (/inactive|inativ/i.test(raw)) {
        text = 'Esta conta está inativa.';
      }
      setLoginMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordRecoveryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestRecoveryCode(recoveryEmail);
  };

  const handleRecoveryCodeVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryMessage(null);

    if (recoveryCodeInput.trim() !== recoveryCode.trim()) {
      setRecoveryMessage({ type: 'error', text: 'O código informado não confere.' });
      return;
    }

    setRecoveryStep('reset');
    setRecoveryMessage(null);
  };

  const handlePasswordRecoveryConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    setRecoveryMessage(null);

    if (recoveryNewPassword !== recoveryConfirmPassword) {
      setRecoveryMessage({ type: 'error', text: 'As senhas não coincidem.' });
      setRecoveryLoading(false);
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/api/auth/password-recovery/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: recoveryEmail.trim(),
          code: recoveryCode.trim(),
          newPassword: recoveryNewPassword,
        }),
      });

      if (!resp.ok) {
        const error = await resp.json();
        throw new Error(error.message ?? 'Password recovery confirmation failed');
      }

      setLoginMessage({ type: 'success', text: 'Senha atualizada com sucesso. Entre novamente com a nova senha.' });
      setPassword('');
      setShowPasswordRecovery(false);
      resetRecoveryState();
    } catch (error) {
      console.error('Falha ao confirmar nova senha:', error);
      setRecoveryMessage({ type: 'error', text: 'Não foi possível alterar a senha. Verifique o código e tente novamente.' });
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <AuthShell
      activeTab="login"
      onTabChange={(tab) => {
        if (tab === 'register') navigate('/register');
      }}
      role={userType}
      onRoleChange={setUserType}
    >
      {loginMessage ? <div className={`auth-message ${loginMessage.type === 'success' ? 'auth-message-success' : 'auth-message-error'}`}>{loginMessage.text}</div> : null}

      <form onSubmit={handleLogin}>
        <div className="auth-field">
          <label htmlFor="email" className="auth-label">
            E-mail <span className="auth-required">*</span>
          </label>
          <div className="auth-input-wrap">
            <Mail className="auth-icon" size={20} />
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              placeholder="ana@email.com"
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="password" className="auth-label">
            Senha <span className="auth-required">*</span>
          </label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={openRecovery} className="auth-text-link">
              Esqueci minha senha
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="auth-button-primary">
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="auth-footer">
        Não tem uma conta?{' '}
        <button type="button" onClick={() => navigate('/register')} className="auth-link">
          Cadastrar
        </button>
      </p>

      {showPasswordRecovery ? (
        <div className="auth-modal-backdrop">
          <div className="auth-modal">
            <div className="auth-modal-header">
              <div>
                <h2 className="auth-modal-title">Recuperar senha</h2>
                <p className="auth-modal-subtitle">
                  {recoveryStep === 'request'
                    ? 'Informe seu e-mail cadastrado'
                    : recoveryStep === 'verify'
                      ? 'Digite o código recebido'
                      : 'Crie uma nova senha'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordRecovery(false);
                  resetRecoveryState();
                }}
                className="auth-modal-close"
                aria-label="Fechar"
              >
                <X size={24} />
              </button>
            </div>

            <ProgressBar step={recoveryStep} />

            <div className="auth-modal-body">
              {recoveryMessage ? <div className={`auth-message ${recoveryMessage.type === 'success' ? 'auth-message-success' : 'auth-message-error'}`}>{recoveryMessage.text}</div> : null}

              {recoveryStep === 'request' ? (
                <form onSubmit={handlePasswordRecoveryRequest}>
                  <div className="auth-field">
                    <label htmlFor="recovery-email" className="auth-label">
                      E-mail cadastrado <span className="auth-required">*</span>
                    </label>
                    <div className="auth-input-wrap">
                      <Mail className="auth-icon" size={20} />
                      <input
                        type="email"
                        id="recovery-email"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        className="auth-input"
                        placeholder="seu@email.com"
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={recoveryLoading} className="auth-button-primary">
                    <KeyRound size={20} />
                    Enviar código
                  </button>
                </form>
              ) : null}

              {recoveryStep === 'verify' ? (
                <form onSubmit={handleRecoveryCodeVerify}>
                  {recoveryCode ? (
                    <div className="auth-code-box">
                      <div className="auth-code-label">Código enviado para {recoveryEmail}.</div>
                      <div className="auth-code-value">{recoveryCode}</div>
                    </div>
                  ) : null}

                  <div className="auth-field">
                    <label htmlFor="recovery-code" className="auth-label">
                      Código de verificação <span className="auth-required">*</span>
                    </label>
                    <input
                      id="recovery-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={recoveryCodeInput}
                      onChange={(e) => setRecoveryCodeInput(e.target.value)}
                      className="auth-input auth-input-no-icon auth-input-center"
                      placeholder="••••••"
                      maxLength={6}
                      required
                    />
                  </div>

                  <p className="auth-helper" style={{ textAlign: 'center' }}>
                    Código enviado para {recoveryEmail}
                  </p>

                  <button type="submit" className="auth-button-primary" disabled={recoveryLoading}>
                    Verificar código
                  </button>

                  <button type="button" onClick={() => void requestRecoveryCode(recoveryEmail)} className="auth-link" style={{ display: 'block', margin: '12px auto 0' }}>
                    Reenviar código
                  </button>
                </form>
              ) : null}

              {recoveryStep === 'reset' ? (
                <form onSubmit={handlePasswordRecoveryConfirm}>
                  <div className="auth-field">
                    <label htmlFor="recovery-new-password" className="auth-label">
                      Nova senha <span className="auth-required">*</span>
                    </label>
                    <PasswordInput
                      id="recovery-new-password"
                      value={recoveryNewPassword}
                      onChange={(e) => setRecoveryNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      required
                    />
                    <p className="auth-helper">Use letras, números e símbolos para uma senha forte.</p>
                  </div>

                  <div className="auth-field">
                    <label htmlFor="recovery-confirm-password" className="auth-label">
                      Confirmar nova senha <span className="auth-required">*</span>
                    </label>
                    <PasswordInput
                      id="recovery-confirm-password"
                      value={recoveryConfirmPassword}
                      onChange={(e) => setRecoveryConfirmPassword(e.target.value)}
                      placeholder="Repita a senha"
                      required
                    />
                  </div>

                  <button type="submit" disabled={recoveryLoading} className="auth-button-primary">
                    <ShieldCheck size={20} />
                    Redefinir senha
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
}

