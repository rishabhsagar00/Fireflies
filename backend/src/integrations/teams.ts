// Microsoft Teams: post an Adaptive Card to a channel through a Workflows
// ("Post to a channel when a webhook request is received") or incoming-webhook URL.
import { config } from '../config.ts';

export async function postCard(card: unknown) {
  const res = await fetch(config.teamsWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'message', attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', contentUrl: null, content: card }] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok && res.status !== 202) throw new Error(`Teams webhook ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
