// The next meeting of a series, in three moments (Fred is Fireflies' notetaker; he joins the call
// from the calendar as a participant, so he can type in the meeting chat like anyone else):
//  1. 30 minutes before it starts: a pre-read in the team's Slack channel (#release-sync): from our
//     last meeting, what is completed, what is remaining and what needs an owner. Titles only, no
//     names. The manager gets a private card to assign what has no confirmed owner (Slack picker;
//     the dashboard and Jira work too; items nobody owns get an unassigned Jira issue).
//  2. 2 minutes after it starts: Fred reads the latest status from the database and posts it in the
//     meeting chat (Teams, Meet or Zoom). When someone joins later, he posts it in the chat again.
//  3. When it ends: Fireflies' AI summary of this meeting comes in. Its commitments go to the channel
//     as "Upcoming commitments from <meeting> (<date>)" (titles and due dates, no names), and each
//     owner gets their private card to confirm, exactly like any imported meeting.
// In the prototype the calendar and the call are stand-ins: the manager presses the steps on the
// meeting page, and the meeting chat is the meeting window shown in the app.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ctx, trackerCreate } from './engine.ts';
import { importMeeting, validate } from './importMeeting.ts';
import { type ChatEvent, type Commitment, type Meeting, type MeetingLive, buildRecap, firstName } from '../../../shared/core.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const NEXT_MEETING_SAMPLE = join(here, '../../../database/sample-meetings/release-sync-checkin.json');
export const FRED_DELAY_MIN = 2;

const latest = (ctx: Ctx, c: Commitment): Commitment => { let x = c, g = 0; for (;;) { const ch = ctx.w.commitments.find(z => z.parent === x.id); if (!ch || g++ > 5) return x; x = ch; } };
const addMin = (t: string, n: number) => new Date(new Date(t + ':00Z').getTime() + n * 60000).toISOString().slice(0, 16);

function save(ctx: Ctx, m: Meeting, live: MeetingLive | null) {
  m.live = live;
  ctx.meetingPatch.set(m.id, { ...(ctx.meetingPatch.get(m.id) || {}), live });
}
const liveOf = (m: Meeting): MeetingLive => m.live ? { ...m.live, people: [...(m.live.people || [])], chat: [...(m.live.chat || [])] } : { people: [], chat: [] };

/** 1. 30 minutes before: the pre-read in the channel, and the manager's assign card */
export async function preRead(ctx: Ctx, m: Meeting): Promise<{ done: number; remaining: number; need: number; jira: string[] }> {
  const r = buildRecap(m, ctx.w.meetings, ctx.w.commitments, ctx.today());
  const ids = [...r.done, ...r.open, ...r.unconfirmed].map(x => x.id);
  if (ids.length) ctx.send('Team', 'recap', ids, { meetingId: m.id, phase: 'pre' });
  const need = r.unconfirmed.map(x => latest(ctx, ctx.byId(x.id)!));
  const jira: string[] = [];
  if (need.length) {
    const t = ctx.team(need[0]);
    for (const c of need.filter(x => x.status === 'Unclaimed' && !x.trk && t.tracker === 'jira')) {
      const k = await trackerCreate(ctx, c);
      if (k) { jira.push(k); ctx.log(c, `Added to Jira (${k}) without an owner, so the manager can assign it there too`); }
    }
    ctx.send(t.manager, 'assign_request', need.map(c => c.id), { meetingId: m.id });
    need.forEach(c => ctx.log(c, `Before the next meeting, Fred asked ${firstName(t.manager)} to assign this`));
  }
  const live = liveOf(m);
  save(ctx, m, { ...live, preAt: ctx.now, startsAt: addMin(ctx.now, 30) });
  return { done: r.done.length, remaining: r.open.length, need: need.length, jira };
}

/** 2a. the meeting starts: Fred and the manager are in the call; Fred posts 2 minutes in */
export function startMeeting(ctx: Ctx, m: Meeting) {
  const t = ctx.w.teams.find(x => x.id === m.teamId)!;
  const live = liveOf(m);
  save(ctx, m, { ...live, startAt: ctx.now, fredAt: '', endedAt: '', people: [{ name: 'Fred (Fireflies)', at: ctx.now }, { name: t.manager, at: ctx.now }],
    chat: [{ at: ctx.now, type: 'join', who: 'Fred (Fireflies)' }, { at: ctx.now, type: 'join', who: t.manager }] });
}

/** the status right now, from the database, as Fred types it in the meeting chat */
function fredLine(ctx: Ctx, m: Meeting, why: string): ChatEvent {
  const r = buildRecap(m, ctx.w.meetings, ctx.w.commitments, ctx.today());
  return { at: ctx.now, type: 'fred', who: 'Fred (Fireflies)', text: why, recap: { done: r.done, open: r.open, need: r.unconfirmed } };
}

/** 2b. Fred's post in the meeting chat (2 minutes after the start, or now from the demo button) */
export function fredPosts(ctx: Ctx, m: Meeting): boolean {
  const live = liveOf(m);
  if (!live.startAt || live.endedAt || live.fredAt) return false;
  live.chat.push(fredLine(ctx, m, `Hi all, Fred here. Status since "${m.title}" (straight from Fireflies, as of now):`));
  save(ctx, m, { ...live, fredAt: ctx.now });
  return true;
}

/** 2c. someone joins: after Fred's first post, he posts the latest status again for them */
export function joins(ctx: Ctx, m: Meeting, person: string): 'joined' | 'reposted' | 'already' {
  const live = liveOf(m);
  if (!live.startAt || live.endedAt) throw new Error('Start the meeting first.');
  if (live.people.some(p => p.name === person)) return 'already';
  live.people.push({ name: person, at: ctx.now });
  live.chat.push({ at: ctx.now, type: 'join', who: person });
  let out: 'joined' | 'reposted' = 'joined';
  if (live.fredAt) { live.chat.push(fredLine(ctx, m, `Welcome ${firstName(person)}! Here is the status again for everyone who just joined:`)); out = 'reposted'; }
  save(ctx, m, live);
  return out;
}

/** 3. the meeting ends: Fireflies' summary of it comes in, the channel gets the upcoming commitments,
 *  and each owner gets their card (the import does that) */
export async function endMeeting(ctx: Ctx, m: Meeting): Promise<{ meetingId: string; count: number; owners: number }> {
  const live = liveOf(m);
  if (!live.startAt || live.endedAt) throw new Error('Start the meeting first.');
  const f = validate(JSON.parse(readFileSync(NEXT_MEETING_SAMPLE, 'utf8')));
  f.series = m.series || f.series; f.team = m.teamId;
  f.start_time = live.startAt.slice(11, 16);
  f.duration_mins = Math.max(5, Math.round((new Date(ctx.now + ':00Z').getTime() - new Date(live.startAt + ':00Z').getTime()) / 60000));
  if (live.startAt.slice(0, 10) !== ctx.today()) f.start_time = undefined as unknown as string;
  const r = await importMeeting(ctx, f);
  const ids = ctx.w.commitments.filter(c => c.meetingId === r.meetingId).map(c => c.id);
  if (ids.length) ctx.send('Team', 'upcoming', ids, { meetingId: r.meetingId });
  live.chat.push({ at: ctx.now, type: 'note', text: 'Meeting ended. Fireflies is writing the summary; the commitments go to the team channel and each owner gets theirs privately.' });
  save(ctx, m, { ...live, endedAt: ctx.now, nextMeetingId: r.meetingId });
  return r;
}

/** the scheduler and the 2-minute timer: post for every running meeting whose 2 minutes are up */
export function dueFredPosts(ctx: Ctx): number {
  let n = 0;
  for (const m of ctx.w.meetings) {
    const l = m.live;
    if (l?.startAt && !l.endedAt && !l.fredAt && ctx.now >= addMin(l.startAt, FRED_DELAY_MIN) && fredPosts(ctx, m)) n++;
  }
  return n;
}
