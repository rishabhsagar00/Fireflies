// Shared by the backend and the frontend: data types, the commitment status vocabulary,
// date helpers (all dates are team-local calendar days, "YYYY-MM-DD"; times are
// team-local "YYYY-MM-DDTHH:MM"), and the wording of every notification.

export type Channel = 'slack' | 'teams' | 'email';
export type Tracker = 'jira' | 'asana' | 'none';
export type Status =
  | 'Suggested' | 'Confirmed' | 'Waiting' | 'PendingAccept'
  | 'Done' | 'Dropped' | 'Reassigned' | 'NotCommitment' | 'Unclaimed';

export interface Team {
  id: string; name: string; channel: Channel; tracker: Tracker;
  trackerKey: string; manager: string; sort: number;
}
export interface Member { teamId: string; name: string; email: string; sort: number; }
export interface Meeting {
  id: string; teamId: string; title: string; date: string; startTime: string; mins: number;
  overview: string[]; keywords: string[]; lines: [string, string, string][]; source: string;
  /** recurring meetings share a series ("release-sync"); empty = a one-off meeting */
  series: string;
  /** when the next meeting of this series starts, "YYYY-MM-DDTHH:MM" team time; empty = not set */
  nextAt: string;
  /** what the next meeting is about (set by the manager); empty = same as this meeting's title */
  nextTopic?: string;
  /** the next meeting of this series while it runs (demo stand-in for the calendar and the call) */
  live?: MeetingLive | null;
  /** when the pre-meeting nudges and the recap for that next meeting were sent (empty = not yet) */
  nudgedAt: string; recappedAt: string;
}
export type Entry = [string, string]; // [time, text]
export interface Commitment {
  id: string; meetingId: string; teamId: string; seq: number; text: string;
  owner: string; pending: string; said: string; due: string; dep: string;
  status: Status; prevStatus: string; trk: string; trkClosed: boolean; quote: string;
  history: Entry[]; tlog: Entry[]; sent: string[]; snooze: number; bounces: number;
  sentAt: string; pendingAt: string; movedFrom: string; lastVia: string; lastAt: string;
  parent: string; token: string;
}
/** one line in the meeting chat: someone joined, or Fred posted the status (a snapshot of that moment) */
export interface ChatEvent { at: string; type: 'join' | 'fred' | 'note'; who?: string; text?: string; recap?: { done: RecapItem[]; open: RecapItem[]; need: RecapItem[] } }
/** the next meeting of a series: pre-read posted 30 minutes before, the call itself, and its chat */
export interface MeetingLive { preAt?: string; startsAt?: string; startAt?: string; fredAt?: string; endedAt?: string; people: { name: string; at: string }[]; chat: ChatEvent[]; nextMeetingId?: string }
export type MessageKind =
  | 'card' | 'confirm_reminder' | 'due_tomorrow' | 'due_today' | 'heads_up' | 'overdue' | 'reassign_request'
  | 'unblocked' | 'upstream_dropped' | 'info' | 'declined' | 'pre_meeting' | 'recap' | 'assign_request' | 'upcoming';
export interface MessageExtra {
  from?: string; upstream?: string; title?: string; note?: string; days?: number; weekend?: boolean;
  /** recap / assign_request: the meeting the items came from; nextAt = when the next meeting started (Fred joined);
   *  late = this copy went privately to someone who joined after the recap was posted */
  meetingId?: string; nextAt?: string; late?: boolean; phase?: 'pre';
}
export interface Message {
  id: number; toName: string; kind: MessageKind; cids: string[]; at: string; meetingId: string;
  extra: MessageExtra; channel: Channel; delivery: string; delivered: boolean;
}
export interface Integrations {
  slack: boolean; slackInteractive: boolean; teams: boolean; email: boolean; jira: boolean;
  jiraProjectKey: string; jiraBaseUrl: string;
}
export interface Routing { slackUserId: string; email: string; /** Slack channel that stands in for the meeting chat (recaps go here) */ meetingChannel?: string; }
export interface AppState {
  now: string; teams: Team[]; members: Member[]; meetings: Meeting[]; commitments: Commitment[];
  messages: Message[]; routing: Routing; integrations: Integrations; baseUrl: string;
  liveTeams: string[]; jiraWebhookUrl: string; slackInteractivityUrl: string;
}

export const CLOSED: Status[] = ['Done', 'Reassigned', 'Dropped', 'NotCommitment'];
export const isOpen = (c: Pick<Commitment, 'status'>) => !CLOSED.includes(c.status);
export const LABEL: Record<Status, string> = {
  Suggested: 'Needs confirmation', Confirmed: 'Confirmed', Waiting: 'Waiting on another item',
  PendingAccept: 'Awaiting acceptance', Done: 'Done', Dropped: 'Dropped', Reassigned: 'Reassigned',
  NotCommitment: 'Not a commitment', Unclaimed: 'Needs an owner',
};
export const CH: Record<Channel, [string, string]> = {
  slack: ['Slack', '#E01E5A'], teams: ['Teams', '#7B83EB'], email: ['Email', '#4C8DF6'],
};

/* ---------- dates ---------- */
export const isDate = (d: unknown): d is string => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const D = (s: string) => new Date(s + 'T00:00:00Z');
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return isoDay(d); };
export const dow = (s: string) => D(s).getUTCDay();
/** a reminder that would land on Sat/Sun moves to the Friday before */
export const workday = (s: string) => dow(s) === 6 ? addDays(s, -1) : dow(s) === 0 ? addDays(s, -2) : s;
export const daysBetween = (a: string, b: string) => Math.round((D(b).getTime() - D(a).getTime()) / 864e5);
/** working days (Mon–Fri) from day a to day b, e.g. Fri → Mon = 1 */
export const workingDaysBetween = (a: string, b: string) => { let n = 0, d = a; while (d < b) { d = addDays(d, 1); if (![0, 6].includes(dow(d))) n++; } return n; };
export const nextWorkday = (s: string) => { let d = addDays(s, 1); while ([0, 6].includes(dow(d))) d = addDays(d, 1); return d; };
export const fmtD = (s: string) => isDate(s) ? D(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : 'No date yet';
export const fmtDLong = (s: string) => isDate(s) ? D(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'No date yet';
export const fmtClock = (h: string) => {
  if (!h) return '';
  const [H0, M] = h.split(':').map(Number); const ap = H0 >= 12 ? 'PM' : 'AM'; const H = H0 % 12 || 12;
  return `${H}:${String(M).padStart(2, '0')} ${ap}`;
};
export const fmtT = (t: string) => {
  if (!t) return '';
  const [d, h] = t.split('T');
  return `${D(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}, ${fmtClock(h)}`;
};
/** hours between two local "YYYY-MM-DDTHH:MM" strings */
export const hoursBetween = (a: string, b: string) => (new Date(b + ':00Z').getTime() - new Date(a + ':00Z').getTime()) / 36e5;

/* ---------- people and wording ---------- */
export const firstName = (n: string) => !n ? '' : n.startsWith('Dr.') ? n.split(' ').slice(0, 2).join(' ') : n.split(' ')[0];
export const initials = (n: string) => n.replace(/^Dr\.\s*/, '').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
export const hue = (n: string) => { let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
export const trackerName = (t: Tracker | string) => t === 'jira' ? 'Jira' : t === 'asana' ? 'Asana' : '';
export const chName = (ch: Channel) => ch === 'slack' ? 'in Slack' : ch === 'teams' ? 'in Teams' : 'by email';
export const overdue = (c: Commitment, today: string) => c.status === 'Confirmed' && isDate(c.due) && c.due < today;

/** the chain a commitment sits in: everything it waits on, itself, and what waits on it */
export function chainOf(c: Commitment, all: Commitment[]): Commitment[] {
  const byId = (id: string) => all.find(x => x.id === id);
  const up: Commitment[] = []; let x: Commitment | undefined = c; let guard = 0;
  while (x && x.dep && byId(x.dep) && guard++ < 6) { x = byId(x.dep)!; up.unshift(x); }
  const down: Commitment[] = []; let y = c; guard = 0;
  while (guard++ < 6) {
    const n = all.find(z => z.dep === y.id && !['NotCommitment', 'Reassigned'].includes(z.status));
    if (!n) break; down.push(n); y = n;
  }
  return up.concat([c], down);
}

/** headline + sub-line of each notification kind (used by the app preview and the real Slack/Teams/email) */
export function messageTitle(m: Pick<Message, 'kind' | 'extra' | 'cids'>, all: Commitment[], meetings: Meeting[]): [string, string] {
  const c0 = all.find(c => c.id === m.cids[0]);
  const mt = c0 ? meetings.find(x => x.id === c0.meetingId) : undefined;
  const title = mt?.title || 'a meeting';
  const e = m.extra || {};
  switch (m.kind) {
    case 'card': return [c0 && c0.status !== 'Suggested' && c0.status !== 'Unclaimed' ? 'Your commitments' : 'Commitments for you to confirm', `From ${title} · ${fmtD(mt?.date || '')}`];
    case 'confirm_reminder': return ['Still need your confirmation', `From ${title}. If no one confirms in 2 working days, it goes to the manager's "Needs an owner" list.`];
    case 'due_tomorrow': return ['Due tomorrow', `From ${title}`];
    case 'due_today': return [e.weekend ? 'Due this weekend' : 'Due today', e.weekend ? `Due ${fmtD(c0?.due || '')}, so here's your reminder before the weekend` : `You said you'd do this by today · ${title}`];
    case 'heads_up': return [`Due in ${e.days || 2} days`, `A heads-up so there's time to finish · ${title}`];
    case 'overdue': return ['This is now overdue', `It was due ${fmtD(c0?.due || '')}. Mark it done, pick a new date, or drop it. This is the last reminder.`];
    case 'reassign_request': return ['Can you take this on?', `${firstName(e.from || 'A teammate')} asked you to own this commitment`];
    case 'unblocked': { const u = all.find(x => x.id === (e.upstream || c0?.dep)); return ['Your next step can start', `${firstName(u?.owner || 'A teammate')} finished what this was waiting on`]; }
    case 'upstream_dropped': { const u = all.find(x => x.id === e.upstream); return ['Something you were waiting on was dropped', u ? `${firstName(u.owner)} dropped: ${u.text}` : '']; }
    case 'declined': return ['This is still yours', `${firstName(e.from || 'They')} did not take it over. Confirm it, ask someone else, or drop it.`];
    case 'pre_meeting': { const pm = meetings.find(x => x.id === e.meetingId) || mt; return [`${pm?.nextTopic || 'Your meeting'} starts in 1 hour`, `Still open from ${pm?.title || title} · ${fmtD(pm?.date || '')}`]; }
    case 'recap': { const pm = meetings.find(x => x.id === e.meetingId) || mt; return [`From our last meeting · ${pm?.title || title} (${fmtD(pm?.date || '')})`, `Before today's meeting · completed, remaining and needs an owner · no names`]; }
    case 'upcoming': { const pm = meetings.find(x => x.id === e.meetingId) || mt; return [`Upcoming commitments from ${pm?.title || title} (${fmtD(pm?.date || '')})`, `${m.cids.length} commitment${m.cids.length === 1 ? '' : 's'} · each owner confirms theirs privately`]; }
    case 'assign_request': { const pm = meetings.find(x => x.id === e.meetingId) || mt; return [`${m.cids.length} item${m.cids.length === 1 ? '' : 's'} without a confirmed owner`, `From ${pm?.title || title} · pick who takes each one`]; }
    case 'info': default: return [e.title || 'Update', e.note || ''];
  }
}

/** the personal opening line of every message: "Hey Neha, just a quick reminder…" */
export function greeting(m: Pick<Message, 'kind' | 'extra' | 'cids' | 'toName'>, all: Commitment[], meetings: Meeting[]): string {
  const c0 = all.find(c => c.id === m.cids[0]);
  const mt = c0 ? meetings.find(x => x.id === c0.meetingId) : undefined;
  const n = m.cids.length, e = m.extra || {};
  const hey = `Hey ${firstName(m.toName)},`;
  const it = n > 1 ? 'these' : 'this';
  switch (m.kind) {
    case 'card':
      if (c0 && c0.parent) return `${hey} you've taken this over. It's yours now, due ${fmtD(c0.due)}.`;
      if (c0 && c0.status === 'Suggested' && c0.history.some(([, x]) => /^Assigned to/.test(x))) return `${hey} your manager assigned you this from "${mt?.title || 'a meeting'}". Can you confirm it's yours and the date works?`;
      return `${hey} in "${mt?.title || 'the meeting'}" you said you'd take care of ${n > 1 ? `${n} things` : 'this'}. Can you confirm ${n > 1 ? 'they are' : "it's"} yours and the date${n > 1 ? 's are' : ' is'} right?`;
    case 'confirm_reminder': return `${hey} just a quick reminder: ${it} still need${n > 1 ? '' : 's'} your confirmation. If nobody confirms in 2 working days it goes to your manager to assign.`;
    case 'due_tomorrow': return `${hey} just a quick reminder: "${c0?.text || 'this'}" is due tomorrow, ${fmtD(c0?.due || '')}.`;
    case 'due_today': return e.weekend ? `${hey} "${c0?.text || 'this'}" is due ${fmtD(c0?.due || '')}, which is the weekend, so here's your reminder before you log off today.` : `${hey} today's the day: "${c0?.text || 'this'}" is due today, ${fmtD(c0?.due || '')}. Mark it done, or ask for one more day.`;
    case 'heads_up': return `${hey} a heads-up: this is due in ${e.days || 2} days (${fmtD(c0?.due || '')}), so there's still time to finish it.`;
    case 'overdue': return `${hey} this was due ${fmtD(c0?.due || '')} and is still open. Mark it done, pick a new date, or drop it. This is the last reminder.`;
    case 'reassign_request': return `${hey} ${firstName(e.from || 'a teammate')} asked if you can take this on. The due date stays ${fmtD(c0?.due || '')}.`;
    case 'unblocked': { const u = all.find(x => x.id === (e.upstream || c0?.dep)); return `${hey} good news: ${firstName(u?.owner || 'your teammate')} finished "${u?.text || 'the step before'}", so you can start now.`; }
    case 'upstream_dropped': { const u = all.find(x => x.id === e.upstream); return `${hey} ${firstName(u?.owner || 'a teammate')} dropped "${u?.text || 'something'}", which this was waiting on. Keep waiting, hand it over, or drop yours too.`; }
    case 'declined': return `${hey} ${firstName(e.from || 'they')} didn't take this over, so it's still yours. Confirm it, ask someone else, or drop it.`;
    case 'pre_meeting': { const pm = meetings.find(x => x.id === e.meetingId) || meetings.find(x => x.id === c0?.meetingId); const at = (e.nextAt || '').slice(11, 16);
      return `${hey} your next meeting, "${pm?.nextTopic || pm?.title || 'team'}", starts${at ? ' at ' + at : ' soon'}. ${n > 1 ? `These ${n} items are` : `"${c0?.text || 'This'}" is`} still open from "${pm?.title || 'the last meeting'}" on ${fmtD(pm?.date || '')}. A quick update now keeps the meeting recap accurate.`; }
    case 'recap': return "Hey team, Fred here. Today's meeting starts in 30 minutes. From our last meeting: what is completed, what is remaining and what still needs an owner. No names.";
    case 'upcoming': return "Hey team, these are the commitments from today's meeting. Each owner gets a private message to confirm theirs and the date.";
    case 'assign_request': { const pm = meetings.find(x => x.id === e.meetingId) || mt;
      return `${hey} the next "${pm?.series || pm?.title || 'team'}" meeting starts in 30 minutes. From "${pm?.title || 'the last meeting'}", ${n > 1 ? `these ${n} items have` : 'this item has'} no confirmed owner yet. Pick who takes ${n > 1 ? 'each one' : 'it'}; they get a card to confirm. You can also assign from the Fireflies dashboard or in Jira.`; }
    case 'info': default: return `${hey} ${e.note || e.title || ''}`;
  }
}

/** which buttons a commitment shows inside a message, by kind and status (same set in Slack, Teams, email and the preview) */
export type MsgAction = 'confirm' | 'push_tracker' | 'not_commitment' | 'drop' | 'done' | 'snooze' | 'accept' | 'decline' | 'keep_waiting' | 'edit_date' | 'reassign';
export function messageActions(kind: MessageKind, c: Commitment, toName: string, tracker: Tracker): { buttons: MsgAction[]; date: string; reassign: boolean; assign?: boolean } {
  const tn = trackerName(tracker);
  if (kind === 'info' || kind === 'recap' || kind === 'upcoming') return { buttons: [], date: '', reassign: false };
  // the manager's "who takes this?" card: an Assign-to picker while the item still has no confirmed owner
  if (kind === 'assign_request') return { buttons: [], date: '', reassign: false, assign: c.status === 'Unclaimed' || c.status === 'Suggested' };
  // the manager gave this to someone else: the old card stops offering buttons
  if (['card', 'confirm_reminder'].includes(kind) && c.status === 'Suggested' && c.owner && toName && c.owner !== toName) return { buttons: [], date: '', reassign: false };
  if (kind === 'reassign_request') return { buttons: c.status === 'PendingAccept' && c.pending === toName ? ['accept', 'decline'] : [], date: '', reassign: false };
  if (kind === 'upstream_dropped' && isOpen(c)) return { buttons: ['keep_waiting', 'drop'], date: '', reassign: true };
  if (c.status === 'Suggested') return { buttons: ['confirm', ...(tn ? ['push_tracker' as const] : []), 'not_commitment', 'drop'], date: isDate(c.due) ? 'Change date' : 'Pick a date', reassign: true };
  if (['due_tomorrow', 'due_today', 'overdue', 'heads_up', 'pre_meeting'].includes(kind) && c.status === 'Confirmed') return { buttons: ['done', ...(c.snooze < 2 ? ['snooze' as const] : []), 'drop'], date: 'Need more time?', reassign: true };
  if (c.status === 'Confirmed' || c.status === 'Waiting') return { buttons: [...(c.status === 'Confirmed' ? ['done' as const] : []), ...(tn && !c.trk ? ['push_tracker' as const] : []), ...(c.snooze < 2 ? ['snooze' as const] : []), 'drop'], date: 'Change date', reassign: true };
  return { buttons: [], date: '', reassign: false };
}
export function actionLabel(a: MsgAction, kind: MessageKind, c: Commitment, tracker: Tracker): string {
  const tn = trackerName(tracker);
  switch (a) {
    case 'confirm': return '✓ Confirm';
    case 'push_tracker': return c.status === 'Suggested' ? `Confirm + add to ${tn}` : `Add to ${tn}`;
    case 'not_commitment': return 'Not a commitment';
    case 'drop': return kind === 'upstream_dropped' ? 'Drop mine too' : 'Drop';
    case 'done': return '✓ Mark done';
    case 'snooze': return ['due_tomorrow', 'due_today', 'overdue', 'heads_up', 'pre_meeting'].includes(kind) ? 'Need 1 more day' : 'Snooze 1 day';
    case 'accept': return 'Accept';
    case 'decline': return 'Decline';
    case 'keep_waiting': return 'Keep waiting';
    case 'edit_date': return 'Change date';
    case 'reassign': return 'Reassign';
  }
}

/** the facts shown under each commitment in a message */
export function itemFacts(c: Commitment, all: Commitment[], tracker: Tracker): [string, string][] {
  const dep = c.dep ? all.find(x => x.id === c.dep) : undefined;
  const blocks = all.filter(x => x.dep === c.id && isOpen(x));
  return ([
    ['Status', `${LABEL[c.status]} · ${isDate(c.due) ? `Due ${fmtD(c.due)}` : 'No date was said'}${c.movedFrom ? ` (moved from ${fmtD(c.movedFrom)})` : c.said && isDate(c.due) ? ` (said: "${c.said}")` : ''}`],
    ['Waits on', dep && isOpen(dep) ? `${firstName(dep.owner || 'unassigned')}: ${dep.text}` : ''],
    ['Blocks', blocks.length ? `${blocks.map(b => firstName(b.owner || 'someone')).join(', ')} ${blocks.length > 1 ? 'wait' : 'waits'} on this` : ''],
    [trackerName(tracker) || 'Tracker', c.trk ? `${c.trk}${c.trkClosed ? ' (closed)' : ''}` : ''],
    ['Note', c.status === 'PendingAccept' ? `Waiting for ${firstName(c.pending)} to accept` : ''],
  ] as [string, string][]).filter(x => x[1]);
}

/** the latest thing a person did (or that happened) to a commitment: "Confirmed by Arjun in Slack" */
const SYSTEM = /^(Reminder sent|Heads-up sent|Overdue message|Sent to |Found in the meeting|Linked to |Due-tomorrow reminder)/;
export function lastUpdate(c: Commitment): { at: string; text: string } | null {
  const e = [...c.history].reverse().find(([, x]) => !SYSTEM.test(x));
  if (!e) return null;
  return { at: e[0], text: e[1].split('. ')[0].replace(/\.$/, '') };
}

export function teamStats(rows: Commitment[], today: string) {
  const base = rows.filter(c => !c.parent && c.status !== 'NotCommitment');
  const resolved = base.filter(c => ['Done', 'Reassigned', 'Dropped'].includes(c.status)).length;
  return {
    total: base.length, resolved, remaining: base.length - resolved,
    overdue: base.filter(c => overdue(c, today)).length,
    unclaimed: base.filter(c => c.status === 'Unclaimed').length,
    rate: base.length ? Math.round(resolved / base.length * 100) : 0,
  };
}

/* ---------------- next-meeting recap (no names) ---------------- */
export interface RecapItem { id: string; text: string; state: string; }
export interface Recap { meeting: Meeting; done: RecapItem[]; open: RecapItem[]; unconfirmed: RecapItem[]; carried: number; }
/** What moved since `meeting`: every commitment from it, plus anything from earlier meetings of the
 *  same series that is still open. A handed-over item counts once (its newest owner's state).
 *  "Not a commitment" items are left out. Deliberately no owner names. */
export function buildRecap(meeting: Meeting, meetings: Meeting[], all: Commitment[], today: string): Recap {
  const earlier = meeting.series ? meetings.filter(m => m.teamId === meeting.teamId && m.series === meeting.series && m.id !== meeting.id && m.date <= meeting.date).map(m => m.id) : [];
  const latest = (c: Commitment): Commitment => { let x = c, g = 0; for (;;) { const ch = all.find(z => z.parent === x.id); if (!ch || g++ > 5) return x; x = ch; } };
  const roots = all.filter(c => !c.parent && (c.meetingId === meeting.id || earlier.includes(c.meetingId)));
  const done: RecapItem[] = [], open: RecapItem[] = [], unconfirmed: RecapItem[] = [];
  let carried = 0;
  for (const r of roots) {
    const c = latest(r);
    if (c.status === 'NotCommitment') continue;
    const fromEarlier = r.meetingId !== meeting.id;
    if (c.status === 'Done' || c.status === 'Dropped') { if (!fromEarlier) done.push({ id: r.id, text: r.text, state: c.status === 'Done' ? 'done' : 'dropped on purpose' }); continue; }
    const state = c.status === 'Waiting' ? 'waiting on another step' : c.status === 'Unclaimed' ? 'no owner yet' : c.status === 'PendingAccept' ? 'being handed over'
      : c.status === 'Suggested' ? 'not confirmed yet' : isDate(c.due) && c.due < today ? `past its date (${fmtD(c.due)})` : isDate(c.due) ? `in progress, due ${fmtD(c.due)}` : 'in progress';
    if (fromEarlier) carried++;
    const item = { id: r.id, text: r.text + (fromEarlier ? ' (from an earlier meeting)' : ''), state };
    // no confirmed owner (named but not confirmed, or nobody named): the manager assigns these
    if (c.status === 'Suggested' || c.status === 'Unclaimed') unconfirmed.push({ ...item, state: c.status === 'Unclaimed' ? 'nobody named' : 'named owner has not confirmed' });
    else open.push(item);
  }
  return { meeting, done, open, unconfirmed, carried };
}
