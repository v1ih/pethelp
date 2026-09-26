import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import type { AuthRequest } from '../../middlewares/auth.js';
import { findUserById } from '../users/users.service.js';
import { sendEmail } from '../mail/mailer.js';

/**
 * Recebe os relatos de problema enviados pelo botão de suporte do site e manda por
 * e-mail para quem cuida do PetHelp, junto com o contexto técnico (tela, navegador e
 * erros que apareceram no console) para não precisar ficar perguntando isso.
 */
const router = Router();

const MAX_MESSAGE_LENGTH = 4000;
const MAX_ERRORS = 5;

// Limite simples em memória: o endpoint é aberto (quem não consegue logar também
// precisa pedir ajuda), então evita virar porta de spam para a caixa de entrada.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const recentReports = new Map<string, number[]>();

function isRateLimited(key: string) {
  const now = Date.now();
  const hits = (recentReports.get(key) ?? []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  recentReports.set(key, hits);

  // Evita a Map crescer para sempre em processos de vida longa.
  if (recentReports.size > 500) {
    for (const [mapKey, times] of recentReports) {
      if (times.every((time) => now - time >= RATE_LIMIT_WINDOW_MS)) recentReports.delete(mapKey);
    }
  }

  return hits.length > RATE_LIMIT_MAX;
}

function asTrimmedString(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Identifica quem está logado, sem exigir login: quem não consegue entrar também relata. */
async function resolveOptionalUser(req: AuthRequest) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;

  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret) as { sub?: string };
    if (!payload.sub) return null;
    const user = await findUserById(payload.sub);
    return user ? { id: user.id, email: user.email, userType: user.user_type } : null;
  } catch {
    return null;
  }
}

function reportEmailTemplate(options: {
  message: string;
  pageUrl: string;
  userAgent: string;
  contactEmail: string;
  who: string;
  errors: string[];
  reportedAt: string;
}) {
  const errorBlock = options.errors.length
    ? `<div style="margin-top: 16px;">
         <p style="margin: 0 0 6px; font-size: 13px; color: #5f6a64;"><strong>Erros no navegador</strong></p>
         <pre style="margin: 0; padding: 12px; background: #f6f6f4; border-radius: 8px; font-size: 12px; white-space: pre-wrap; word-break: break-word;">${escapeHtml(
           options.errors.join('\n')
         )}</pre>
       </div>`
    : '';

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1b2320;">
    <div style="background: #b4462f; color: #fff; padding: 18px 22px; border-radius: 14px 14px 0 0;">
      <h1 style="margin: 0; font-size: 18px;">Relato de problema no PetHelp</h1>
    </div>
    <div style="border: 1px solid #e5e1d6; border-top: none; border-radius: 0 0 14px 14px; padding: 20px 22px;">
      <p style="margin: 0 0 6px; font-size: 13px; color: #5f6a64;"><strong>O que a pessoa relatou</strong></p>
      <p style="margin: 0 0 18px; white-space: pre-wrap;">${escapeHtml(options.message)}</p>

      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 5px 0; color: #5f6a64;">Quem</td><td style="padding: 5px 0;"><strong>${escapeHtml(
          options.who
        )}</strong></td></tr>
        <tr><td style="padding: 5px 0; color: #5f6a64;">Contato</td><td style="padding: 5px 0;"><strong>${escapeHtml(
          options.contactEmail || 'não informado'
        )}</strong></td></tr>
        <tr><td style="padding: 5px 0; color: #5f6a64;">Tela</td><td style="padding: 5px 0; word-break: break-all;">${escapeHtml(
          options.pageUrl || 'não informada'
        )}</td></tr>
        <tr><td style="padding: 5px 0; color: #5f6a64;">Quando</td><td style="padding: 5px 0;">${escapeHtml(
          options.reportedAt
        )}</td></tr>
        <tr><td style="padding: 5px 0; color: #5f6a64;">Navegador</td><td style="padding: 5px 0; word-break: break-all;">${escapeHtml(
          options.userAgent || 'não informado'
        )}</td></tr>
      </table>
      ${errorBlock}
    </div>
  </div>`;
}

router.post('/report', async (req: AuthRequest, res, next) => {
  try {
    const key = String(req.headers['x-forwarded-for'] ?? req.ip ?? 'desconhecido').split(',')[0].trim();
    if (isRateLimited(key)) {
      res.status(429).json({ message: 'Muitos relatos seguidos. Tente de novo em alguns minutos.' });
      return;
    }

    const body = req.body ?? {};
    const message = asTrimmedString(body.message, MAX_MESSAGE_LENGTH);
    if (message.length < 5) {
      res.status(400).json({ message: 'Descreva o que aconteceu para podermos ajudar.' });
      return;
    }

    const user = await resolveOptionalUser(req);
    const contactEmail = asTrimmedString(body.contactEmail, 180) || user?.email || '';
    const errors = Array.isArray(body.errors)
      ? body.errors.slice(0, MAX_ERRORS).map((item: unknown) => asTrimmedString(item, 600)).filter(Boolean)
      : [];

    const who = user
      ? `${user.email} (${user.userType})`
      : 'visitante não autenticado';

    const { sent } = await sendEmail(
      env.support.email,
      `[PetHelp] Problema relatado por ${who}`,
      reportEmailTemplate({
        message,
        pageUrl: asTrimmedString(body.pageUrl, 300),
        userAgent: asTrimmedString(req.headers['user-agent'], 300),
        contactEmail,
        who,
        errors,
        reportedAt: new Date().toLocaleString('pt-BR'),
      })
    );

    if (!sent) {
      // Sem e-mail configurado o relato não chega a lugar nenhum: é melhor a pessoa
      // saber e usar o WhatsApp do que achar que foi enviado.
      console.warn('[suporte] Relato recebido mas o e-mail não está configurado:', { who, message });
      res.status(503).json({ message: 'O envio por e-mail está indisponível. Use o WhatsApp do suporte.' });
      return;
    }

    res.status(201).json({ message: 'Relato enviado. Vamos responder no contato informado.' });
  } catch (error) {
    next(error);
  }
});

export default router;
