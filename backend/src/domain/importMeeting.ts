// Imports a meeting in the format Fireflies already produces (title, summary, transcript
// sentences, action items with owner and spoken due date). See database/sample-meetings/.
// Fireflies' own AI did the extraction; this only turns the action items into commitments
// and sends each owner a card to confirm.
import { pool } from '../db.ts';
import { Ctx, newToken } from './engine.ts';
import { type Commitment, addDays, chName, firstName, isDate } from '../../../shared/core.ts';

export interface FirefliesMeeting {
  title: string; team: string; series?: string; date?: string; start_time?: string; duration_mins?: number; participants?: string[];
  summary?: { overview?: string[]; keywords?: string[] };
  sentences?: { time?: string; speaker_name: string; text: string }[];
  action_items: { text: string; owner?: string | null; due_said?: string; due_in_days?: number | null; due_date?: string; depends_on?: number | null; sentence?: number | null }[];
}

export function validate(x: any): FirefliesMeeting {
  if (!x || typeof x !== 'object') throw new Error('The file is not valid JSON.');
  if (!x.title || typeof x.title !== 'string') throw new Error('Missing "title".');
  if (!x.team || typeof x.team !== 'string') throw new Error('Missing "team" (a team id such as "product").');
  if (!Array.isArray(x.action_items) || !x.action_items.length) throw new Error('Missing "action_items".');
  x.action_items.forEach((a: any, i: number) => { if (!a?.text) throw new Error(`action_items[${i}] has no "text".`); });
  return x as FirefliesMeeting;
}

export async function importMeeting(ctx: Ctx, f: FirefliesMeeting) {
  const team = ctx.w.teams.find(t => t.id === f.team);
  if (!team) throw new Error(`Unknown team "${f.team}". Use one of: ${ctx.w.teams.map(t => t.id).join(', ')}.`);
  const today = ctx.today();
  const date = !f.date || f.date === 'today' ? today : isDate(f.date) ? f.date : today;
  const id = 'imp' + Date.now().toString(36);
  // held today: if the file's start time is later than "now", it starts so that it has just ended
  const mins = f.duration_mins || 30, nowMin = Number(ctx.now.slice(11, 13)) * 60 + Number(ctx.now.slice(14, 16));
  let start = /^\d{2}:\d{2}$/.test(f.start_time || '') ? f.start_time! : ctx.now.slice(11, 16);
  if (date === today && Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + mins > nowMin) {
    const s = Math.max(0, nowMin - mins); start = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  const lines = (f.sentences || []).map(s => [s.time || '', s.speaker_name, s.text] as [string, string, string]);
  const members = ctx.members(team.id);
  const series = String(f.series || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  await pool.query('insert into meetings (id,team_id,title,date,start_time,mins,overview,keywords,lines,source,series) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [id, team.id, f.title, date, start, mins, JSON.stringify(f.summary?.overview || []), JSON.stringify(f.summary?.keywords || []), JSON.stringify(lines), 'import', series]);
  ctx.w.meetings.unshift({ id, teamId: team.id, title: f.title, date, startTime: start, mins, overview: f.summary?.overview || [], keywords: f.summary?.keywords || [], lines, source: 'import', series, nextAt: '', nextTopic: '', nudgedAt: '', recappedAt: '' });

  const created: Commitment[] = f.action_items.map((a, i) => {
    const owner = a.owner && members.includes(a.owner) ? a.owner : '';
    const due = isDate(a.due_date) ? a.due_date! : typeof a.due_in_days === 'number' ? addDays(date, a.due_in_days) : '';
    const quote = (a.sentence != null && lines[a.sentence] ? lines[a.sentence][2] : '').replace(/<\/?mark>/g, '');
    const hist: [string, string][] = [[ctx.now, 'Found in the meeting by Fireflies AI' + (a.due_said ? ` (said: "${a.due_said}")` : '')]];
    if (a.owner && !owner) hist.push([ctx.now, `"${a.owner}" is not in ${team.name}, so this has no owner yet`]);
    hist.push([ctx.now, owner ? `Sent to ${firstName(owner)} ${chName(team.channel)} for confirmation` : 'No owner named. Listed under "Needs an owner"']);
    return {
      id: `${id}-${i + 1}`, meetingId: id, teamId: team.id, seq: i, text: a.text, owner, pending: '', said: a.due_said || '', due,
      dep: '', status: owner ? 'Suggested' : 'Unclaimed', prevStatus: '', trk: '', trkClosed: false, quote, history: hist, tlog: [],
      sent: [], snooze: 0, bounces: 0, sentAt: ctx.now, pendingAt: '', movedFrom: '', lastVia: '', lastAt: '', parent: '', token: newToken(),
    };
  });
  f.action_items.forEach((a, i) => {
    const u = typeof a.depends_on === 'number' ? created[a.depends_on] : undefined;
    if (!u || u === created[i]) return;
    const c = created[i]; c.dep = u.id;
    c.history.splice(1, 0, [ctx.now, `Linked to ${firstName(u.owner) || 'the'}'s "${u.text}" because ${firstName(c.owner) || 'the speaker'} said: "${c.quote}"`.replace(" the's", ' the step')]);
  });
  for (const c of created) { ctx.w.commitments.push(c); ctx.touch(c); }
  for (const o of [...new Set(created.filter(c => c.owner).map(c => c.owner))]) ctx.send(o, 'card', created.filter(c => c.owner === o).map(c => c.id));
  const unowned = created.filter(c => !c.owner);
  if (unowned.length) ctx.send(team.manager, 'info', [unowned[0].id], { title: `${unowned.length} commitment${unowned.length > 1 ? 's' : ''} from "${f.title}" need${unowned.length > 1 ? '' : 's'} an owner`, note: `nobody took ${unowned.map(c => `"${c.text}"`).join(', ')} in "${f.title}". Can you assign ${unowned.length > 1 ? 'them' : 'it'}? Open Commitments → Needs an owner.` });
  return { meetingId: id, count: created.length, owners: new Set(created.map(c => c.owner).filter(Boolean)).size };
}
