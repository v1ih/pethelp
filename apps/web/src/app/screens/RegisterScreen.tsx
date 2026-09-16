import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Building2, Mail, Phone, User } from 'lucide-react';
import { getDashboardRouteForUserType, type UserType } from '../context/shared';
import { useSession } from '../context/SessionContext';
import { PasswordInput } from '../components/ui/password-input';
import { AuthShell } from '../components/layout/AuthShell';

export default function RegisterScreen() {
  const navigate = useNavigate();
  const { register } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userType, setUserType] = useState<UserType>('owner');
  const [clinicName, setClinicName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [crmv, setCrmv] = useState('');
  const [crmvUf, setCrmvUf] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }

    setLoading(true);
    try {
      const resolvedUserType = await register({
        name: userType === 'clinic' ? undefined : name,
        email,
        password,
        userType,
        phone: phone.trim() || undefined,
        clinicName: userType === 'clinic' ? clinicName : undefined,
        tradeName: userType === 'clinic' ? clinicName : undefined,
        cnpj: userType === 'clinic' ? cnpj : undefined,
        crmv: userType === 'veterinarian' ? crmv : undefined,
        crmvUf: userType === 'veterinarian' ? crmvUf : undefined,
        specialty: userType === 'veterinarian' ? specialty : undefined,
      });

      navigate(getDashboardRouteForUserType(resolvedUserType), { replace: true });
    } catch (error) {
      console.error('Falha ao cadastrar:', error);
      setMessage({ type: 'error', text: 'Nao foi possivel criar a conta.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      activeTab="register"
      onTabChange={(tab) => {
        if (tab === 'login') navigate('/');
      }}
      role={userType}
      onRoleChange={setUserType}
    >
      <div style={{ display: 'grid', gap: 20 }}>
        {message ? <div className={`auth-message ${message.type === 'success' ? 'auth-message-success' : 'auth-message-error'}`}>{message.text}</div> : null}

        <form onSubmit={handleRegister} style={{ display: 'grid', gap: 16 }}>
          {userType !== 'clinic' ? (
            <div className="auth-field">
              <label htmlFor="name" className="auth-label">
                Nome completo <span className="auth-required">*</span>
              </label>
              <div className="auth-input-wrap">
                <User className="auth-icon" size={20} />
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="auth-input"
                  placeholder={userType === 'veterinarian' ? 'Dr. Ana Souza' : 'Ana Souza'}
                  required
                />
              </div>
            </div>
          ) : (
            <div className="auth-field">
              <label htmlFor="clinicName" className="auth-label">
                Nome da clínica <span className="auth-required">*</span>
              </label>
              <div className="auth-input-wrap">
                <Building2 className="auth-icon" size={20} />
                <input
                  type="text"
                  id="clinicName"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="auth-input"
                  placeholder="PetHelp Clínica"
                  required
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="phone" className="auth-label">
              Telefone <span className="auth-required">*</span>
            </label>
            <div className="auth-input-wrap">
              <Phone className="auth-icon" size={20} />
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="auth-input"
                placeholder="(11) 99999-9999"
                required
              />
            </div>
          </div>

          {userType === 'veterinarian' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 16 }}>
              <div className="auth-field">
                <label htmlFor="crmv" className="auth-label">
                  CRMV <span className="auth-required">*</span>
                </label>
                <input
                  type="text"
                  id="crmv"
                  value={crmv}
                  onChange={(e) => setCrmv(e.target.value)}
                  className="auth-input auth-input-no-icon"
                  placeholder="12345"
                  required
                />
              </div>

              <div className="auth-field">
                <label htmlFor="crmvUf" className="auth-label">
                  UF <span className="auth-required">*</span>
                </label>
                <input
                  type="text"
                  id="crmvUf"
                  value={crmvUf}
                  onChange={(e) => setCrmvUf(e.target.value.toUpperCase())}
                  className="auth-input auth-input-no-icon"
                  placeholder="SP"
                  maxLength={2}
                  required
                  style={{ textAlign: 'center' }}
                />
              </div>
            </div>
          ) : null}

          {userType === 'veterinarian' ? (
            <div className="auth-field">
              <label htmlFor="specialty" className="auth-label">
                Especialidade <span className="auth-required">*</span>
              </label>
              <input
                type="text"
                id="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="auth-input auth-input-no-icon"
                placeholder="Clínica geral, dermatologia, felinos"
                required
              />
            </div>
          ) : null}

          {userType === 'clinic' ? (
            <div className="auth-field">
              <label htmlFor="cnpj" className="auth-label">
                CNPJ
              </label>
              <input
                type="text"
                id="cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="auth-input auth-input-no-icon"
                placeholder="00.000.000/0000-00"
              />
            </div>
          ) : null}

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
          </div>

          <div className="auth-field">
            <label htmlFor="confirmPassword" className="auth-label">
              Confirmar senha <span className="auth-required">*</span>
            </label>
            <PasswordInput
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="auth-button-primary">
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p className="auth-footer">
          Já tem uma conta?{' '}
          <button type="button" onClick={() => navigate('/')} className="auth-link">
            Entrar
          </button>
        </p>
      </div>
    </AuthShell>
  );
}

