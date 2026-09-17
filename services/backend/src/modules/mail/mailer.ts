import { env } from '../../config/env.js';

export function isEmailConfigured() {
  return Boolean(env.mail.brevoApiKey && env.mail.from);
}

/**
 * Sends a transactional e-mail via the Brevo HTTP API (free tier, no SMTP socket
 * needed — works well on serverless). When e-mail is not configured, it logs the
 * content instead so the flow still works in development.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<{ sent: boolean }> {
  if (!isEmailConfigured()) {
    console.log(`[mail] (não enviado — sem BREVO_API_KEY/MAIL_FROM) Para: ${to} | ${subject}`);
    return { sent: false };
  }

  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.mail.brevoApiKey as string,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: env.mail.from, name: env.mail.fromName },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error('[mail] falha ao enviar via Brevo:', resp.status, text);
      return { sent: false };
    }

    return { sent: true };
  } catch (error) {
    console.error('[mail] erro ao enviar e-mail:', error);
    return { sent: false };
  }
}

/** Simple, friendly HTML wrapper for a code-based e-mail. */
export function codeEmailTemplate(title: string, intro: string, code: string, note: string) {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1b2320;">
    <div style="background: #1f7a63; color: #fff; padding: 20px 24px; border-radius: 16px 16px 0 0;">
      <h1 style="margin: 0; font-size: 20px;">🐾 PetHelp</h1>
    </div>
    <div style="border: 1px solid #e5e1d6; border-top: none; border-radius: 0 0 16px 16px; padding: 24px;">
      <h2 style="margin: 0 0 12px; font-size: 18px;">${title}</h2>
      <p style="margin: 0 0 16px; color: #5f6a64;">${intro}</p>
      <div style="font-size: 30px; font-weight: 700; letter-spacing: 6px; text-align: center; background: #e4f0eb; color: #155e4b; padding: 16px; border-radius: 12px;">${code}</div>
      <p style="margin: 16px 0 0; font-size: 13px; color: #5f6a64;">${note}</p>
    </div>
  </div>`;
}
