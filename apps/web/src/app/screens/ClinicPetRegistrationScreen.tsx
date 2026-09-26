import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, ClipboardCheck, Copy, Mail, PawPrint, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ClinicShell } from '../components/layout/ClinicShell';
import { getApiBase, getAuthHeaders } from '../context/shared';
import { maskCPF, maskPhone } from '../utils/masks';

type RegistrationResult = {
  petId: string;
  petName: string;
  tutor: {
    id: string;
    userId: string;
    name: string;
    email: string;
    isNewAccount: boolean;
  };
  vetPass: {
    code: string;
    expiresAt: string;
  };
  summaryEmailSent: boolean;
  inviteEmailSent: boolean;
  emailConfigured: boolean;
  accessCode?: string;
};

const inputClass =
  'w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-base text-foreground outline-none transition-colors focus:border-primary';

export default function ClinicPetRegistrationScreen() {
  const navigate = useNavigate();
  const API_BASE = getApiBase();

  const [tutorName, setTutorName] = useState('');
  const [tutorEmail, setTutorEmail] = useState('');
  const [tutorPhone, setTutorPhone] = useState('');
  const [tutorCpf, setTutorCpf] = useState('');

  const [petName, setPetName] = useState('');
  const [speciesMode, setSpeciesMode] = useState('');
  const [species, setSpecies] = useState('');
  const [sex, setSex] = useState('');
  const [neutered, setNeutered] = useState('');
  const [age, setAge] = useState('');
  const [breed, setBreed] = useState('');
  const [weight, setWeight] = useState('');
  const [allergiesStr, setAllergiesStr] = useState('');
  const [conditionsStr, setConditionsStr] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const resetForm = () => {
    setTutorName('');
    setTutorEmail('');
    setTutorPhone('');
    setTutorCpf('');
    setPetName('');
    setSpeciesMode('');
    setSpecies('');
    setSex('');
    setNeutered('');
    setAge('');
    setBreed('');
    setWeight('');
    setAllergiesStr('');
    setConditionsStr('');
    setResult(null);
    setCodeCopied(false);
  };

  const handleCopyCode = async () => {
    const code = result?.accessCode;
    if (!code) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 2000);
    } catch (error) {
      console.error('Falha ao copiar código de acesso:', error);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    const trimmedAge = age.trim().replace(',', '.');
    const trimmedWeight = weight.trim().replace(',', '.');

    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/clinic-registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          tutor: {
            name: tutorName.trim(),
            email: tutorEmail.trim(),
            phone: tutorPhone.trim() || null,
            cpf: tutorCpf.trim() || null,
          },
          pet: {
            name: petName.trim(),
            species: species.trim(),
            sex: sex || null,
            neutered: neutered === 'sim' ? true : neutered === 'nao' ? false : null,
            age: trimmedAge ? `${trimmedAge} ${trimmedAge === '1' ? 'ano' : 'anos'}` : null,
            breed: breed.trim() || null,
            weight: trimmedWeight ? `${trimmedWeight} kg` : null,
            allergies: allergiesStr
              ? allergiesStr.split(',').map((item) => item.trim()).filter(Boolean)
              : null,
            conditions: conditionsStr
              ? conditionsStr.split(',').map((item) => item.trim()).filter(Boolean)
              : null,
          },
        }),
      });

      const payload = await resp.json().catch(() => null);

      if (!resp.ok) {
        throw new Error(payload?.message ?? 'Não foi possível concluir o cadastro.');
      }

      setResult(payload.data as RegistrationResult);
      toast.success('Cadastro concluído e informações enviadas ao responsável.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <ClinicShell
        active="registration"
        title="Cadastro enviado ao responsável"
        description="O pet já está vinculado à clínica e o responsável recebeu as informações."
      >
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="rounded-[28px] border border-primary/30 bg-primary/5 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <ClipboardCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-base font-medium text-foreground">
                  {result.petName} cadastrado para {result.tutor.name}
                </p>
                <p className="mt-1 break-words text-sm text-muted-foreground">{result.tutor.email}</p>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Notificação criada no app do responsável.
              </li>
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {result.summaryEmailSent
                  ? 'Resumo dos dados e aviso do compartilhamento enviados por e-mail.'
                  : 'E-mail não configurado no servidor: repasse as informações ao responsável.'}
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Vet-Pass <strong className="font-mono">{result.vetPass.code}</strong> criado: a clínica acompanha
                prontuário, vacinas e exames até{' '}
                {new Date(result.vetPass.expiresAt).toLocaleDateString('pt-BR')}. O responsável vê esse
                compartilhamento em "Compartilhamentos" e pode encerrá-lo quando quiser.
              </li>
              {result.tutor.isNewAccount ? (
                <li className="flex items-start gap-2">
                  <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {result.inviteEmailSent
                    ? 'Acesso criado e código de senha enviado por e-mail (válido por 7 dias).'
                    : 'Acesso criado. Passe o código abaixo para o responsável definir a senha.'}
                </li>
              ) : (
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  O responsável já tinha conta no PetHelp: basta entrar para ver o pet.
                </li>
              )}
            </ul>
          </div>

          {result.accessCode ? (
            <div className="rounded-[28px] border border-dashed border-border bg-card p-5 sm:p-6">
              <p className="text-sm font-medium text-foreground">Código de primeiro acesso</p>
              <p className="mt-1 text-sm text-muted-foreground">
                O responsável usa este código em <strong>Esqueci minha senha</strong>, na tela de login, para criar a senha.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="rounded-[20px] border border-border bg-background px-4 py-3 text-center font-mono text-xl tracking-[0.3em] text-foreground">
                  {result.accessCode}
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyCode()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[18px] bg-primary px-4 py-3 text-white transition-colors hover:bg-primary/90"
                >
                  <Copy className="h-4 w-4" />
                  {codeCopied ? 'Copiado' : 'Copiar código'}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 sm:w-auto"
            >
              <PawPrint className="h-5 w-5" />
              Cadastrar outro pet
            </button>
            <button
              type="button"
              onClick={() => navigate('/clinic-pets')}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-[18px] border border-border bg-card px-5 py-3 text-foreground transition-colors hover:bg-muted sm:w-auto"
            >
              Ver pets cadastrados
            </button>
          </div>
        </div>
      </ClinicShell>
    );
  }

  return (
    <ClinicShell
      active="registration"
      title="Cadastrar pet e responsável"
      description="A clínica preenche os dados no atendimento e o PetHelp entrega tudo ao responsável: e-mail com o resumo, notificação no app e, se ele ainda não tiver conta, um acesso já criado."
    >
      <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
        <p className="rounded-[18px] border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Obrigatórios: <span className="text-foreground">nome e e-mail do responsável</span> e{' '}
          <span className="text-foreground">nome e espécie do pet</span>. O responsável pode completar o resto depois.
        </p>

        <section className="rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-6">
          <h2 className="text-lg font-medium text-foreground">Responsável pelo animal</h2>
          <div className="mt-4 grid gap-4">
            <div>
              <label htmlFor="tutorName" className="mb-2 block text-foreground">
                Nome completo <span className="text-destructive">*</span>
              </label>
              <input
                id="tutorName"
                type="text"
                value={tutorName}
                onChange={(event) => setTutorName(event.target.value)}
                className={inputClass}
                placeholder="Ana Souza"
                autoComplete="off"
                required
              />
            </div>

            <div>
              <label htmlFor="tutorEmail" className="mb-2 block text-foreground">
                E-mail <span className="text-destructive">*</span>
              </label>
              <input
                id="tutorEmail"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                value={tutorEmail}
                onChange={(event) => setTutorEmail(event.target.value)}
                className={inputClass}
                placeholder="ana@email.com"
                required
              />
              <p className="mt-2 text-sm text-muted-foreground">
                É por aqui que o responsável recebe os dados e o acesso ao app.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="tutorPhone" className="mb-2 block text-foreground">
                  Telefone
                </label>
                <input
                  id="tutorPhone"
                  type="tel"
                  inputMode="tel"
                  value={tutorPhone}
                  onChange={(event) => setTutorPhone(maskPhone(event.target.value))}
                  className={inputClass}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <label htmlFor="tutorCpf" className="mb-2 block text-foreground">
                  CPF
                </label>
                <input
                  id="tutorCpf"
                  type="text"
                  inputMode="numeric"
                  value={tutorCpf}
                  onChange={(event) => setTutorCpf(maskCPF(event.target.value))}
                  className={inputClass}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-6">
          <h2 className="text-lg font-medium text-foreground">Dados do pet</h2>
          <div className="mt-4 grid gap-4">
            <div>
              <label htmlFor="clinicPetName" className="mb-2 block text-foreground">
                Nome do pet <span className="text-destructive">*</span>
              </label>
              <input
                id="clinicPetName"
                type="text"
                value={petName}
                onChange={(event) => setPetName(event.target.value)}
                className={inputClass}
                placeholder="Max"
                required
              />
            </div>

            <div>
              <label htmlFor="clinicPetSpecies" className="mb-2 block text-foreground">
                Espécie <span className="text-destructive">*</span>
              </label>
              <select
                id="clinicPetSpecies"
                value={speciesMode}
                onChange={(event) => {
                  const value = event.target.value;
                  setSpeciesMode(value);
                  setSpecies(value === 'Outro' ? '' : value);
                }}
                className={inputClass}
                required
              >
                <option value="" disabled>
                  Selecione…
                </option>
                <option value="Cachorro">Cachorro</option>
                <option value="Gato">Gato</option>
                <option value="Outro">Outro</option>
              </select>
              {speciesMode === 'Outro' ? (
                <input
                  type="text"
                  aria-label="Qual espécie?"
                  value={species}
                  onChange={(event) => setSpecies(event.target.value)}
                  className={`mt-2 ${inputClass}`}
                  placeholder="Qual espécie?"
                  required
                />
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="clinicPetSex" className="mb-2 block text-foreground">
                  Sexo
                </label>
                <select id="clinicPetSex" value={sex} onChange={(event) => setSex(event.target.value)} className={inputClass}>
                  <option value="">Não informado</option>
                  <option value="Macho">Macho</option>
                  <option value="Fêmea">Fêmea</option>
                </select>
              </div>
              <div>
                <label htmlFor="clinicPetNeutered" className="mb-2 block text-foreground">
                  Castrado(a)
                </label>
                <select
                  id="clinicPetNeutered"
                  value={neutered}
                  onChange={(event) => setNeutered(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Não informado</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="clinicPetAge" className="mb-2 block text-foreground">
                  Idade (anos)
                </label>
                <div className="relative">
                  <input
                    id="clinicPetAge"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    className={`${inputClass} pr-14`}
                    placeholder="3"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    anos
                  </span>
                </div>
              </div>
              <div>
                <label htmlFor="clinicPetBreed" className="mb-2 block text-foreground">
                  Raça
                </label>
                <input
                  id="clinicPetBreed"
                  type="text"
                  value={breed}
                  onChange={(event) => setBreed(event.target.value)}
                  className={inputClass}
                  placeholder="Golden Retriever"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="clinicPetWeight" className="mb-2 block text-foreground">
                  Peso (kg)
                </label>
                <div className="relative">
                  <input
                    id="clinicPetWeight"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={weight}
                    onChange={(event) => setWeight(event.target.value)}
                    className={`${inputClass} pr-12`}
                    placeholder="25"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    kg
                  </span>
                </div>
              </div>
              <div>
                <label htmlFor="clinicPetAllergies" className="mb-2 block text-foreground">
                  Alergias
                </label>
                <input
                  id="clinicPetAllergies"
                  type="text"
                  value={allergiesStr}
                  onChange={(event) => setAllergiesStr(event.target.value)}
                  className={inputClass}
                  placeholder="ex: Amendoim, Poeira"
                />
              </div>
            </div>

            <div>
              <label htmlFor="clinicPetConditions" className="mb-2 block text-foreground">
                Condições
              </label>
              <input
                id="clinicPetConditions"
                type="text"
                value={conditionsStr}
                onChange={(event) => setConditionsStr(event.target.value)}
                className={inputClass}
                placeholder="ex: Diabetes, Artrite"
              />
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate('/clinic-dashboard')}
            disabled={loading}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-[18px] border border-border bg-background px-6 py-3 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-primary px-6 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <PawPrint className="h-5 w-5" />
            {loading ? 'Enviando...' : 'Cadastrar e avisar responsável'}
          </button>
        </div>
      </form>
    </ClinicShell>
  );
}
