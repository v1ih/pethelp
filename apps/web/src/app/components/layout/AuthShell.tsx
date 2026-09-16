import * as React from 'react';
import { Building2, Heart, PawPrint, Stethoscope } from 'lucide-react';

export type AuthTab = 'login' | 'register';
export type AuthRole = 'owner' | 'veterinarian' | 'clinic';

type AuthShellProps = React.PropsWithChildren<{
  activeTab: AuthTab;
  onTabChange: (tab: AuthTab) => void;
  role: AuthRole;
  onRoleChange: (role: AuthRole) => void;
}>;

const AUTH_STYLES = `
  .auth-page {
    min-height: 100vh;
    padding: 38px 16px 30px;
    background: radial-gradient(circle at top left, rgba(127, 162, 106, 0.1), transparent 28%), radial-gradient(circle at top right, rgba(232, 209, 203, 0.18), transparent 25%), linear-gradient(180deg, #faf8f6 0%, #fefcfb 100%);
    color: #1a1a1a;
    font-family: 'DM Sans', system-ui, sans-serif;
  }

  .auth-shell {
    margin: 0 auto;
    width: 100%;
    max-width: 540px;
    min-height: calc(100vh - 68px);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .auth-brand {
    margin-bottom: 18px;
    text-align: center;
  }

  .auth-brand-row {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .auth-brand-mark {
    width: 50px;
    height: 50px;
    border-radius: 18px;
    background: #7fa26a;
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 16px 32px -20px rgba(127, 162, 106, 0.7);
  }

  .auth-brand-title {
    font-size: 22px;
    font-weight: 500;
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .auth-brand-subtitle {
    margin: 12px 0 0;
    font-size: 17px;
    line-height: 1.5;
    color: #6f6358;
  }

  .auth-card {
    width: 100%;
    border: 1px solid rgba(202, 194, 183, 0.75);
    border-radius: 28px;
    background: #ffffff;
    padding: 26px 28px 28px;
    box-shadow: 0 22px 60px -36px rgba(64, 52, 39, 0.18);
  }

  .auth-role-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .auth-role-button {
    appearance: none;
    border: 1px solid #ded8cf;
    background: #ffffff;
    border-radius: 20px;
    min-height: 70px;
    padding: 10px 10px;
    color: #6e6356;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: all 180ms ease;
  }

  .auth-role-button svg {
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
  }

  .auth-role-button:hover {
    border-color: rgba(127, 162, 106, 0.6);
  }

  .auth-role-button-active {
    border-color: #7fa26a;
    background: rgba(127, 162, 106, 0.12);
    color: #7fa26a;
    box-shadow: 0 10px 24px -18px rgba(127, 162, 106, 0.42);
  }

  .auth-tab-row {
    margin-top: 20px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-bottom: 1px solid rgba(221, 215, 208, 0.95);
  }

  .auth-tab-button {
    appearance: none;
    border: 0;
    background: transparent;
    padding: 0 0 12px;
    font-size: 17px;
    font-weight: 500;
    color: #7a6d61;
    cursor: pointer;
    position: relative;
  }

  .auth-tab-button-active {
    color: #7fa26a;
  }

  .auth-tab-button-active::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 2px;
    border-radius: 9999px;
    background: #7fa26a;
  }

  .auth-content {
    margin-top: 20px;
  }

  .auth-field {
    margin-bottom: 14px;
  }

  .auth-label {
    display: block;
    margin-bottom: 8px;
    font-size: 17px;
    line-height: 1.35;
    font-weight: 500;
    color: #1a1a1a;
  }

  .auth-required {
    color: #d93b31;
  }

  .auth-helper {
    margin-top: 7px;
    font-size: 14px;
    line-height: 1.5;
    color: #7b6f63;
  }

  .auth-input-wrap {
    position: relative;
  }

  .auth-input {
    box-sizing: border-box;
    width: 100%;
    min-height: 54px;
    border-radius: 18px;
    border: 1px solid #d8d1c6;
    background: #efe9de;
    color: #1a1a1a;
    padding: 14px 18px 14px 50px;
    font: inherit;
    font-size: 16px;
    line-height: 1.25;
    outline: none;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
    transition: all 180ms ease;
  }

  .auth-input::placeholder {
    color: #82766a;
  }

  .auth-input:focus {
    border-color: #7fa26a;
    background: #f4efe6;
    box-shadow: 0 0 0 4px rgba(127, 162, 106, 0.08);
  }

  .auth-input-no-icon {
    padding-left: 16px;
  }

  .auth-input-password {
    padding-left: 50px;
    padding-right: 52px;
  }

  .auth-input-center {
    text-align: center;
    letter-spacing: 0.5em;
    padding-left: 16px;
  }

  .auth-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    width: 18px;
    height: 18px;
    transform: translateY(-50%);
    color: #877a6d;
    pointer-events: none;
  }

  .auth-password-toggle {
    position: absolute;
    right: 16px;
    top: 50%;
    width: 18px;
    height: 18px;
    transform: translateY(-50%);
    border: 0;
    background: transparent;
    color: #877a6d;
    cursor: pointer;
    padding: 0;
    line-height: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .auth-button-primary {
    appearance: none;
    border: 0;
    width: 100%;
    min-height: 58px;
    border-radius: 18px;
    background: #7fa26a;
    color: #ffffff;
    font: inherit;
    font-size: 18px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 20px;
    line-height: 1;
    box-shadow: 0 18px 38px -18px rgba(127, 162, 106, 0.45);
    transition: all 180ms ease;
  }

  .auth-button-primary:hover {
    background: #769b60;
    box-shadow: 0 20px 42px -18px rgba(127, 162, 106, 0.52);
  }

  .auth-button-primary svg {
    display: block;
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
  }

  .auth-button-primary:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  .auth-link {
    border: 0;
    background: transparent;
    color: #7fa26a;
    font: inherit;
    cursor: pointer;
    padding: 0;
  }

  .auth-link:hover {
    text-decoration: underline;
  }

  .auth-text-link {
    border: 0;
    background: transparent;
    color: #7fa26a;
    font: inherit;
    cursor: pointer;
    padding: 0;
    text-decoration: none;
  }

  .auth-message {
    border-radius: 16px;
    border: 1px solid transparent;
    padding: 11px 15px;
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 14px;
  }

  .auth-message-success {
    border-color: #bfe7dd;
    background: #effaf7;
    color: #1f7c68;
  }

  .auth-message-error {
    border-color: #f3c0be;
    background: #fff1f0;
    color: #b33d36;
  }

  .auth-code-box {
    margin-bottom: 14px;
    border-radius: 18px;
    border: 1px solid rgba(127, 162, 106, 0.32);
    background: rgba(127, 162, 106, 0.08);
    padding: 13px 16px;
    color: #215f49;
  }

  .auth-code-label {
    font-size: 14px;
    line-height: 1.45;
  }

  .auth-code-value {
    margin-top: 4px;
    font-family: 'DM Mono', monospace;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.18em;
    word-break: break-all;
  }

  .auth-footer {
    margin-top: 16px;
    text-align: center;
    font-size: 15px;
    color: #6f6358;
  }

  .auth-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(2px);
  }

  .auth-modal {
    width: 100%;
    max-width: 520px;
    border-radius: 26px;
    border: 1px solid rgba(202, 194, 183, 0.75);
    background: #ffffff;
    padding: 26px 28px;
    box-shadow: 0 30px 80px -30px rgba(0, 0, 0, 0.4);
  }

  .auth-modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .auth-modal-title {
    margin: 0;
    font-size: 26px;
    line-height: 1.2;
    font-weight: 500;
    color: #1a1a1a;
  }

  .auth-modal-subtitle {
    margin: 5px 0 0;
    font-size: 15px;
    color: #7c7165;
  }

  .auth-modal-close {
    appearance: none;
    border: 0;
    background: transparent;
    color: #7b6f63;
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .auth-progress {
    margin-top: 18px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .auth-progress-step {
    height: 5px;
    border-radius: 9999px;
    background: #e8e0d6;
  }

  .auth-progress-step-active {
    background: #7fa26a;
  }

  .auth-progress-step-complete {
    background: #b8d8d2;
  }

  .auth-modal-body {
    margin-top: 24px;
  }
`;

const roleConfig: Record<AuthRole, { label: string; icon: React.ReactNode }> = {
  owner: { label: 'Responsável pelo animal', icon: <Heart size={20} /> },
  veterinarian: { label: 'Veterinário', icon: <Stethoscope size={20} /> },
  clinic: { label: 'Clínica', icon: <Building2 size={20} /> },
};

export function AuthShell({ activeTab, onTabChange, role, onRoleChange, children }: AuthShellProps) {
  return (
    <>
      <style>{AUTH_STYLES}</style>
      <div className="auth-page">
        <div className="auth-shell">
          <header className="auth-brand">
            <div className="auth-brand-row">
              <div className="auth-brand-mark">
                <PawPrint size={28} />
              </div>
              <h1 className="auth-brand-title">PetHelp</h1>
            </div>
            <p className="auth-brand-subtitle">Cuidado veterinário conectado</p>
          </header>

          <section className="auth-card">
            <div className="auth-role-grid">
              {(Object.keys(roleConfig) as AuthRole[]).map((key) => {
                const item = roleConfig[key];
                const active = role === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onRoleChange(key)}
                    className={`auth-role-button${active ? ' auth-role-button-active' : ''}`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="auth-tab-row">
              <button
                type="button"
                onClick={() => onTabChange('login')}
                className={`auth-tab-button${activeTab === 'login' ? ' auth-tab-button-active' : ''}`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => onTabChange('register')}
                className={`auth-tab-button${activeTab === 'register' ? ' auth-tab-button-active' : ''}`}
              >
                Cadastrar
              </button>
            </div>

            <div className="auth-content">{children}</div>
          </section>
        </div>
      </div>
    </>
  );
}

