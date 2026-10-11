// Slack Web API (bot token) and request signing for the interactivity endpoint.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.ts';

async function api(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${config.slackApiUrl}/${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.slackBotToken}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const j: any = await res.json();
  if (!j.ok) throw new Error(`Slack ${method}: ${j.error}${j.response_metadata?.messages ? ' ' + j.response_metadata.messages.join('; ') : ''}`);
  return j;
}

/** posts to a user ID (lands in the app's DM with that person) or a channel ID */
export async function postMessage(channel: string, text: string, blocks: unknown[]) {
  const j = await api('chat.postMessage', { channel, text, blocks, unfurl_links: false, unfurl_media: false });
  return { channel: j.channel as string, ts: j.ts as string };
}
export async function updateMessage(channel: string, ts: string, text: string, blocks: unknown[]) {
  await api('chat.update', { channel, ts, text, blocks });
}
/** replace the message a button was clicked in, via the response_url Slack gives us */
export async function respond(responseUrl: string, text: string, blocks: unknown[]) {
  const res = await fetch(responseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ replace_original: true, text, blocks }), signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Slack response_url ${res.status}`);
}
export async function authTest(): Promise<string> {
  const j = await api('auth.test', {});
  return `${j.user} in ${j.team}`;
}

/** https://api.slack.com/authentication/verifying-requests-from-slack */
export function verifySignature(rawBody: string, timestamp: string | undefined, signature: string | undefined): boolean {
  if (!config.slackSigningSecret || !timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) return false;
  const mine = 'v0=' + createHmac('sha256', config.slackSigningSecret).update(`v0:${timestamp}:${rawBody}`).digest('hex');
  const a = Buffer.from(mine), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
