# PetHelp — Documentação do Sistema

Plataforma web para **gestão de saúde de animais de estimação**, conectando
**responsáveis pelo animal**, **clínicas** e **veterinários** em um só lugar:
cadastro de pets, prontuário, vacinas, exames, agendamento de consultas,
avaliações e compartilhamento seguro de dados.

---

## 1. Visão geral

- **Três perfis de usuário:** Responsável pelo animal, Clínica e Veterinário.
- **Objetivo:** centralizar o histórico de saúde do pet e facilitar a
  comunicação entre tutores e profissionais, com controle de acesso aos dados.
- **Acesso:** aplicação web (funciona em computador e celular), publicada com
  link público.

---

## 2. Arquitetura

Projeto organizado como **monorepo** (um repositório com o site e o servidor
separados):

```
pethelp/
├─ apps/web/          # Front-end (interface do usuário)
└─ services/backend/  # Back-end (API) + acesso ao banco
```

- **Front-end:** aplicação de página única (SPA) em React, servida como site
  estático.
- **Back-end:** API REST em Node/Express, executada como **função serverless**.
- **Banco de dados:** PostgreSQL.
- **Comunicação:** o site conversa com a API via HTTP (JSON), autenticando com
  token JWT.

---

## 3. Tecnologias utilizadas

### Front-end (`apps/web`)
| Tecnologia | Versão | Para que serve |
|---|---|---|
| React | 18.3 | Biblioteca de interface |
| TypeScript | 5.x | Tipagem estática |
| Vite | 6.3 | Empacotador/servidor de desenvolvimento |
| Tailwind CSS | 4.1 | Estilização por classes utilitárias |
| Radix UI + shadcn/ui | — | Componentes acessíveis (diálogos, menus, etc.) |
| lucide-react | 0.487 | Ícones |
| react-router | 7.x | Navegação entre telas |
| date-fns | 3.6 | Datas e calendário (locale pt-BR) |
| next-themes | 0.4 | Alternância de tema claro/escuro |
| sonner | 2.0 | Notificações "toast" na tela |
| recharts | 2.15 | Gráficos |
| react-hook-form | 7.x | Formulários |
| MUI, motion, embla, etc. | — | Componentes e animações auxiliares |

### Back-end (`services/backend`)
| Tecnologia | Versão | Para que serve |
|---|---|---|
| Node.js + Express | 5.1 | Servidor e rotas da API |
| TypeScript (ESM) | 5.8 | Linguagem |
| pg | 8.16 | Driver de PostgreSQL |
| bcryptjs | 2.4 | Hash de senhas |
| jsonwebtoken | 9.0 | Autenticação por token (JWT) |
| cors | 2.8 | Liberação de origem (CORS) |
| dotenv | 17 | Variáveis de ambiente |
| tsx | 4.x | Execução do TypeScript em desenvolvimento |

### Banco de dados
- **PostgreSQL** (em produção, **Neon** — Postgres gerenciado na nuvem).
- O schema é definido em código e **aplicado automaticamente na inicialização**
  (criação de tabelas e colunas de forma idempotente), o que facilita o deploy
  serverless.

### Infraestrutura e serviços
| Serviço | Uso |
|---|---|
| **Vercel** | Hospedagem do site (estático) e da API (serverless) + **Cron Jobs** |
| **Neon** | Banco de dados PostgreSQL na nuvem |
| **Brevo** | Envio de e-mails (plano gratuito, via API HTTP) |

---

## 4. Perfis de usuário

1. **Responsável pelo animal** — cadastra e cuida dos pets, agenda consultas,
   acompanha prontuário/vacinas/exames e libera dados via Vet-Pass.
2. **Clínica** — gerencia veterinários vinculados, agenda e histórico de
   atendimentos, e disponibiliza um código de conexão para os tutores.
3. **Veterinário** — atende pets liberados (por vínculo com clínica ou por
   Vet-Pass), consulta histórico e registra atendimentos.

---

## 5. Funcionalidades

### 5.1 Autenticação e conta
- Cadastro e login com **JWT (validade de 7 dias)** e senha protegida com
  **bcrypt**.
- **Validação de e-mail** por código no cadastro.
- **Recuperação de senha** por código enviado por e-mail.
- Login valida o **tipo de perfil** escolhido (não deixa entrar no perfil errado).
- Edição de perfil e **desativação/exclusão de conta** (com preservação do
  histórico de saúde).
- Mensagens de erro claras (e-mail já cadastrado, servidor fora do ar, etc.).

### 5.2 Pets
- **CRUD de pets** com foto, espécie, raça, idade, peso, alergias e condições.
- **Recorte da foto** (zoom e reposicionamento) no cadastro.
- Idade e peso como **campos numéricos** (unidade fixa).
- **Guarda compartilhada:** mais de um responsável pelo mesmo pet.
- **Transferência de titularidade** com confirmação de segurança.
- Exclusão do pet é **soft-delete** (preserva o histórico).

### 5.3 Saúde (prontuário, vacinas, exames)
- **Prontuário** clínico cronológico, com anexos.
- **Carteira de vacinação** com controle de vencimento (em dia/atrasada).
- **Exames/laudos** anexados ao prontuário.
- **Controle de acesso** aos dados: dono, responsáveis compartilhados, clínica
  vinculada, veterinário com vínculo aprovado ou portador de Vet-Pass válido.
- Prontuário e vacinas usam **soft-delete** (não há exclusão física de registros
  de saúde — atende ao requisito não funcional de preservação).

### 5.4 Vet-Pass (compartilhamento seguro)
- O responsável gera um **código temporário** que libera dados do pet a um
  veterinário.
- **Escopo por categoria:** o responsável escolhe liberar **Prontuário**,
  **Vacinas** e/ou **Exames**, e define a **validade (1 a 90 dias)**.
- O acesso do veterinário **respeita o escopo** (ex.: passe "só de vacinas" não
  abre o prontuário).
- O veterinário vê claramente **o que foi liberado**.

### 5.5 Agendamento
- **Visão de calendário** (estilo Google Agenda) e visão de lista.
- Agendamento com **clínica** ou **veterinário**.
- **Bloqueio de datas passadas.**
- **Horários guiados:** o sistema mostra apenas os **horários livres** do
  profissional (com base no expediente e nos horários já ocupados); dias sem
  expediente ficam indisponíveis.
- Verificação de **conflito de horário** e de **vínculo aprovado** no servidor.
- Botão de **WhatsApp** para contato com o veterinário.

### 5.6 Vínculos (clínica ⇄ veterinário ⇄ pet)
- Clínica possui um **código de conexão**.
- Veterinário solicita vínculo à clínica (**pendente/aprovado/recusado**).
- Responsável vincula o pet à clínica pelo código.

### 5.7 Avaliações
- Uma **avaliação por consulta concluída**, com edição/exclusão.
- **Média por veterinário/clínica**.

### 5.8 Notificações e lembretes
- Central de **notificações no app** (novas/anteriores), com **marcar como lida**
  e **excluir**.
- **Lembretes automáticos** (rodam 1x/dia via **Vercel Cron**):
  - vacinas vencendo (até 7 dias) ou atrasadas;
  - consultas dos próximos 2 dias.
- Os lembretes criam a notificação no app **e enviam e-mail** (Brevo), sem
  duplicar avisos.
- Suporte a **alertas do navegador** (push).

### 5.9 Configurações e privacidade
- Edição de dados do perfil; **máscaras** automáticas em telefone/CPF/CNPJ.
- Seção **"Permissões e privacidade"**: controle de lembretes por e-mail,
  notificações no app, compartilhamento via Vet-Pass e alertas do navegador.
- **Tema claro/escuro** (inicia no claro; respeita a escolha do usuário).
- Interface **100% em português**, usando o termo "responsável pelo animal".

---

## 6. Segurança e privacidade

- Senhas com **hash bcrypt** (nunca armazenadas em texto puro).
- Autenticação **JWT** com expiração.
- **Controle de acesso por recurso** (só quem tem relação com o pet acessa seus
  dados de saúde).
- **CORS** restrito às origens configuradas.
- **Soft-delete** de registros de saúde (preservação do histórico).
- Rota interna de lembretes protegida por **segredo (CRON_SECRET)**.
- Escopo granular no **Vet-Pass** (minimização de dados compartilhados).

---

## 7. Principais rotas da API

Base: `/api`

| Grupo | Exemplos |
|---|---|
| Autenticação | `POST /auth/register`, `POST /auth/login`, `POST /auth/password-recovery/request`, `POST /auth/password-recovery/confirm`, `POST /auth/verify-email`, `POST /auth/resend-verification` |
| Usuários | `GET /users/:id`, `PATCH /users/me`, `PATCH /users/clinic/me`, `PATCH /users/veterinarian/me`, `DELETE /users/me` |
| Pets | `GET /pets`, `POST /pets`, `GET/PATCH/DELETE /pets/:id`, `GET/POST/DELETE /pets/:id/guardians` |
| Agendamentos | `GET /appointments/me`, `GET /appointments/availability`, `POST /appointments`, `PATCH/DELETE /appointments/:id` |
| Prontuário | `GET /medical-records/pet/:petId`, `POST /medical-records/pet/:petId`, `PATCH/DELETE /medical-records/:id` |
| Vacinas | `GET /vaccines/pet/:petId`, `POST /vaccines/pet/:petId`, `PATCH/DELETE /vaccines/:id` |
| Vet-Pass | `POST /vet-passes`, `POST /vet-passes/:code/redeem`, `GET /vet-passes/:code`, `GET /vet-passes/me` |
| Vínculos | `/clinic-links/...` |
| Notificações | `GET /notifications/me`, `PATCH /notifications/:id/read`, `DELETE /notifications/:id` |
| Avaliações | `/reviews/...` |
| Lembretes (Cron) | `GET /internal/reminders/run` |
| Saúde do serviço | `GET /health` |

---

## 8. Banco de dados (principais tabelas)

`users`, `tutors`, `clinics`, `veterinarians`, `pets`, `pet_guardians`
(guarda compartilhada), `appointments`, `medical_records`, `vaccines`,
`clinic_veterinarians` (vínculos), `notifications`, `reviews`, `vet_passes`,
`email_codes` (códigos de verificação/recuperação), `referrals`.

Registros de saúde possuem `deleted_at` (soft-delete) e o Vet-Pass possui
colunas de escopo (`includes_medical_records`, `includes_vaccines`,
`includes_exams`) e validade (`expires_at`).

---

## 9. Como executar localmente

Pré-requisitos: Node.js e um PostgreSQL local.

```bash
# Back-end
cd services/backend
npm install
npm run dev        # inicia a API em http://localhost:3333

# Front-end (em outro terminal)
cd apps/web
npm install
npm run dev        # inicia o site em http://localhost:5173
```

Variáveis de ambiente do back-end (`.env`): conexão com o Postgres
(`DATABASE_URL` ou `POSTGRES_*`), `JWT_SECRET`, `CORS_ORIGINS` e, para e-mail,
`BREVO_API_KEY`, `MAIL_FROM`, `MAIL_FROM_NAME`. Para os lembretes automáticos:
`CRON_SECRET`.

---

## 10. Publicação (deploy)

- **Front-end** e **back-end** publicados na **Vercel** (projetos separados).
- Banco **PostgreSQL** na **Neon**.
- O site aponta para a API pela variável `VITE_API_URL`.
- **Vercel Cron** dispara os lembretes 1x/dia.
- Envio de e-mail pela **Brevo**.

---

## 11. Limitações conhecidas / trabalhos futuros

- **Exames** são armazenados como anexos do prontuário (não em tabela própria);
  suficiente para o uso atual, documentado como simplificação.
- Preferências de "Permissões" são salvas **por dispositivo** (localStorage).
- Nomenclatura interna do código usa `tutor`/`tutors` (a interface já usa
  "responsável pelo animal").
- Garantias de infraestrutura (backup automático, alta disponibilidade) dependem
  de configuração no provedor gerenciado.

---

*Documento gerado para fins de apresentação do TCC do PetHelp.*
