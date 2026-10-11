// Runs a change against the database: load → change in memory (engine.ts) → save → send
// messages → update Jira → tell browsers. Used by the app API, Slack, Teams/email links,
// the Jira webhook, the demo clock and the scheduler.
import type { Message, Routing } from '../../../shared/core.ts';
import { updateMeeting, loadWorld, upsertCommitments, insertMessage, setDelivery, getRouting, getMessage, getLiveTeams, slackMessageIdsFor, getSlackRef, type World } from '../db.ts';
import { Ctx, isRealJira } from './engine.ts';
import * as jira from '../integrations/jira.ts';
import { now } from './clock.ts';
import { slackMessage, teamsCard, emailMessage } from '../notify/render.ts';
import * as slack from '../integrations/slack.ts';
import * as teams from '../integrations/teams.ts';
import * as email from '../integrations/email.ts';
import { slackReady, teamsReady, emailReady } from '../config.ts';
import { broadcast } from '../events.ts';

export interface SlackOrigin { messageId: number; responseUrl: string }

// one change at a time, so two quick clicks can't overwrite each other's history
let chain: Promise<unknown> = Promise.resolve();
export function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

export async function newCtx(at?: string): Promise<Ctx> {
  const [w, n] = await Promise.all([loadWorld(), at ? Promise.resolve(at) : now()]);
  return new Ctx(w, n);
}

export async function flush(ctx: Ctx, base: string, origin?: SlackOrigin & { toast: string }) {
  const changed = ctx.w.commitments.filter(c => ctx.dirty.has(c.id));
  await upsertCommitments(changed);
  for (const [id, p] of ctx.meetingPatch) await updateMeeting(id, p);
  const inserted: Message[] = [];
  for (const p of ctx.out) inserted.push(await insertMessage(p));
  // tell open pages right away (the change is saved); Slack, Teams, email and Jira calls below can take seconds
  broadcast({ flash: ctx.flash });
  const [routing, live] = await Promise.all([getRouting(), getLiveTeams()]);
  // Jira status follows the commitment: "Confirm + Jira" → In Progress; "Add to Jira" on its own → To Do;
  // free to start after the step before finished → In Progress; waiting on someone, not confirmed or
  // without an owner → To Do; done or dropped → Done (done by the close itself).
  // Only when the status or the Jira key changed in this step, so a status set by hand in Jira (for
  // example "In Review") is left alone until the commitment itself moves.
  for (const c of changed) {
    if (!isRealJira(c.trk) || c.trkClosed || c.trk === ctx.skipKey || c.status === 'PendingAccept') continue;
    if (ctx.before.get(c.id) === c.status + '|' + c.trk) continue;
    const cat = ctx.jiraWant.get(c.id) ?? (c.status === 'Confirmed' ? 'indeterminate' : ['Waiting', 'Suggested', 'Unclaimed'].includes(c.status) ? 'new' : null);
    if (!cat) continue;
    const key = c.trk;
    ctx.after.push(() => jira.setStatusCategory(key, cat).then(() => undefined));
  }
  // Jira updates run one after another (comments stay in order); messages go out at the same time
  const trackerJobs = (async () => { for (const job of ctx.after) await job().catch(e => console.error('[jira]', e.message)); })();
  await Promise.all([
    ...inserted.map(m => deliver(m, ctx.w, base, routing, live)),
    trackerJobs,
    origin ? refreshSlackOrigin(origin, ctx.w) : Promise.resolve(),
  ]);
  // keep Slack in step: messages already in Slack that show a commitment whose status, date, owner or
  // Jira key changed are redrawn, so their buttons always match what is true now
  const moved = changed.filter(c => ctx.before.get(c.id) !== c.status + '|' + c.trk || ctx.beforeDue.get(c.id) !== c.due + '|' + c.owner + '|' + c.pending).map(c => c.id);
  if (moved.length && slackReady()) await redrawSlack(moved, ctx, origin?.messageId, new Set(inserted.map(m => m.id))).catch(e => console.error('[slack redraw]', e.message));
  broadcast(); // again, now that Jira keys and delivery results are in
  return inserted;
}

/** sends one notification to the person, in the team's channel. In this demo every person's
 *  Slack messages go to one Slack account and emails to one inbox, each opening "Hey <name>".
 *  If the team's channel is not connected yet, it falls back to Slack, then email. */
export async function deliver(m: Message, w: World, base: string, routing: Routing, liveTeams: string[]) {
  const teamId = w.commitments.find(c => c.id === m.cids[0])?.teamId || '';
  if (!liveTeams.includes(teamId)) return setDelivery(m.id, 'Not sent: real messages are switched off for this team (Settings)', false);
  // the pre-read and the upcoming commitments go to the team's channel only (#release-sync), never to a DM or inbox
  if ((m.kind === 'recap' || m.kind === 'upcoming') && (!m.toName || m.toName === 'Team')) {
    if (!slackReady()) return setDelivery(m.id, 'Not posted: Slack is not connected (add SLACK_BOT_TOKEN)', false);
    if (!routing.meetingChannel) return setDelivery(m.id, 'Not posted: no team channel saved. Settings → Demo routing → Meeting chat Slack channel ID → Save routing', false);
    try {
      const { text, blocks } = slackMessage(m, w);
      const ref = await slack.postMessage(routing.meetingChannel, text, blocks);
      return await setDelivery(m.id, 'Posted in the team channel (Slack)', true, ref);
    } catch (e: any) {
      const msg = String(e.message || '');
      console.error('[deliver]', m.id, 'recap', msg);
      const why = /not_in_channel/.test(msg) ? 'the app is not in that channel. In the channel type /invite @Fireflies Commitments'
        : /channel_not_found/.test(msg) ? 'Slack cannot find that channel ID (check it, or /invite the app if the channel is private)'
        : /missing_scope/.test(msg) ? 'the Slack app needs the chat:write scope' : msg.slice(0, 140);
      return setDelivery(m.id, `Not posted: ${why}`, false);
    }
  }
  const can = {
    slack: slackReady() && !!routing.slackUserId,
    teams: teamsReady(),
    email: emailReady() && !!routing.email,
  };
  const order = [m.channel, ...(['slack', 'email', 'teams'] as const).filter(x => x !== m.channel)].filter(ch => can[ch]);
  if (!order.length) return setDelivery(m.id, 'Not sent: no channel connected yet (add Slack, Teams or email keys)', false);
  const errors: string[] = [];
  for (const ch of order) {
    const note = ch === m.channel ? '' : ` (${m.channel === 'teams' ? 'Teams' : m.channel === 'email' ? 'email' : 'Slack'} not connected)`;
    try {
      if (ch === 'slack') {
        const { text, blocks } = slackMessage(m, w);
        const ref = await slack.postMessage(routing.slackUserId, text, blocks);
        return await setDelivery(m.id, 'Sent in Slack' + note, true, ref);
      }
      if (ch === 'teams') { await teams.postCard(teamsCard(m, w, base)); return await setDelivery(m.id, 'Posted in Teams' + note, true); }
      const e = emailMessage(m, w, base);
      await email.sendEmail(routing.email, e.subject, e.html);
      return await setDelivery(m.id, `Emailed to ${routing.email}` + note, true);
    } catch (e: any) {
      console.error('[deliver]', m.id, ch, e.message);
      errors.push(`${ch}: ${String(e.message).slice(0, 140)}`);
    }
  }
  await setDelivery(m.id, `Not sent: ${errors.join(' | ')}`, false);
}

async function redrawSlack(cids: string[], ctx: Ctx, skipId?: number, skipIds: Set<number> = new Set()) {
  const live = await getLiveTeams();
  const ids = (await slackMessageIdsFor(cids)).filter(id => id !== skipId && !skipIds.has(id));
  for (const id of ids) {
    const [m, ref] = await Promise.all([getMessage(id), getSlackRef(id)]);
    if (!m || !ref) continue;
    // a team with real messages switched off gets nothing in Slack, not even an update
    if (!live.includes(ctx.w.commitments.find(c => c.id === m.cids[0])?.teamId || '')) continue;
    const { text, blocks } = slackMessage(m, ctx.w, ctx.note || undefined);
    await slack.updateMessage(ref.channel, ref.ts, text, blocks).catch(e => console.error('[slack update]', id, e.message));
  }
}

/** after a Slack button: redraw the message it was clicked in, with the new state and a result line */
async function refreshSlackOrigin(o: SlackOrigin & { toast: string }, w: World) {
  const m = await getMessage(o.messageId);
  if (!m) return;
  const { text, blocks } = slackMessage(m, w, o.toast);
  await slack.respond(o.responseUrl, text, blocks).catch(e => console.error('[slack respond]', e.message));
}
