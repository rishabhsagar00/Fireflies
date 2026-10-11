// Environment configuration. Every integration is optional: a message goes out on the
// first connected channel (team channel, then Slack, then email); see domain/service.ts.
// Email: Resend (RESEND_API_KEY) first, SMTP as the fallback.
// Placeholder values left in .env (e.g. "your-bot-token", "<paste here>") count as not set.
const env = (k: string) => {
  const v = (process.env[k] || '').trim();
  return /^<|your[-_ ]|^paste|^xxx|^change[-_]?me|placeholder/i.test(v) ? '' : v;
};

export const config = {
  port: Number(env('PORT') || 3000),
  databaseUrl: env('DATABASE_URL'),
  /** public https address of this app, e.g. https://commitments.yourdomain.com (used in Teams/email links) */
  publicUrl: env('PUBLIC_URL').replace(/\/$/, ''),
  /** team wall clock; all demo teams are in India */
  tzOffsetMinutes: Number(env('TZ_OFFSET_MINUTES') || 330),

  slackBotToken: env('SLACK_BOT_TOKEN'),
  slackApiUrl: env('SLACK_API_URL') || 'https://slack.com/api', // only changed for local tests
  slackSigningSecret: env('SLACK_SIGNING_SECRET'),
  teamsWebhookUrl: env('TEAMS_WEBHOOK_URL'),
  smtpHost: env('SMTP_HOST'),
  smtpPort: Number(env('SMTP_PORT') || 587),
  smtpSecure: env('SMTP_SECURE') ? env('SMTP_SECURE') === 'true' : Number(env('SMTP_PORT') || 587) === 465,
  smtpUser: env('SMTP_USER'),
  smtpPass: env('SMTP_PASS'),
  emailFrom: env('EMAIL_FROM') || (env('SMTP_USER') ? `Fireflies Commitments <${env('SMTP_USER')}>` : ''),
  /** 'smtp' or 'resend': which one to try first (default: Resend if its key is set) */
  emailProvider: (env('EMAIL_PROVIDER') || '').toLowerCase(),
  resendApiKey: env('RESEND_API_KEY'),
  /** a bare address becomes "Fireflies Commitments <address>"; without a verified domain use onboarding@resend.dev */
  resendFrom: (() => { const f = env('RESEND_FROM_EMAIL') || env('EMAIL_FROM') || 'onboarding@resend.dev'; return f.includes('<') ? f : `Fireflies Commitments <${f}>`; })(),

  jiraBaseUrl: env('JIRA_BASE_URL').replace(/\/$/, ''),
  jiraEmail: env('JIRA_EMAIL'),
  jiraApiToken: env('JIRA_API_TOKEN'),
  jiraProjectKey: env('JIRA_PROJECT_KEY'),
  jiraWebhookSecret: env('JIRA_WEBHOOK_SECRET'),

  /** demo routing defaults (can be changed on the Settings page) */
  demoSlackUserId: env('DEMO_SLACK_USER_ID'),
  demoEmail: env('DEMO_EMAIL'),
  /** reminders on a real schedule (hourly) and the Friday report; the demo clock button works either way */
  enableScheduler: env('ENABLE_SCHEDULER') !== 'false',
};

export const jiraReady = () => !!(config.jiraBaseUrl && config.jiraEmail && config.jiraApiToken && config.jiraProjectKey);
export const slackReady = () => !!config.slackBotToken;
export const teamsReady = () => /^https:\/\//.test(config.teamsWebhookUrl);
export const smtpReady = () => !!(config.smtpHost && config.smtpUser && config.smtpPass);
export const resendReady = () => /^re_/.test(config.resendApiKey);
export const emailReady = () => resendReady() || smtpReady();
