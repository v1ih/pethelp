import dotenv from 'dotenv';

dotenv.config();

function toNumber(value: string | undefined, fallback: number) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function toBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

/** Extra origins allowed by CORS, comma-separated (e.g. the deployed frontend URL). */
function parseOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

// A single connection string (Render/Neon/Supabase style) takes priority over the
// individual POSTGRES_* variables used for local development.
const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;

// Managed Postgres providers require SSL. Enable it automatically when a
// DATABASE_URL is present, or when PGSSL/POSTGRES_SSL is explicitly set.
const useSsl = toBoolean(process.env.POSTGRES_SSL ?? process.env.PGSSL, Boolean(databaseUrl));

export const env = {
  port: toNumber(process.env.PORT, 3333),
  // Primary configured origin (kept for backwards compatibility) plus any extras.
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN),
  database: {
    url: databaseUrl,
    ssl: useSsl,
  },
  postgres: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: toNumber(process.env.POSTGRES_PORT, 5433),
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? '',
    database: process.env.POSTGRES_DATABASE ?? 'pethelp',
    adminDatabase: process.env.POSTGRES_ADMIN_DATABASE ?? 'postgres',
  },
  jwtSecret: process.env.JWT_SECRET ?? 'please-change-this-in-prod',
  // Endereço público do site, usado nos links enviados por e-mail (ex.: primeiro acesso).
  // Sem APP_URL, usa a primeira origem liberada no CORS.
  appUrl: (
    process.env.APP_URL?.trim() ||
    parseOrigins(process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN)[0] ||
    'http://localhost:5173'
  ).replace(/\/$/, ''),
  // Envio de e-mail via Brevo (plano gratuito). Se não configurado, o código é
  // apenas registrado no log (modo desenvolvimento).
  mail: {
    brevoApiKey: process.env.BREVO_API_KEY?.trim() || undefined,
    from: process.env.MAIL_FROM?.trim() || undefined,
    fromName: process.env.MAIL_FROM_NAME?.trim() || 'PetHelp',
  },
  // Segredo usado para proteger a rota de lembretes chamada pelo Vercel Cron.
  cronSecret: process.env.CRON_SECRET?.trim() || undefined,
} as const;
