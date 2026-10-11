// Live updates for open browsers (Server-Sent Events). After every change the server sends
// "changed" and each page refetches /api/state, so a click in Slack shows up immediately.
import type { Request, Response } from 'express';

const clients = new Set<Response>();
/** goes up by one on every change; pages also poll it, in case the live stream is held up by a proxy or tunnel */
let version = Date.now();
export const currentVersion = () => version;

export function subscribe(req: Request, res: Response) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); clients.delete(res); });
}

export function broadcast(data: Record<string, unknown> = {}) {
  version++;
  const line = `event: changed\ndata: ${JSON.stringify({ at: Date.now(), v: version, ...data })}\n\n`;
  for (const c of clients) c.write(line);
}
