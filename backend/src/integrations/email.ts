// Email: Resend's HTTP API when RESEND_API_KEY is set, SMTP (Nodemailer) otherwise.
// If both are set and the first one fails, the same email is tried over the other.
// EMAIL_PROVIDER=smtp makes SMTP the first choice (e.g. a Gmail app password, no domain needed).
import nodemailer, { type Transporter } from 'nodemailer';
import { config, resendReady, smtpReady } from '../config.ts';

let transporter: Transporter | null = null;
const mailer = () => transporter ??= nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpSecure,          // true for port 465, false for 587 (STARTTLS)
  auth: { user: config.smtpUser, pass: config.smtpPass },
});

async function viaResend(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.resendFrom, to: [to], subject, html }),
    signal: AbortSignal.timeout(15000),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${j.message || j.name || 'send failed'}`);
  return j.id as string;
}
async function viaSmtp(to: string, subject: string, html: string) {
  const info = await mailer().sendMail({ from: config.emailFrom, to, subject, html });
  return info.messageId as string;
}

export async function sendEmail(to: string, subject: string, html: string) {
  // EMAIL_PROVIDER=smtp: SMTP first, Resend only as the fallback
  if (config.emailProvider === 'smtp' && smtpReady()) {
    try { return await viaSmtp(to, subject, html); }
    catch (e: any) { if (!resendReady()) throw e; console.error('[email] SMTP failed, trying Resend:', e.message); return viaResend(to, subject, html); }
  }
  if (resendReady()) {
    try { return await viaResend(to, subject, html); }
    catch (e: any) { if (!smtpReady()) throw e; console.error('[email] Resend failed, trying SMTP:', e.message); }
  }
  return viaSmtp(to, subject, html);
}

/** used by Settings → Test connections */
export async function verify(): Promise<string> {
  const out: string[] = [];
  if (resendReady() && config.emailProvider !== 'smtp') {
    const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${config.resendApiKey}` } });
    const body = r.ok ? '' : await r.text();
    out.push(r.ok || /restricted/i.test(body) ? `Resend key OK (from ${config.resendFrom})` : `Resend key rejected (${r.status})`);
  }
  if (smtpReady()) out.push(await mailer().verify().then(() => `SMTP login OK (${config.smtpUser})`, (e: any) => `SMTP error: ${e.message}`));
  return out.join(' · ') || 'Not connected';
}
