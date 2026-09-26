import { useNavigate } from 'react-router';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

// Política de Privacidade exibida antes do cadastro. O texto descreve o que o PetHelp
// realmente coleta e com quem compartilha — se o produto mudar, esta página muda junto.

export const PRIVACY_POLICY_UPDATED_AT = '26 de setembro de 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-lg font-medium text-foreground">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--page-background)] px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <article className="mt-5 rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Política de Privacidade</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Última atualização: {PRIVACY_POLICY_UPDATED_AT}
              </p>
            </div>
          </div>

          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            Esta política explica quais dados o PetHelp coleta, por que coleta, com quem compartilha e o que você
            pode fazer a respeito. Ela segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </p>

          <Section title="1. Quem é responsável pelos dados">
            <p>
              O controlador dos dados é <strong className="text-foreground">[RAZÃO SOCIAL], CNPJ [NÚMERO]</strong>,
              responsável pelo PetHelp. Dúvidas, solicitações ou reclamações sobre dados pessoais podem ser enviadas
              para <strong className="text-foreground">[E-MAIL DE CONTATO]</strong>.
            </p>
          </Section>

          <Section title="2. Quais dados coletamos">
            <p>
              <strong className="text-foreground">Dados de cadastro:</strong> nome, e-mail, senha (guardada apenas de
              forma criptografada, nunca em texto puro), telefone e CPF quando você informa. Para clínicas, também
              razão social, nome fantasia, CNPJ e endereço; para veterinários, CRMV, UF e especialidade.
            </p>
            <p>
              <strong className="text-foreground">Dados do animal:</strong> nome, espécie, raça, sexo, castração,
              peso, data de nascimento, foto, alergias e condições de saúde.
            </p>
            <p>
              <strong className="text-foreground">Dados de saúde do animal:</strong> prontuário, vacinas (incluindo
              fotos da vacina ou da carteirinha que você anexa), exames e documentos enviados, consultas e
              avaliações. Esses dados são do animal, mas podem identificar você como responsável.
            </p>
            <p>
              <strong className="text-foreground">Dados de uso:</strong> registros técnicos necessários para operar e
              proteger o serviço, como data e hora de acesso e erros da aplicação.
            </p>
            <p>Não coletamos dados de geolocalização precisa nem usamos cookies de publicidade.</p>
          </Section>

          <Section title="3. Por que usamos esses dados">
            <p>
              Para criar e manter sua conta e autenticar o acesso; para manter o histórico de saúde do animal; para
              permitir agendamentos e o contato com clínicas e veterinários; para enviar avisos de vacinas próximas,
              lembretes de consulta, confirmação de e-mail e a mensagem de aniversário do pet; e para prevenir
              fraudes e uso indevido.
            </p>
            <p>
              As bases legais são a execução do contrato de uso do serviço, o cumprimento de obrigações legais, o
              legítimo interesse na segurança da plataforma e, quando aplicável, o seu consentimento — que você pode
              retirar a qualquer momento.
            </p>
          </Section>

          <Section title="4. Com quem compartilhamos">
            <p>
              <strong className="text-foreground">Clínicas e veterinários escolhidos por você.</strong> Ao vincular um
              pet a uma clínica ou gerar um Vet-Pass, você autoriza aquele estabelecimento ou profissional a ver os
              dados do animal dentro do escopo e do prazo definidos. Você acompanha esses acessos na tela
              Compartilhamentos e pode encerrá-los quando quiser.
            </p>
            <p>
              <strong className="text-foreground">Cadastro feito por clínica.</strong> Quando uma clínica cadastra seu
              pet, ela informa seu nome e e-mail para criar seu acesso, e você recebe um e-mail avisando exatamente o
              que foi cadastrado e qual compartilhamento foi criado.
            </p>
            <p>
              <strong className="text-foreground">Prestadores de serviço.</strong> Usamos fornecedores de hospedagem,
              banco de dados e envio de e-mail, que tratam os dados apenas para operar o PetHelp e sob nossas
              instruções.
            </p>
            <p>Não vendemos dados pessoais nem os compartilhamos para publicidade de terceiros.</p>
          </Section>

          <Section title="5. Por quanto tempo guardamos">
            <p>
              Os dados ficam guardados enquanto a conta existir. Registros de saúde do animal são preservados mesmo
              quando removidos da tela, porque compõem o histórico clínico e podem ser necessários ao próprio animal
              em atendimentos futuros. Se você excluir a conta, apagamos os dados pessoais, exceto o que a lei exigir
              manter.
            </p>
          </Section>

          <Section title="6. Seus direitos">
            <p>
              Você pode pedir confirmação de tratamento, acesso, correção, anonimização, portabilidade ou exclusão
              dos seus dados, além de informações sobre com quem foram compartilhados e a revogação do consentimento.
              Boa parte disso já está no app: editar cadastro e dados do pet, encerrar compartilhamentos, exportar a
              carteira de vacinação e excluir a conta nas Configurações. Para os demais pedidos, escreva para{' '}
              <strong className="text-foreground">[E-MAIL DE CONTATO]</strong>; respondemos em até 15 dias.
            </p>
          </Section>

          <Section title="7. Segurança">
            <p>
              As senhas são guardadas com hash e nunca em texto puro, o acesso à API exige autenticação por token, o
              tráfego é criptografado e cada perfil só enxerga os dados a que tem direito. Nenhum sistema é
              totalmente imune a incidentes; se ocorrer um que traga risco relevante a você, avisaremos você e a
              Autoridade Nacional de Proteção de Dados.
            </p>
          </Section>

          <Section title="8. Crianças e adolescentes">
            <p>O PetHelp é destinado a maiores de 18 anos. Não coletamos dados de menores de forma intencional.</p>
          </Section>

          <Section title="9. Mudanças nesta política">
            <p>
              Se esta política mudar de forma relevante, avisaremos no aplicativo ou por e-mail antes de a mudança
              passar a valer. A data no topo indica a versão vigente.
            </p>
          </Section>

          <div className="mt-8 rounded-[20px] border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">
            Os campos entre colchetes precisam ser preenchidos com os dados da empresa antes de publicar, e o texto
            deve passar por revisão jurídica.
          </div>
        </article>
      </div>
    </div>
  );
}
