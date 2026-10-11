import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config.ts';
import type { Commitment, Meeting, Member, Message, Team, Routing } from '../../shared/core.ts';

if (!config.databaseUrl) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and set it.');

const local = /localhost|127\.0\.0\.1/.test(config.databaseUrl);
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: local ? false : { rejectUnauthorized: false },
  max: 5,
});

const here = dirname(fileURLToPath(import.meta.url));
export async function migrate() {
  const sql = readFileSync(join(here, '../../database/schema.sql'), 'utf8');
  await pool.query(sql);
}

/* ---------- row mapping (snake_case in Postgres, camelCase in code) ---------- */
const teamFrom = (r: any): Team => ({ id: r.id, name: r.name, channel: r.channel, tracker: r.tracker, trackerKey: r.tracker_key, manager: r.manager, sort: r.sort });
const memberFrom = (r: any): Member => ({ teamId: r.team_id, name: r.name, email: r.email, sort: r.sort });
const meetingFrom = (r: any): Meeting => ({ id: r.id, teamId: r.team_id, title: r.title, date: r.date, startTime: r.start_time, mins: r.mins, overview: r.overview, keywords: r.keywords, lines: r.lines, source: r.source,
  series: r.series || '', nextAt: r.next_at || '', nextTopic: r.next_topic || '', live: (() => { try { return r.live ? JSON.parse(r.live) : null; } catch { return null; } })(), nudgedAt: r.nudged_at || '', recappedAt: r.recapped_at || '' });
const commitmentFrom = (r: any): Commitment => ({
  id: r.id, meetingId: r.meeting_id, teamId: r.team_id, seq: r.seq, text: r.text, owner: r.owner, pending: r.pending,
  said: r.said, due: r.due, dep: r.dep, status: r.status, prevStatus: r.prev_status, trk: r.trk, trkClosed: r.trk_closed,
  quote: r.quote, history: r.history, tlog: r.tlog, sent: r.sent, snooze: r.snooze, bounces: r.bounces, sentAt: r.sent_at,
  pendingAt: r.pending_at, movedFrom: r.moved_from, lastVia: r.last_via, lastAt: r.last_at, parent: r.parent, token: r.token,
});
export const messageFrom = (r: any): Message => ({ id: r.id, toName: r.to_name, kind: r.kind, cids: r.cids, at: r.at, meetingId: r.meeting_id, extra: r.extra, channel: r.channel, delivery: r.delivery, delivered: r.delivered });

export interface World { teams: Team[]; members: Member[]; meetings: Meeting[]; commitments: Commitment[]; }

export async function loadWorld(): Promise<World> {
  const [t, m, mt, c] = await Promise.all([
    pool.query('select * from teams order by sort'),
    pool.query('select * from members order by team_id, sort'),
    pool.query('select * from meetings order by date desc, start_time desc'),
    pool.query('select * from commitments order by meeting_id, seq, id'),
  ]);
  return { teams: t.rows.map(teamFrom), members: m.rows.map(memberFrom), meetings: mt.rows.map(meetingFrom), commitments: c.rows.map(commitmentFrom) };
}

export async function loadMessages(limit = 400): Promise<Message[]> {
  const r = await pool.query('select * from messages order by id desc limit $1', [limit]);
  return r.rows.map(messageFrom);
}
export async function getMessage(id: number): Promise<Message | null> {
  const r = await pool.query('select * from messages where id = $1', [id]);
  return r.rows[0] ? messageFrom(r.rows[0]) : null;
}

const C_COLS = ['id', 'meeting_id', 'team_id', 'seq', 'text', 'owner', 'pending', 'said', 'due', 'dep', 'status', 'prev_status', 'trk', 'trk_closed', 'quote', 'history', 'tlog', 'sent', 'snooze', 'bounces', 'sent_at', 'pending_at', 'moved_from', 'last_via', 'last_at', 'parent', 'token'];
const cValues = (c: Commitment) => [c.id, c.meetingId, c.teamId, c.seq, c.text, c.owner, c.pending, c.said, c.due, c.dep, c.status, c.prevStatus, c.trk, c.trkClosed, c.quote,
  JSON.stringify(c.history), JSON.stringify(c.tlog), JSON.stringify(c.sent), c.snooze, c.bounces, c.sentAt, c.pendingAt, c.movedFrom, c.lastVia, c.lastAt, c.parent, c.token];

export async function upsertCommitments(rows: Commitment[], client: pg.PoolClient | pg.Pool = pool) {
  for (const c of rows) {
    const ph = C_COLS.map((_, i) => `$${i + 1}`).join(',');
    const upd = C_COLS.filter(k => k !== 'id').map(k => `${k} = excluded.${k}`).join(', ');
    await client.query(`insert into commitments (${C_COLS.join(',')}) values (${ph}) on conflict (id) do update set ${upd}, updated_at = now()`, cValues(c));
  }
}

export async function insertMessage(m: Omit<Message, 'id' | 'delivery' | 'delivered'>): Promise<Message> {
  const r = await pool.query(
    'insert into messages (to_name, kind, cids, at, meeting_id, extra, channel) values ($1,$2,$3,$4,$5,$6,$7) returning *',
    [m.toName, m.kind, JSON.stringify(m.cids), m.at, m.meetingId, JSON.stringify(m.extra || {}), m.channel]);
  return messageFrom(r.rows[0]);
}
export async function setDelivery(id: number, delivery: string, delivered: boolean, slack?: { channel: string; ts: string }) {
  await pool.query('update messages set delivery = $2, delivered = $3, slack_channel = coalesce($4, slack_channel), slack_ts = coalesce($5, slack_ts) where id = $1',
    [id, delivery, delivered, slack?.channel ?? null, slack?.ts ?? null]);
}
export async function getSlackRef(id: number): Promise<{ channel: string; ts: string } | null> {
  const r = await pool.query('select slack_channel, slack_ts from messages where id = $1', [id]);
  return r.rows[0]?.slack_ts ? { channel: r.rows[0].slack_channel, ts: r.rows[0].slack_ts } : null;
}

/* ---------- small settings ---------- */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const r = await pool.query('select value from app_state where key = $1', [key]);
  return r.rows[0] ? (r.rows[0].value as T) : fallback;
}
export async function setSetting(key: string, value: unknown) {
  await pool.query('insert into app_state (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value', [key, JSON.stringify(value)]);
}
export async function getRouting(): Promise<Routing> {
  return getSetting<Routing>('routing', { slackUserId: config.demoSlackUserId, email: config.demoEmail });
}
/** ids of messages already in Slack that show any of these commitments (newest first) */
export async function slackMessageIdsFor(cids: string[]): Promise<number[]> {
  if (!cids.length) return [];
  const r = await pool.query('select id from messages where slack_ts is not null and cids ?| $1::text[] order by id desc limit 50', [cids]);
  return r.rows.map(x => Number(x.id));
}
/** commitments someone was already told about (first card, hand-over request, or the manager's "needs an owner") */
export async function deliveredCardCids(): Promise<Set<string>> {
  const r = await pool.query(`select cids from messages where delivered and kind in ('card','reassign_request','info')`);
  return new Set(r.rows.flatMap(x => x.cids as string[]));
}
/** next meeting time and recap state of a meeting */
export async function updateMeeting(id: string, p: { live?: unknown; nextAt?: string; nextTopic?: string; nudgedAt?: string; recappedAt?: string; series?: string }) {
  const cols: [string, unknown][] = [];
  if (p.nextAt !== undefined) cols.push(['next_at', p.nextAt]);
  if (p.nextTopic !== undefined) cols.push(['next_topic', p.nextTopic]);
  if (p.live !== undefined) cols.push(['live', p.live ? JSON.stringify(p.live) : '']);
  if (p.nudgedAt !== undefined) cols.push(['nudged_at', p.nudgedAt]);
  if (p.recappedAt !== undefined) cols.push(['recapped_at', p.recappedAt]);
  if (p.series !== undefined) cols.push(['series', p.series]);
  if (!cols.length) return;
  await pool.query(`update meetings set ${cols.map(([c], i) => `${c} = $${i + 2}`).join(', ')} where id = $1`, [id, ...cols.map(([, v]) => v)]);
}
/** teams whose messages really go out to Slack / Teams / email (others stay in the app preview) */
export async function getLiveTeams(): Promise<string[]> {
  const v = await getSetting<string[] | null>('liveTeams', null);
  if (v) return v;
  // until someone chooses in Settings, only the demo team sends real messages; the other demo teams
  // are background data, and their reminders are logged in the app but not sent to Slack, Teams or email
  const r = await pool.query('select id from teams order by sort');
  const ids = r.rows.map(x => x.id as string);
  return ids.includes('product') ? ['product'] : ids.slice(0, 1);
}
export async function nextCounter(name: string, start: number): Promise<number> {
  const r = await pool.query(
    `insert into app_state (key, value) values ($1, to_jsonb($2::int)) on conflict (key) do update set value = to_jsonb((app_state.value)::text::int + 1) returning value`,
    ['counter:' + name, start]);
  return Number(r.rows[0].value);
}
export async function updateTeam(id: string, patch: { channel?: string; tracker?: string }) {
  if (patch.channel) await pool.query('update teams set channel = $2 where id = $1', [id, patch.channel]);
  if (patch.tracker) await pool.query('update teams set tracker = $2 where id = $1', [id, patch.tracker]);
}
