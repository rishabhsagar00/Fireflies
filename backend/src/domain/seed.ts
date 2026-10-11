// "Reset demo": recreates the demo organisation (8 teams, 9 past meetings) with every date moved
// so that the demo day is today, and sets the demo clock to the real time now (10:15 AM at the
// earliest, so the seeded history of this morning is already in the past).
import { pool, upsertCommitments } from '../db.ts';
import { setNow } from './clock.ts';
import { config } from '../config.ts';
import { TEAMS, MEMBERS, MEETINGS, SEED, SEED_NOW } from './seedData.ts';
import { newToken } from './engine.ts';
import { type Commitment, type Status, addDays, chName, daysBetween, firstName, fmtD, isDate } from '../../../shared/core.ts';

const endTime = (m: { date: string; start: string; mins: number }) => {
  const [H, M] = (m.start || '10:00').split(':').map(Number); const t = H * 60 + M + (m.mins || 30) + 5;
  return `${m.date}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export async function resetDemo() {
  const realNow = new Date(Date.now() + config.tzOffsetMinutes * 60000).toISOString().slice(0, 16);
  const realToday = realNow.slice(0, 10);
  const shift = daysBetween(SEED_NOW.slice(0, 10), realToday);
  const sd = (d: string) => isDate(d) ? addDays(d, shift) : d;
  const st = (t: string) => t ? sd(t.slice(0, 10)) + t.slice(10) : t;
  const seedNow = st(SEED_NOW);
  const demoNow = realNow > seedNow ? realNow : seedNow;

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('delete from messages; delete from commitments; delete from meetings; delete from members; delete from teams;');
    await client.query(`delete from app_state where key like 'counter:%'`);
    for (const t of TEAMS) await client.query('insert into teams (id,name,channel,tracker,tracker_key,manager,sort) values ($1,$2,$3,$4,$5,$6,$7)', [t.id, t.name, t.channel, t.tracker, t.trackerKey, t.manager, t.sort]);
    for (const m of MEMBERS) await client.query('insert into members (team_id,name,email,sort) values ($1,$2,$3,$4)', [m.teamId, m.name, m.email, m.sort]);
    for (const m of MEETINGS) await client.query('insert into meetings (id,team_id,title,date,start_time,mins,overview,keywords,lines,source) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [m.id, m.team, m.title, sd(m.date), m.start, m.mins, JSON.stringify(m.overview), JSON.stringify(m.keywords), JSON.stringify(m.lines), 'seed']);

    const C: Commitment[] = SEED.map((s, i) => {
      const m = MEETINGS.find(x => x.id === s.m)!, t = TEAMS.find(x => x.id === m.team)!, end = st(endTime(m));
      const quote = (m.lines[s.q]?.[2] || '').replace(/<\/?mark>/g, '');
      const hist: [string, string][] = [[end, 'Found in the meeting by Fireflies AI' + (s.said ? ` (said: "${s.said}")` : '')]];
      hist.push([end, s.owner ? `Sent to ${firstName(s.owner)} ${chName(t.channel)} for confirmation` : 'No owner named. Listed under "Needs an owner"']);
      return {
        id: s.id, meetingId: s.m, teamId: m.team, seq: i, text: s.text, owner: s.owner, pending: s.pending || '', said: s.said, due: sd(s.due),
        dep: s.dep || '', status: s.status as Status, prevStatus: '', trk: s.trk || '', trkClosed: !!s.trkClosed, quote,
        history: hist.concat((s.h || []).map(([a, b]) => [st(a), b] as [string, string])), tlog: [], sent: s.sent || [], snooze: 0, bounces: 0,
        sentAt: end, pendingAt: '', movedFrom: '', lastVia: '', lastAt: '', parent: '', token: newToken(),
      };
    });
    // a pending hand-over keeps its time; every other open commitment starts unconfirmed, for every person
    for (const c of C) {
      if (c.status === 'PendingAccept') { c.pendingAt = demoNow; c.prevStatus = 'Confirmed'; }
      if (c.status === 'Confirmed' || c.status === 'Waiting') { c.status = 'Suggested'; c.history = c.history.slice(0, 2); c.trk = ''; c.trkClosed = false; c.sent = []; }
      // cards were (re)sent this morning, so confirmation nudges start 24 hours from now
      if (c.status === 'Suggested') { c.sentAt = demoNow; c.sent = c.sent.filter(x => x !== 'confirm'); }
      const u = c.dep ? C.find(x => x.id === c.dep) : undefined;
      if (u) c.history.splice(1, 0, [c.history[0][0], `Linked to ${firstName(u.owner)}'s "${u.text}" because ${firstName(c.owner)} said: "${c.quote}"`]);
      const last = [...c.history].reverse().find(([, x]) => /( in Slack| in Teams| by email|Synced back|from the)/.test(x) && !/^Sent to|^Reminder|^Overdue/.test(x));
      if (last) { c.lastAt = last[0]; c.lastVia = /Jira/.test(last[1]) ? 'Jira' : /Asana/.test(last[1]) ? 'Asana' : / in Slack/.test(last[1]) ? 'Slack' : / in Teams/.test(last[1]) ? 'Teams' : / by email/.test(last[1]) ? 'Email' : 'Fireflies'; }
      if (c.trk) {
        const made = c.history.find(([, x]) => /added to/.test(x));
        c.tlog = [[made ? made[0] : c.sentAt, `Created by Fireflies · assignee ${c.owner} · due ${fmtD(c.due)} (demo history)`]];
        if (c.trkClosed) c.tlog.push([c.history[c.history.length - 1][0], c.status === 'Done' ? 'Moved to Done' : 'Closed']);
      }
    }
    await upsertCommitments(C, client);

    await client.query('commit');
  } catch (e) {
    await client.query('rollback'); throw e;
  } finally { client.release(); }
  await setNow(demoNow);
  return demoNow;
}
