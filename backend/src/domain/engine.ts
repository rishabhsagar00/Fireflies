// The commitment state machine. Every button (Fireflies app, Slack, Teams, email) and every
// Jira "Done" ends up in act(); every reminder comes from runReminders(). Both work on an
// in-memory copy of the team data (a Ctx) and then flush(): save the changed rows, send the
// messages, update Jira, and tell open browsers to refresh.
import {
  type Commitment, type Channel, type MessageKind, type MessageExtra, type Team, type Status,
  CH, addDays, chName, daysBetween, firstName, fmtD, hoursBetween, isDate, isOpen, workday, workingDaysBetween,
} from '../../../shared/core.ts';
import { type World, nextCounter } from '../db.ts';
import * as jira from '../integrations/jira.ts';
import { jiraReady, config } from '../config.ts';
import { randomBytes } from 'node:crypto';

export type Source = 'app' | 'msg' | 'slack' | 'teams' | 'email' | 'jira' | 'system';
export interface ActExtra { src: Source; to?: string; date?: string }
export interface PendingMessage { toName: string; kind: MessageKind; cids: string[]; at: string; meetingId: string; extra: MessageExtra; channel: Channel }

export class ActError extends Error {}
export const newToken = () => randomBytes(12).toString('hex');

export class Ctx {
  dirty = new Set<string>();
  /** meeting rows to save (next meeting time, nudge and recap sent) */
  meetingPatch = new Map<string, { nudgedAt?: string; recappedAt?: string; nextAt?: string; live?: unknown }>();
  out: PendingMessage[] = [];
  after: Array<() => Promise<void>> = [];
  flash = '';
  /** the Jira issue a change came from (it is not echoed back to that same issue) */
  skipKey = '';
  /** why the last tracker issue could not be created (shown to the person) */
  trkError = '';
  /** status and Jira key of every commitment when this change started, to see what moved */
  before: Map<string, string>;
  beforeDue: Map<string, string>;
  /** a Jira status asked for by the action itself ("Add to Jira" on its own puts the issue in To Do) */
  jiraWant = new Map<string, 'new' | 'indeterminate'>();
  /** shown on Slack messages that are redrawn because the change happened somewhere else */
  note = '';
  constructor(public w: World, public now: string) { this.before = new Map(w.commitments.map(c => [c.id, c.status + '|' + c.trk])); this.beforeDue = new Map(w.commitments.map(c => [c.id, c.due + '|' + c.owner + '|' + c.pending])); }
  today() { return this.now.slice(0, 10); }
  byId(id: string) { return this.w.commitments.find(c => c.id === id); }
  team(c: Commitment): Team { return this.w.teams.find(t => t.id === c.teamId)!; }
  meeting(c: Commitment) { return this.w.meetings.find(m => m.id === c.meetingId); }
  members(teamId: string) { return this.w.members.filter(m => m.teamId === teamId).map(m => m.name); }
  touch(c: Commitment) { this.dirty.add(c.id); }
  log(c: Commitment, txt: string) {
    c.history.push([this.now, txt]); this.touch(c);
    // every human-meaningful change also appears in the Jira issue as a comment
    if (c.trk && isRealJira(c.trk) && c.trk !== this.skipKey && !/^(Reminder sent|Heads-up sent|Overdue message)/.test(txt)) {
      const key = c.trk; this.after.push(() => jira.comment(key, txt));
    }
  }
  tlog(c: Commitment, txt: string) { c.tlog.push([this.now, txt]); this.touch(c); }
  send(to: string, kind: MessageKind, cids: string[], extra: MessageExtra = {}) {
    if (!to) return;
    const c = this.byId(cids[0]);
    this.out.push({ toName: to, kind, cids, at: this.now, meetingId: c?.meetingId || '', extra, channel: c ? this.team(c).channel : 'slack' });
  }
}

const viaText = (src: Source, ch: Channel) =>
  src === 'app' ? 'in Fireflies' : src === 'slack' ? 'in Slack' : src === 'teams' ? 'in Teams' : src === 'email' ? 'by email' : src === 'jira' ? 'in Jira' : chName(ch);
const viaName = (src: Source, ch: Channel) =>
  src === 'app' ? 'Fireflies' : src === 'slack' ? 'Slack' : src === 'teams' ? 'Teams' : src === 'email' ? 'Email' : src === 'jira' ? 'Jira' : CH[ch][0];
const trackerLabel = (t: Team) => t.tracker === 'jira' ? 'Jira' : t.tracker === 'asana' ? 'Asana' : '';
/** a key created in the user's real Jira project (not a simulated demo key) */
export const isRealJira = (key: string) => jiraReady() && key.startsWith(config.jiraProjectKey + '-');

/* ---------------- tracker (Jira / Asana) ---------------- */
export async function trackerCreate(ctx: Ctx, c: Commitment): Promise<string> {
  ctx.trkError = '';
  const t = ctx.team(c); if (t.tracker === 'none' || c.trk) return '';
  const mt = ctx.meeting(c);
  if (t.tracker === 'jira' && jiraReady()) {
    try {
      c.trk = await jira.createIssue(issueInfo(ctx, c));
      ctx.tlog(c, `Created by Fireflies from "${mt?.title}" · owner ${c.owner} · due ${fmtD(c.due)}`);
      linkChain(ctx, c);
      return c.trk;
    } catch (e: any) {
      ctx.trkError = String(e.message || e).slice(0, 220);
      ctx.tlog(c, `Could not create the Jira issue: ${ctx.trkError}`);
      return '';
    }
  }
  if (t.tracker === 'jira') { const k = t.trackerKey || 'OPS'; c.trk = `${k}-${await nextCounter('jira:' + k, 143)}`; }
  else c.trk = `Task #${await nextCounter('asana', 4830)}`;
  ctx.tlog(c, `Created by Fireflies from "${mt?.title}" · assignee ${c.owner} · due ${fmtD(c.due)} (simulated: ${trackerLabel(t)} not connected)`);
  return c.trk;
}
const issueInfo = (ctx: Ctx, c: Commitment): jira.IssueInfo => {
  const mt = ctx.meeting(c);
  return { summary: c.text, due: c.due, owner: c.owner, meeting: mt?.title || '', meetingDate: mt?.date || '', quote: c.quote, id: c.id };
};
/** show dependencies in Jira too: "KAN-1 blocks KAN-2" */
function linkChain(ctx: Ctx, c: Commitment) {
  if (!isRealJira(c.trk)) return;
  const up = c.dep ? ctx.byId(c.dep) : undefined;
  const pairs: [string, string][] = [];
  if (up && isRealJira(up.trk) && isOpen(up)) pairs.push([up.trk, c.trk]);
  ctx.w.commitments.filter(x => x.dep === c.id && isRealJira(x.trk) && isOpen(x)).forEach(x => pairs.push([c.trk, x.trk]));
  for (const [a, b] of pairs) { ctx.tlog(c, `Linked in Jira: ${a} blocks ${b}`); ctx.after.push(() => jira.linkBlocks(a, b)); }
}
/** the owner changed (hand-over accepted, manager assigned it, or nobody owns it): rewrite the Jira issue's owner */
function trackerOwner(ctx: Ctx, c: Commitment) {
  if (!c.trk) return;
  ctx.tlog(c, `Owner set to ${c.owner || 'nobody (with the manager to assign)'}`);
  if (isRealJira(c.trk)) { const key = c.trk, info = issueInfo(ctx, c); ctx.after.push(() => jira.setOwner(key, info)); }
}
function trackerDue(ctx: Ctx, c: Commitment, why = 'from Fireflies') {
  if (!c.trk) return;
  ctx.tlog(c, `Due date changed to ${fmtD(c.due)} (${why})`);
  if (isRealJira(c.trk) && c.trk !== ctx.skipKey) { const key = c.trk, due = c.due; ctx.after.push(() => jira.setDueDate(key, due)); }
}
function trackerClose(ctx: Ctx, c: Commitment, how: 'done' | 'dropped') {
  if (!c.trk || c.trkClosed) return;
  c.trkClosed = true;
  const t = ctx.team(c);
  ctx.tlog(c, how === 'done' ? (t.tracker === 'jira' ? 'Moved to Done (from Fireflies)' : 'Marked complete (from Fireflies)') : 'Closed as dropped (from Fireflies)');
  if (isRealJira(c.trk)) { const key = c.trk; ctx.after.push(() => jira.moveToDone(key)); }
}

/* ---------------- dependencies ---------------- */
const depOpen = (ctx: Ctx, c: Commitment) => { const u = c.dep ? ctx.byId(c.dep) : undefined; return !!(u && isOpen(u)); };

/** when a step's date moves later, every step that waits on it moves by the same number of days */
function shiftDependents(ctx: Ctx, c: Commitment, delta: number) {
  if (!(delta > 0)) return;
  ctx.w.commitments.filter(x => x.dep === c.id && isOpen(x) && isDate(x.due)).forEach(x => {
    const old = x.due; x.movedFrom = x.movedFrom || old; x.due = addDays(x.due, delta); x.sent = x.sent.filter(t => t === 'confirm');
    ctx.log(x, `Due date moved from ${fmtD(old)} to ${fmtD(x.due)} because "${c.text}" (${firstName(c.owner || c.pending)}) now ends ${fmtD(c.due)}`);
    trackerDue(ctx, x, `follows ${c.trk || 'the step before'}`);
    const gap = daysBetween(c.due, x.due);
    if (x.owner) ctx.send(x.owner, 'info', [x.id], { title: 'Your date moved', note: `quick update: "${c.text}" now ends ${fmtD(c.due)}, so your "${x.text}" moves to ${fmtD(x.due)} (still ${gap} day${gap === 1 ? '' : 's'} after it).` });
    shiftDependents(ctx, x, delta);
  });
}

/** a hand-over that was declined or not answered goes back to the owner; the second time, to the manager */
function bounceBack(ctx: Ctx, c: Commitment, why: string): string {
  const t = ctx.team(c), from = c.pending;
  c.bounces = (c.bounces || 0) + 1; c.pending = ''; ctx.touch(c);
  if (c.bounces >= 2) {
    const prev = c.owner; c.owner = ''; c.status = 'Unclaimed'; trackerOwner(ctx, c);
    ctx.log(c, `${why}. Second time this could not be handed over, so it went to ${firstName(t.manager)} as "Needs an owner"`);
    ctx.send(t.manager, 'info', [c.id], { title: 'A commitment needs an owner', note: `${firstName(prev)} tried to hand over "${c.text}" twice and nobody took it. Can you assign it? Open Commitments → Needs an owner.` });
    ctx.w.commitments.filter(x => x.dep === c.id && isOpen(x)).forEach(x => ctx.log(x, `"${c.text}" has no owner right now. ${firstName(t.manager)} will assign it`));
    return `${why}. It went to ${firstName(t.manager)} to assign.`;
  }
  c.status = c.prevStatus === 'Suggested' ? 'Suggested' : (depOpen(ctx, c) ? 'Waiting' : 'Confirmed');
  if (c.status === 'Suggested') { c.sentAt = ctx.now; c.sent = c.sent.filter(x => x !== 'confirm'); }
  ctx.log(c, `${why}. It is back with ${firstName(c.owner)}`);
  ctx.send(c.owner, 'declined', [c.id], { from });
  return `${why}. It is back with ${firstName(c.owner)}.`;
}

/** the Jira issue was moved out of Done (for example back to In Progress): open the commitment again */
export function reopenFromJira(ctx: Ctx, c: Commitment, statusName: string): string {
  if (isOpen(c) || !c.trk) return '';
  const was = c.status;
  ctx.skipKey = c.trk; // don't write this change back to the same issue
  c.trkClosed = false;
  c.status = depOpen(ctx, c) ? 'Waiting' : 'Confirmed';
  c.sent = c.sent.filter(x => x === 'confirm');
  ctx.touch(c);
  ctx.tlog(c, `Moved to ${statusName} in Jira`);
  ctx.log(c, `Reopened: Jira issue ${c.trk} was moved back to ${statusName}, so this is open again (was ${was === 'Dropped' ? 'dropped' : 'done'})`);
  if (c.owner) ctx.send(c.owner, 'info', [c.id], { title: 'Open again', note: `"${c.text}" (${c.trk}) was moved back to ${statusName} in Jira, so it is open again. Due ${fmtD(c.due)}.` });
  // steps after it that were told they could start go back to waiting
  ctx.w.commitments.filter(x => x.dep === c.id && x.status === 'Confirmed').forEach(x => {
    x.status = 'Waiting'; ctx.touch(x);
    ctx.log(x, `Waiting again: "${c.text}" was reopened in Jira`);
    if (x.owner) ctx.send(x.owner, 'info', [x.id], { title: 'Wait a bit', note: `"${c.text}" (${firstName(c.owner || 'someone')}) was reopened in Jira, so your "${x.text}" waits on it again.` });
  });
  ctx.flash = `${c.trk} reopened in Jira`;
  return 'Reopened.';
}

/** first messages for a team that is switched on (or after "Reset demo"): one card per owner per
 *  meeting for everything waiting for their confirmation, the open hand-over requests, and one
 *  message to the manager for items nobody owns. Commitments in `skip` already have a delivered card. */
export function sendOpenCards(ctx: Ctx, teamIds: string[], skip: Set<string> = new Set()): number {
  let n = 0;
  for (const tid of teamIds) {
    const t = ctx.w.teams.find(x => x.id === tid); if (!t) continue;
    const mine = ctx.w.commitments.filter(c => c.teamId === tid && !skip.has(c.id));
    const groups = new Map<string, string[]>();
    for (const c of mine.filter(c => c.status === 'Suggested' && c.owner)) {
      const k = c.owner + '|' + c.meetingId; groups.set(k, [...(groups.get(k) || []), c.id]);
    }
    for (const [k, ids] of groups) {
      const owner = k.split('|')[0];
      ctx.send(owner, 'card', ids); n++;
      ids.forEach(id => {
        const c = ctx.byId(id)!; c.sentAt = ctx.now; c.sent = c.sent.filter(x => x !== 'confirm'); ctx.touch(c);
        const line = `Sent to ${firstName(owner)} ${chName(t.channel)} for confirmation`;
        if (c.history[c.history.length - 1]?.[1] !== line) ctx.log(c, line);
      });
    }
    for (const c of mine.filter(c => c.status === 'PendingAccept' && c.pending)) { ctx.send(c.pending, 'reassign_request', [c.id], { from: c.owner }); c.pendingAt = ctx.now; ctx.touch(c); n++; }
    const none = mine.filter(c => c.status === 'Unclaimed'); // (already-told ones are filtered out by `skip`)
    if (none.length) { ctx.send(t.manager, 'info', [none[0].id], { title: `${none.length} commitment${none.length > 1 ? 's' : ''} in ${t.name} need${none.length > 1 ? '' : 's'} an owner`, note: `nobody owns ${none.map(c => `"${c.text}"`).join(', ')} yet. Can you assign ${none.length > 1 ? 'them' : 'it'}? Open Commitments → Needs an owner.` }); n++; }
  }
  return n;
}

/* ---------------- the actions ---------------- */
export const ACTIONS = ['confirm', 'push_tracker', 'edit_date', 'snooze', 'reassign', 'accept', 'decline', 'done', 'drop', 'not_commitment', 'unlink', 'keep_waiting', 'claim'] as const;
export type Action = typeof ACTIONS[number];

export async function act(ctx: Ctx, a: Action, id: string, actor: string, extra: ActExtra): Promise<string> {
  const c = ctx.byId(id); if (!c) throw new ActError('This commitment no longer exists.');
  const t = ctx.team(c), via = viaText(extra.src, t.channel), who = firstName(actor), tn = trackerLabel(t);
  if (!isOpen(c)) {
    // repeat clicks and Jira echoes after we closed it ourselves are ignored
    if (extra.src === 'jira') return 'Already closed.';
    throw new ActError(`Already ${c.status === 'Done' ? 'done' : c.status.toLowerCase()}. Nothing changed.`);
  }
  if (a === 'accept' || a === 'decline') { if (c.status !== 'PendingAccept') throw new ActError('This request was already answered.'); }
  else if (a === 'claim') {
    // the manager assigns an item nobody owns, or one whose named owner has not confirmed yet
    if (c.status !== 'Unclaimed' && c.status !== 'Suggested') throw new ActError('This already has a confirmed owner.');
    if (actor !== t.manager && extra.src !== 'jira') throw new ActError(`Only ${firstName(t.manager)} (the manager) can assign this.`);
    if (extra.to && extra.to === c.owner) return `Already with ${firstName(c.owner)}.`;
  }
  else if (c.status === 'PendingAccept') throw new ActError(`Waiting for ${firstName(c.pending)} to accept or decline first.`);

  let msg = '';
  const ensureDate = () => { if (!isDate(c.due)) { c.due = addDays(ctx.today(), 7); return true; } return false; };
  switch (a) {
    case 'confirm': case 'push_tracker': {
      const wasSuggested = c.status === 'Suggested';
      if (wasSuggested || c.status === 'Unclaimed') c.status = depOpen(ctx, c) ? 'Waiting' : 'Confirmed';
      const def = ensureDate(); let k = '';
      if (a === 'push_tracker') k = await trackerCreate(ctx, c);
      // Confirm + Jira = the owner takes it on now → In Progress; Add to Jira on its own = tracked, not started → To Do
      if (k) ctx.jiraWant.set(c.id, wasSuggested && c.status === 'Confirmed' ? 'indeterminate' : 'new');
      if (wasSuggested) ctx.log(c, `Confirmed by ${who} ${via}` + (k ? ` and added to ${tn} (${k})` : '') + (def ? `. No date was said, so due ${fmtD(c.due)}` : '') + (c.status === 'Waiting' ? `. Waiting on ${firstName(ctx.byId(c.dep)?.owner || 'someone')}` : ''));
      else if (k) ctx.log(c, `Added to ${tn} (${k}) by ${who} ${via}`);
      if (a === 'push_tracker' && !k && tn) msg = `Confirmed, but the ${tn} issue could not be created. ${ctx.trkError || `See the ${tn} panel.`}`;
      else msg = !wasSuggested && k ? `Added to ${tn} (${k}).` : c.status === 'Waiting' ? 'Confirmed. It starts when the item it depends on is done.' : `Confirmed. Due ${fmtD(c.due)}. Reminder that morning.`;
      break;
    }
    case 'edit_date': {
      if (!isDate(extra.date)) throw new ActError('Pick a date.');
      const oldDue = c.due;
      if (isDate(oldDue) && oldDue !== extra.date) c.movedFrom = c.movedFrom || oldDue;
      c.due = extra.date!; c.sent = c.sent.filter(x => x === 'confirm');
      if (isDate(oldDue)) shiftDependents(ctx, c, daysBetween(oldDue, c.due));
      trackerDue(ctx, c);
      ctx.log(c, `Due date changed to ${fmtD(c.due)} by ${who} ${via}` + (c.trk && tn ? `. ${tn} updated` : ''));
      msg = c.status === 'Suggested' ? `Due date changed to ${fmtD(c.due)}. Still needs your confirmation.` : `Due date moved to ${fmtD(c.due)}. The reminder moves with it.`;
      break;
    }
    case 'snooze': {
      if (c.snooze >= 2) throw new ActError('Snooze limit reached. Choose Done, Reassign or Drop.');
      ensureDate(); c.movedFrom = c.movedFrom || c.due; c.due = addDays(c.due, 1); c.snooze++;
      shiftDependents(ctx, c, 1); trackerDue(ctx, c); c.sent = c.sent.filter(x => x === 'confirm');
      ctx.log(c, `${who} asked for 1 more day. Now due ${fmtD(c.due)}` + (c.trk && tn ? `. ${tn} updated` : ''));
      msg = `Moved to ${fmtD(c.due)}.`;
      break;
    }
    case 'reassign': {
      const to = extra.to;
      if (!to || to === c.owner || !ctx.members(c.teamId).includes(to)) throw new ActError('Choose a teammate.');
      c.prevStatus = c.status; c.pending = to; c.status = 'PendingAccept'; c.pendingAt = ctx.now;
      ctx.log(c, `${who} asked ${firstName(to)} to take this on ${via}. Waiting for them to accept (2 days to answer)`);
      ctx.send(to, 'reassign_request', [c.id], { from: actor });
      msg = `Request sent to ${firstName(to)}.`;
      break;
    }
    case 'accept': {
      const nw = c.pending;
      const child: Commitment = {
        ...structuredClone(c), id: c.id + 'R', owner: nw, pending: '', status: depOpen(ctx, c) ? 'Waiting' : 'Confirmed', parent: c.id,
        history: [], sent: [], snooze: 0,
        sentAt: ctx.now, pendingAt: '', prevStatus: '', bounces: 0, token: newToken(), lastVia: viaName(extra.src, t.channel), lastAt: ctx.now, tlog: [],
      };
      ctx.w.commitments.push(child); ctx.touch(child);
      ctx.w.commitments.filter(x => x.dep === c.id && isOpen(x)).forEach(x => { x.dep = child.id; ctx.touch(x); });
      if (c.trk) { child.tlog = c.tlog.slice(); c.trk = ''; }
      c.status = 'Reassigned'; c.pending = ''; ctx.log(c, `${firstName(nw)} accepted. Reassigned`);
      ctx.log(child, `Reassigned from ${firstName(c.owner)} to ${firstName(nw)}: ${firstName(nw)} accepted ${via}. Due date stays ${fmtD(child.due)}`);
      trackerOwner(ctx, child);
      ctx.send(c.owner, 'info', [c.id], { title: 'Reassignment accepted', note: `${firstName(nw)} now owns "${c.text}".` });
      ctx.send(nw, 'card', [child.id]);
      ctx.w.commitments.filter(x => x.dep === child.id && isOpen(x)).forEach(x => {
        ctx.log(x, `What this waits on moved from ${firstName(c.owner)} to ${firstName(nw)}`);
        ctx.send(x.owner, 'info', [x.id], { title: 'What you wait on has a new owner', note: `"${c.text}", which your work waits on, moved from ${firstName(c.owner)} to ${firstName(nw)}. You now wait on ${firstName(nw)}; the date stays the same.` });
      });
      ctx.flash = child.id;
      msg = `You now own this. Due ${fmtD(child.due)}.`;
      break;
    }
    case 'decline':
      msg = bounceBack(ctx, c, `${firstName(c.pending)} declined`);
      break;
    case 'done': {
      if (c.status === 'Waiting' && extra.src !== 'jira') throw new ActError('This is still waiting on the step before it.');
      c.status = 'Done';
      if (extra.src === 'jira') { ctx.skipKey = c.trk; c.trkClosed = true; ctx.tlog(c, 'Moved to Done in Jira'); ctx.log(c, `Jira issue ${c.trk} moved to Done. Synced back`); }
      else { trackerClose(ctx, c, 'done'); ctx.log(c, `Marked done by ${who} ${via}` + (c.trk && tn ? `. ${tn} ${t.tracker === 'jira' ? 'issue moved to Done' : 'task completed'}` : '')); }
      const freed: string[] = [];
      ctx.w.commitments.filter(x => x.dep === c.id && isOpen(x) && x.status !== 'Unclaimed').forEach(x => {
        if (x.status === 'Waiting') x.status = 'Confirmed';
        ctx.log(x, `Unblocked: ${firstName(c.owner)} finished "${c.text}"`);
        ctx.send(x.owner, 'unblocked', [x.id], { upstream: c.id }); if (x.owner) freed.push(firstName(x.owner));
      });
      msg = 'Marked done.' + (freed.length ? ` ${freed.join(' and ')} can start now (told ${chName(t.channel)}).` : ' Thank you.');
      break;
    }
    case 'drop':
      c.status = 'Dropped'; trackerClose(ctx, c, 'dropped');
      ctx.log(c, `Dropped by ${who} ${via}` + (c.trk && tn ? `. ${tn} item closed` : ''));
      ctx.w.commitments.filter(x => x.dep === c.id && isOpen(x)).forEach(x => {
        ctx.log(x, `${firstName(c.owner)} dropped "${c.text}", which this waits on`);
        ctx.send(x.owner, 'upstream_dropped', [x.id], { upstream: c.id });
      });
      msg = 'Dropped. Dropping honestly counts as resolved.';
      break;
    case 'not_commitment':
      c.status = 'NotCommitment'; ctx.log(c, `${who} marked this as not a commitment. Removed`);
      msg = 'Removed. This helps the AI improve.';
      break;
    case 'unlink': {
      const u = ctx.byId(c.dep);
      ctx.log(c, `${who} removed the link to ${firstName(u?.owner || '')}'s "${u?.text}" ${via}`);
      c.dep = ''; if (c.status === 'Waiting') c.status = 'Confirmed';
      msg = 'Link removed. This no longer waits on anyone.';
      break;
    }
    case 'keep_waiting':
      ctx.log(c, `${who} chose to keep waiting`); msg = 'OK, still waiting.';
      break;
    case 'claim': {
      const o = extra.to; if (!o || !ctx.members(c.teamId).includes(o)) throw new ActError('Choose who this belongs to.');
      const before = c.owner;
      c.owner = o; c.status = 'Suggested'; c.sentAt = ctx.now; c.sent = []; c.bounces = 0;
      trackerOwner(ctx, c);
      ctx.log(c, `Assigned to ${firstName(o)} by ${firstName(actor)} ${via}` + (before ? ` (${firstName(before)} had not confirmed)` : ''));
      ctx.log(c, `Sent to ${firstName(o)} ${chName(t.channel)} for confirmation`);
      ctx.send(o, 'card', [c.id]);
      msg = `Sent to ${firstName(o)} ${chName(t.channel)}.`;
      break;
    }
    default: throw new ActError('Unknown action.');
  }
  c.lastVia = viaName(extra.src, t.channel); c.lastAt = ctx.now; ctx.touch(c);
  if (!ctx.flash) ctx.flash = c.id;
  if (c.trk && tn && ['edit_date', 'snooze', 'done', 'drop'].includes(a)) msg += ` ${tn} ${c.trk} updated.`;
  return msg;
}

/* ---------------- reminders ---------------- */
/** Sends whatever is due at ctx.now; returns how many reminders/changes happened.
 *  - the card goes out the same day as the meeting (importMeeting)
 *  - not confirmed after 1 working day: one nudge; after 2 working days: it goes to the manager to assign
 *    (a manager's own items stay with them)
 *  - confirmed: one reminder the working day before the due date, and the last one on the due date
 *    (a weekend due date is reminded on Friday) */
export function runReminders(ctx: Ctx): number {
  let n = 0;
  const td = ctx.today();
  for (const c of [...ctx.w.commitments]) {
    // "2 days" means 2 working days, so a weekend doesn't count against anyone
    const wd = (since: string) => since ? workingDaysBetween(since.slice(0, 10), td) : 0;
    if (c.status === 'PendingAccept' && c.pendingAt && wd(c.pendingAt) >= 2) {
      bounceBack(ctx, c, `${firstName(c.pending)} did not answer in 2 days`); n++; continue;
    }
    if (c.status === 'Suggested') {
      if (!c.sentAt || !c.owner) continue;
      const age = wd(c.sentAt);
      const t = ctx.team(c);
      if (age >= 2 && c.sent.includes('confirm') && c.owner !== t.manager) {
        const was = c.owner;
        c.owner = ''; c.status = 'Unclaimed'; trackerOwner(ctx, c);
        ctx.log(c, `${firstName(was)} did not confirm within 2 days. Sent to ${firstName(t.manager)} to assign`);
        ctx.send(t.manager, 'info', [c.id], { title: 'A commitment needs an owner', note: `${firstName(was)} didn't confirm "${c.text}" (due ${fmtD(c.due)}) within 2 days. Can you assign it? Open Commitments → Needs an owner.` });
        n++;
      } else if (age >= 1 && !c.sent.includes('confirm') && !(isDate(c.due) && c.due < td)) {
        // (no "please confirm" for something whose date has already gone; it still goes to the manager after 2 days)
        c.sent.push('confirm'); ctx.log(c, 'Reminder sent: still needs confirmation'); ctx.send(c.owner, 'confirm_reminder', [c.id]); n++;
      }
      continue;
    }
    if (c.status !== 'Confirmed' || !isDate(c.due) || c.sent.length >= 4) continue;
    const due = c.due, dueRemind = workday(due), dayBefore = workday(addDays(due, -1));
    const startDay = (c.sentAt || ctx.now).slice(0, 10);
    if (!c.sent.includes('daybefore') && !c.sent.includes('due') && dayBefore < dueRemind && dayBefore > startDay && td >= dayBefore && td < dueRemind) {
      c.sent.push('daybefore'); ctx.log(c, `Reminder sent: due tomorrow (${fmtD(due)})`); ctx.send(c.owner, 'due_tomorrow', [c.id]); n++;
    } else if (!c.sent.includes('due') && td >= dueRemind && td <= due) {
      c.sent.push('due'); ctx.log(c, dueRemind !== due ? `Reminder sent before the weekend: due ${fmtD(due)}` : 'Reminder sent: due today'); ctx.send(c.owner, 'due_today', [c.id], { weekend: dueRemind !== due }); n++;
    }
  }
  return n;
}

export type { Status };
