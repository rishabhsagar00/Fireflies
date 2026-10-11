// The Fireflies app's own API (used by the frontend).
import { Router, type Request } from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { AppState } from '../../../shared/core.ts';
import { config, jiraReady, slackReady, teamsReady, emailReady } from '../config.ts';
import { loadWorld, loadMessages, getRouting, setSetting, getLiveTeams, updateTeam, getSetting, deliveredCardCids } from '../db.ts';
import { now, nextMorning } from '../domain/clock.ts';
import { act, ActError, runReminders, sendOpenCards, ACTIONS, type Action } from '../domain/engine.ts';
import { newCtx, flush, serial } from '../domain/service.ts';
import { resetDemo } from '../domain/seed.ts';
import { preRead, startMeeting, fredPosts, joins, endMeeting, dueFredPosts, FRED_DELAY_MIN } from '../domain/meetingRecap.ts';
import { getMessage } from '../db.ts';
import { importMeeting, validate } from '../domain/importMeeting.ts';
import { weeklyReport } from '../notify/render.ts';
import * as email from '../integrations/email.ts';
import * as slack from '../integrations/slack.ts';
import * as jira from '../integrations/jira.ts';
import { broadcast } from '../events.ts';
import { randomBytes } from 'node:crypto';

export const baseUrl = (req: Request) => config.publicUrl || `${req.protocol}://${req.get('host')}`;
const here = dirname(fileURLToPath(import.meta.url));
export const SAMPLE_MEETING = join(here, '../../../database/sample-meetings/release-in-5-days.json');

export async function jiraWebhookSecret(): Promise<string> {
  if (config.jiraWebhookSecret) return config.jiraWebhookSecret;
  let s = await getSetting<string>('jiraWebhookSecret', '');
  if (!s) { s = randomBytes(16).toString('hex'); await setSetting('jiraWebhookSecret', s); }
  return s;
}

export const api = Router();

api.get('/state', async (req, res) => {
  const [w, messages, n, routing, liveTeams, secret] = await Promise.all([loadWorld(), loadMessages(), now(), getRouting(), getLiveTeams(), jiraWebhookSecret()]);
  const base = baseUrl(req);
  const out: AppState = {
    now: n, ...w, messages, routing, liveTeams, baseUrl: base,
    integrations: { slack: slackReady(), slackInteractive: !!config.slackSigningSecret, teams: teamsReady(), email: emailReady(), jira: jiraReady(), jiraProjectKey: config.jiraProjectKey, jiraBaseUrl: config.jiraBaseUrl },
    jiraWebhookUrl: `${base}/api/jira/webhook?secret=${secret}`,
    slackInteractivityUrl: `${base}/api/slack/interactions`,
  };
  res.json(out);
});

api.post('/action', async (req, res) => {
  const { action, id, actor, extra = {}, src = 'app' } = req.body || {};
  if (!ACTIONS.includes(action)) return res.status(400).json({ error: 'Unknown action.' });
  if (typeof id !== 'string' || typeof actor !== 'string') return res.status(400).json({ error: 'Missing id or actor.' });
  try {
    const out = await serial(async () => {
      const ctx = await newCtx();
      const message = await act(ctx, action as Action, id, actor, { src: src === 'msg' ? 'msg' : 'app', to: extra.to, date: extra.date });
      ctx.note = `Updated in Fireflies: ${message}`;
      await flush(ctx, baseUrl(req));
      return { message, flash: ctx.flash };
    });
    res.json(out);
  } catch (e: any) {
    res.status(e instanceof ActError ? 409 : 500).json({ error: e.message });
  }
});

api.post('/clock/next-morning', async (req, res) => {
  try {
    const out = await serial(async () => {
      const t = await nextMorning();
      const ctx = await newCtx(t);
      const count = runReminders(ctx);
      await flush(ctx, baseUrl(req));
      return { now: t, count, sent: ctx.out.length };
    });
    res.json(out);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

api.post('/demo/reset', async (req, res) => {
  try {
    const t = await serial(async () => {
      const t = await resetDemo();
      // the first messages: every owner in a team with real messages on gets their card again
      const ctx = await newCtx(t);
      sendOpenCards(ctx, await getLiveTeams());
      await flush(ctx, baseUrl(req));
      return t;
    });
    broadcast(); res.json({ now: t });
  }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

api.get('/sample-meeting', (_req, res) => {
  res.type('application/json').send(readFileSync(SAMPLE_MEETING, 'utf8'));
});

api.post('/meetings/import', async (req, res) => {
  try {
    const f = validate(req.body?.meeting);
    const out = await serial(async () => {
      const ctx = await newCtx();
      const r = await importMeeting(ctx, f);
      await flush(ctx, baseUrl(req));
      return r;
    });
    res.json(out);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

/* the next meeting of a series (demo stand-in for the calendar and the call):
   pre = 30 minutes before (pre-read in the channel), start, post = Fred posts now (skip the 2-minute
   wait), join = someone joins the call, end = the meeting ends (Fireflies' summary comes in).
   Manager only: "actor" is the person signed in to the demo (the "Signed in as" picker). */
const isManagerOf = (w: { teams: { id: string; manager: string }[] }, teamId: string, actor: unknown) => !!actor && w.teams.find(t => t.id === teamId)?.manager === actor;
const fredTimers = new Map<string, NodeJS.Timeout>();
function scheduleFred(meetingId: string, base: string) {
  clearTimeout(fredTimers.get(meetingId));
  fredTimers.set(meetingId, setTimeout(() => {
    fredTimers.delete(meetingId);
    serial(async () => { const ctx = await newCtx(); if (dueFredPosts(ctx)) await flush(ctx, base); }).catch(e => console.error('[fred]', e));
  }, FRED_DELAY_MIN * 60000 + 2000));
}
api.post('/meetings/:id/live', async (req, res) => {
  const what = String(req.body?.do || ''), person = String(req.body?.person || '');
  if (!['pre', 'start', 'post', 'join', 'end'].includes(what)) return res.status(400).json({ error: 'Unknown step.' });
  try {
    const out = await serial(async () => {
      const ctx = await newCtx();
      const m = ctx.w.meetings.find(x => x.id === req.params.id); if (!m) throw new Error('No such meeting.');
      if (!isManagerOf(ctx.w, m.teamId, req.body?.actor)) throw new Error('Only the team manager can run this demo step.');
      let message = '', meetingId = '';
      if (what === 'pre') {
        const r = await preRead(ctx, m);
        message = `Pre-read posted: ${r.done} completed, ${r.remaining} remaining, ${r.need} need an owner.` + (r.need ? ` You got a card to assign ${r.need === 1 ? 'it' : 'them'}.` : '') + (r.jira.length ? ` No-owner items added to Jira: ${r.jira.join(', ')}.` : '');
      } else if (what === 'start') {
        startMeeting(ctx, m); scheduleFred(m.id, baseUrl(req));
        message = `Meeting started. Fred posts the status in the meeting chat in ${FRED_DELAY_MIN} minutes.`;
      } else if (what === 'post') {
        if (!m.live?.startAt || m.live.endedAt) throw new Error('Start the meeting first.');
        message = fredPosts(ctx, m) ? 'Fred posted the status in the meeting chat.' : 'Fred already posted.';
      } else if (what === 'join') {
        if (!ctx.members(m.teamId).includes(person)) throw new Error('Choose who joins.');
        const r = joins(ctx, m, person);
        message = r === 'reposted' ? `${person.split(' ')[0]} joined, so Fred posted the status in the chat again.` : r === 'already' ? `${person.split(' ')[0]} is already in the call.` : `${person.split(' ')[0]} joined.`;
      } else {
        const r = await endMeeting(ctx, m); meetingId = r.meetingId;
        message = `Meeting ended. ${r.count} new commitments: upcoming list posted in the channel, ${r.owners} ${r.owners === 1 ? 'person' : 'people'} got a card to confirm.`;
      }
      const sent = await flush(ctx, baseUrl(req));
      // say what really happened to the channel post (posted, or why not)
      const ch = sent.find(x => (x.kind === 'recap' || x.kind === 'upcoming') && x.toName === 'Team');
      const got = ch ? await getMessage(ch.id) : null;
      if (got && !got.delivered) message += ` The channel post was ${got.delivery.replace(/^Not posted: /, 'not posted: ')}`;
      return { message, meetingId };
    });
    res.json(out);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

api.post('/teams/:id', async (req, res) => {
  const { channel, tracker } = req.body || {};
  if (channel && !['slack', 'teams', 'email'].includes(channel)) return res.status(400).json({ error: 'Bad channel' });
  if (tracker && !['jira', 'asana', 'none'].includes(tracker)) return res.status(400).json({ error: 'Bad tracker' });
  await updateTeam(req.params.id, { channel, tracker });
  broadcast(); res.json({ ok: true });
});

api.post('/settings', async (req, res) => {
  const { routing, liveTeams } = req.body || {};
  if (routing) {
    const slackUserId = String(routing.slackUserId || '').trim(), mail = String(routing.email || '').trim();
    // accept the ID, "#"-less or pasted as a Slack link (…/archives/C0123ABCD)
    const rawChan = String(routing.meetingChannel || '').trim();
    const meetingChannel = (rawChan.match(/\b([CG][A-Z0-9]{6,})\b/i)?.[1] || rawChan).toUpperCase();
    if (meetingChannel && !/^[CG][A-Z0-9]{6,}$/.test(meetingChannel)) return res.status(400).json({ error: 'A Slack channel ID looks like C0123ABCD. In Slack: open the channel → its name at the top → the ID is at the bottom of the About tab.' });
    if (slackUserId && !/^[UW][A-Z0-9]{6,}$/.test(slackUserId)) return res.status(400).json({ error: 'A Slack member ID looks like U0123ABCD. In Slack: your profile → ⋯ → Copy member ID.' });
    if (mail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return res.status(400).json({ error: 'That email address does not look right.' });
    await setSetting('routing', { slackUserId, email: mail, meetingChannel });
  }
  if (Array.isArray(liveTeams)) {
    const before = await getLiveTeams();
    const next = liveTeams.filter((x: unknown) => typeof x === 'string') as string[];
    await setSetting('liveTeams', next);
    // a team just switched on: its people get their first cards now (once; never a second copy)
    const added = next.filter(t => !before.includes(t));
    if (added.length) await serial(async () => {
      const ctx = await newCtx();
      sendOpenCards(ctx, added, await deliveredCardCids());
      await flush(ctx, baseUrl(req));
    });
  }
  broadcast(); res.json({ ok: true });
});

api.post('/integrations/test', async (_req, res) => {
  const out: Record<string, string> = {};
  out.slack = slackReady() ? await slack.authTest().then(x => `Connected as ${x}`, e => e.message) : 'Not connected';
  out.jira = jiraReady() ? await jira.whoAmI().then(x => `Connected as ${x}`, e => e.message) : 'Not connected';
  out.teams = teamsReady() ? 'Webhook URL set' : 'Not connected';
  out.email = emailReady() ? await email.verify().catch(e => `SMTP error: ${e.message}`) : 'Not connected';
  res.json(out);
});

api.get('/report/:teamId', async (req, res) => {
  const w = await loadWorld(); const team = w.teams.find(t => t.id === req.params.teamId);
  if (!team) return res.status(404).send('No such team');
  res.type('html').send(weeklyReport(team, w, (await now()).slice(0, 10)).html);
});

api.post('/report/:teamId/send', async (req, res) => {
  const w = await loadWorld(); const team = w.teams.find(t => t.id === req.params.teamId);
  if (!team) return res.status(404).json({ error: 'No such team' });
  const routing = await getRouting();
  if (!emailReady()) return res.status(400).json({ error: 'Email is not connected (RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS).' });
  if (!routing.email) return res.status(400).json({ error: 'Add the demo inbox in Settings first.' });
  const r = weeklyReport(team, w, (await now()).slice(0, 10));
  try { await email.sendEmail(routing.email, `[Demo: for all members] ${r.subject}`, r.html); res.json({ message: `Report emailed to ${routing.email}.` }); }
  catch (e: any) { res.status(502).json({ error: e.message }); }
});
