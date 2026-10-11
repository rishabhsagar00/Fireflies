// Turns a notification into a Slack Block Kit message, a Teams Adaptive Card or an HTML email.
// Every channel shows the same buttons (shared/core.ts messageActions). Slack buttons call
// /api/slack/interactions; Teams and email buttons open the app's /act page with a secret token.
import {
  type Commitment, type Message, type Team, type Member,
  actionLabel, firstName, greeting, fmtD, fmtDLong, isOpen, itemFacts, LABEL, messageActions, messageTitle, teamStats, overdue, isDate, buildRecap,
} from '../../../shared/core.ts';
import type { World } from '../db.ts';

type Msg = Pick<Message, 'id' | 'toName' | 'kind' | 'cids' | 'extra' | 'at'>;
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
const slackEsc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function parts(m: Msg, w: World) {
  const rows = m.kind === 'info' ? [] : m.cids.map(id => w.commitments.find(c => c.id === id)).filter(Boolean) as Commitment[];
  const c0 = w.commitments.find(c => c.id === m.cids[0]);
  const team = w.teams.find(t => t.id === c0?.teamId) as Team;
  const person = w.members.find(p => p.teamId === team?.id && p.name === m.toName);
  const [title, sub] = messageTitle(m, w.commitments, w.meetings);
  const hello = greeting(m, w.commitments, w.meetings);
  return { rows, team, person, title, sub, hello };
}
export const actionLink = (base: string, m: Msg, c: Commitment, a: string) =>
  `${base}/act?m=${m.id}&c=${encodeURIComponent(c.id)}&a=${a}&t=${c.token}`;

/* ======================= MEETING RECAP (no names) ======================= */
// The pre-read, posted in the team channel 30 minutes before the next meeting of the series: from our
// last meeting, completed, remaining and needs-an-owner, by title only. (In the meeting itself Fred
// types the same status into the meeting chat; that happens in the call, not through this.)
function recapData(m: Msg, w: World) {
  const mt = w.meetings.find(x => x.id === m.extra?.meetingId) || w.meetings.find(x => x.id === w.commitments.find(c => c.id === m.cids[0])?.meetingId);
  if (!mt) return null;
  return buildRecap(mt, w.meetings, w.commitments, m.at.slice(0, 10));
}
function slackRecap(m: Msg, w: World) {
  const r = recapData(m, w); const [title] = messageTitle(m, w.commitments, w.meetings);
  if (!r) return { text: title, blocks: [] };
  const list = (xs: { text: string; state: string }[], mark: string) => xs.map(x => `${mark} ${slackEsc(x.text)}  _· ${slackEsc(x.state)}_`).join('\n') || '_none_';
  const blocks: any[] = [
    { type: 'header', text: { type: 'plain_text', text: title.slice(0, 150), emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: slackEsc(greeting(m, w.commitments, w.meetings)) } },
    { type: 'section', fields: [{ type: 'mrkdwn', text: `:white_check_mark: *Completed: ${r.done.length}*` }, { type: 'mrkdwn', text: `:hourglass_flowing_sand: *Remaining: ${r.open.length}*` }, { type: 'mrkdwn', text: `:raising_hand: *Needs an owner: ${r.unconfirmed.length}*` }] },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: `*Completed*\n${list(r.done, ':white_check_mark:')}` } },
    { type: 'section', text: { type: 'mrkdwn', text: `*Remaining*\n${list(r.open, ':small_orange_diamond:')}` } },
    { type: 'section', text: { type: 'mrkdwn', text: `*Needs an owner*${r.unconfirmed.length ? '  _(the manager will assign these)_' : ''}\n${list(r.unconfirmed, ':raising_hand:')}` } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `Posted by Fred (Fireflies) 30 minutes before the meeting · in the meeting he posts the latest status in the meeting chat · no owner names` }] },
  ];
  return { text: `${title}: ${r.done.length} completed, ${r.open.length} remaining, ${r.unconfirmed.length} need an owner`, blocks };
}

/* ======================= UPCOMING COMMITMENTS (no names) ======================= */
// Posted in the team channel when a meeting ends: its commitments by title and due date. Each owner
// gets their own card privately (the usual flow).
function upcomingRows(m: Msg, w: World) {
  return m.cids.map(id => w.commitments.find(c => c.id === id)).filter((c): c is Commitment => !!c && c.status !== 'NotCommitment')
    .sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9')));
}
function slackUpcoming(m: Msg, w: World) {
  const [title] = messageTitle(m, w.commitments, w.meetings); const rows = upcomingRows(m, w);
  const lines = rows.map(c => `:small_blue_diamond: ${slackEsc(c.text)}  _· due ${isDate(c.due) ? fmtD(c.due) : 'no date yet'}_`).join('\n') || '_none_';
  const blocks: any[] = [
    { type: 'header', text: { type: 'plain_text', text: title.slice(0, 150), emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: slackEsc(greeting(m, w.commitments, w.meetings)) } },
    { type: 'section', text: { type: 'mrkdwn', text: lines } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: `From Fireflies' summary of the meeting · ${rows.length} commitment${rows.length === 1 ? '' : 's'} · no owner names` }] },
  ];
  return { text: `${title}: ${rows.map(c => c.text).join('; ')}`.slice(0, 2900), blocks };
}
function teamsUpcoming(m: Msg, w: World) {
  const [title] = messageTitle(m, w.commitments, w.meetings);
  return { $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4', msteams: { width: 'Full' }, body: [
    { type: 'Container', style: 'accent', bleed: true, items: [{ type: 'TextBlock', text: 'FIREFLIES · UPCOMING COMMITMENTS', size: 'Small', weight: 'Bolder' }, { type: 'TextBlock', text: title, size: 'Large', weight: 'Bolder', wrap: true }, { type: 'TextBlock', text: greeting(m, w.commitments, w.meetings), wrap: true }] },
    ...upcomingRows(m, w).map(c => ({ type: 'TextBlock', text: `🔹 ${c.text} · due ${isDate(c.due) ? fmtD(c.due) : 'no date yet'}`, wrap: true, spacing: 'Small' })),
  ] };
}
function emailUpcoming(m: Msg, w: World) {
  const [title] = messageTitle(m, w.commitments, w.meetings);
  const li = upcomingRows(m, w).map(c => `<div style="font-size:15px;color:#141A2E;padding:6px 0;border-top:1px solid #EEEAE0">🔹 ${esc(c.text)} <span style="color:#8A8EA0">· due ${isDate(c.due) ? fmtD(c.due) : 'no date yet'}</span></div>`).join('');
  return { subject: title, html: shell(`<tr><td style="padding:22px 24px"><div style="font-size:22px;font-weight:700;color:#141A2E">${esc(title)}</div><div style="font-size:15px;color:#3D4459;margin-top:8px">${esc(greeting(m, w.commitments, w.meetings))}</div><div style="margin-top:14px">${li}</div></td></tr>`, 'From Fireflies\' summary of the meeting · no owner names') };
}
function teamsRecap(m: Msg, w: World) {
  const r = recapData(m, w); const [title] = messageTitle(m, w.commitments, w.meetings);
  const line = (x: { text: string; state: string }, mark: string) => ({ type: 'TextBlock', text: `${mark} ${x.text} · ${x.state}`, wrap: true, spacing: 'Small' });
  const body: any[] = [{ type: 'Container', style: 'accent', bleed: true, items: [
    { type: 'TextBlock', text: 'FIREFLIES · MEETING RECAP', size: 'Small', weight: 'Bolder' },
    { type: 'TextBlock', text: title, size: 'Large', weight: 'Bolder', wrap: true },
    { type: 'TextBlock', text: greeting(m, w.commitments, w.meetings), wrap: true }] }];
  if (r) {
    body.push({ type: 'ColumnSet', columns: [
      { type: 'Column', items: [{ type: 'TextBlock', text: `✅ Completed: ${r.done.length}`, weight: 'Bolder', size: 'Medium' }] },
      { type: 'Column', items: [{ type: 'TextBlock', text: `⏳ Remaining: ${r.open.length}`, weight: 'Bolder', size: 'Medium' }] },
      { type: 'Column', items: [{ type: 'TextBlock', text: `🙋 Needs an owner: ${r.unconfirmed.length}`, weight: 'Bolder', size: 'Medium', wrap: true }] }] });
    body.push({ type: 'Container', style: 'emphasis', items: [{ type: 'TextBlock', text: 'Completed', weight: 'Bolder' }, ...(r.done.length ? r.done.map(x => line(x, '✅')) : [{ type: 'TextBlock', text: 'none', isSubtle: true }])] });
    body.push({ type: 'Container', style: 'emphasis', items: [{ type: 'TextBlock', text: 'Remaining', weight: 'Bolder' }, ...(r.open.length ? r.open.map(x => line(x, '🔸')) : [{ type: 'TextBlock', text: 'none', isSubtle: true }])] });
    body.push({ type: 'Container', style: 'emphasis', items: [{ type: 'TextBlock', text: 'Needs an owner (the manager will assign these)', weight: 'Bolder', wrap: true }, ...(r.unconfirmed.length ? r.unconfirmed.map(x => line(x, '🙋')) : [{ type: 'TextBlock', text: 'none', isSubtle: true }])] });
    body.push({ type: 'TextBlock', text: `From "${r.meeting.title}" on ${fmtD(r.meeting.date)} · no owner names`, size: 'Small', isSubtle: true, wrap: true });
  }
  return { $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4', msteams: { width: 'Full' }, body };
}
function emailRecap(m: Msg, w: World) {
  const r = recapData(m, w); const [title] = messageTitle(m, w.commitments, w.meetings);
  const li = (xs: { text: string; state: string }[], mark: string) => xs.length ? xs.map(x => `<div style="font-size:15px;color:#141A2E;padding:6px 0;border-top:1px solid #EEEAE0">${mark} ${esc(x.text)} <span style="color:#8A8EA0">· ${esc(x.state)}</span></div>`).join('') : '<div style="color:#8A8EA0">none</div>';
  const inner = `<tr><td style="padding:22px 24px"><div style="font-size:22px;font-weight:700;color:#141A2E">${esc(title)}</div><div style="font-size:15px;color:#3D4459;margin-top:8px">${esc(greeting(m, w.commitments, w.meetings))}</div>` +
    (r ? `<div style="margin-top:14px;font-size:18px;font-weight:700"><span style="color:#0F7B5F">✅ Completed: ${r.done.length}</span> &nbsp; <span style="color:#B4521A">⏳ Remaining: ${r.open.length}</span> &nbsp; <span style="color:#5B45D6">🙋 Needs an owner: ${r.unconfirmed.length}</span></div><div style="margin-top:14px;font-weight:700">Completed</div>${li(r.done, '✅')}<div style="margin-top:14px;font-weight:700">Remaining</div>${li(r.open, '🔸')}<div style="margin-top:14px;font-weight:700">Needs an owner (the manager will assign these)</div>${li(r.unconfirmed, '🙋')}` : '') + '</td></tr>';
  return { subject: `Meeting recap · ${r ? `${r.done.length} completed, ${r.open.length} remaining, ${r.unconfirmed.length} need an owner` : title}`, html: shell(inner, r ? `From "${esc(r.meeting.title)}" on ${fmtD(r.meeting.date)} · no owner names` : '') };
}

/* ======================= SLACK ======================= */
export function slackMessage(m: Msg, w: World, toast?: string) {
  if (m.kind === 'recap') return slackRecap(m, w);
  if (m.kind === 'upcoming') return slackUpcoming(m, w);
  const { rows, team, title, hello } = parts(m, w);
  const blocks: any[] = [{ type: 'header', text: { type: 'plain_text', text: title.slice(0, 150), emoji: true } }];
  blocks.push({ type: 'section', text: { type: 'mrkdwn', text: slackEsc(hello) } });
  if (toast) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `:white_check_mark: *${slackEsc(toast)}*` } });
  blocks.push({ type: 'divider' });
  const others = (c: Commitment) => w.members.filter(p => p.teamId === c.teamId && p.name !== c.owner);
  rows.forEach((c, i) => {
    const dep = c.dep ? w.commitments.find(x => x.id === c.dep) : undefined;
    const waiting = w.commitments.filter(x => x.dep === c.id && isOpen(x) && x.owner);
    const lines = [
      `:pushpin: *Task:*  *${slackEsc(c.text)}*`,
      `:date: *Due:*  *${isDate(c.due) ? fmtDLong(c.due) : 'no date yet: pick one below'}*${c.movedFrom ? `  _(moved from ${fmtD(c.movedFrom)})_` : c.said ? `  _(${m.kind === 'assign_request' ? 'said' : 'you said'} "${slackEsc(c.said)}")_` : ''}`,
      `:white_small_square: *Status:*  ${isOpen(c) ? LABEL[c.status] : `*${LABEL[c.status]}*`}`,
    ];
    if (dep && isOpen(dep)) lines.push(`:hourglass_flowing_sand: *Starts after:*  ${slackEsc(firstName(dep.owner) || 'unassigned')}'s "${slackEsc(dep.text)}" (due ${fmtD(dep.due)})`);
    if (waiting.length) lines.push(`:busts_in_silhouette: *Waiting on ${m.kind === 'assign_request' ? 'this' : 'you'}:*  ${waiting.map(x => `${slackEsc(firstName(x.owner))} (${fmtD(x.due)})`).join(', ')}`);
    if (c.trk) lines.push(`:link: *${team.tracker === 'jira' ? 'Jira' : 'Tracker'}:*  ${slackEsc(c.trk)}${c.trkClosed ? ' (closed)' : ''}`);
    if (m.kind === 'assign_request') lines.push(c.status === 'Unclaimed' ? ':raising_hand: *Owner:*  nobody named yet' : c.status === 'Suggested' ? `:raising_hand: *Owner:*  ${slackEsc(c.owner)} was named but has not confirmed` : `:bust_in_silhouette: *Owner:*  ${slackEsc(c.owner)}`);
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } });
    if (c.quote && c.status === 'Suggested') blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `> _“${slackEsc(c.quote)}”_` }] });
    const acts = messageActions(m.kind, c, m.toName, team.tracker);
    if (acts.buttons.length) blocks.push({
      type: 'actions', block_id: `${m.id}|${c.id}|a`,
      elements: acts.buttons.map(a => {
        const b: any = { type: 'button', action_id: a, value: c.id, text: { type: 'plain_text', text: actionLabel(a, m.kind, c, team.tracker), emoji: true } };
        if (['confirm', 'done', 'accept'].includes(a)) b.style = 'primary';
        if (a === 'drop') {
          b.style = 'danger';
          b.confirm = { title: { type: 'plain_text', text: 'Drop this commitment?' }, text: { type: 'mrkdwn', text: 'Dropping is an honest outcome and counts as resolved. People waiting on it will be told.' }, confirm: { type: 'plain_text', text: 'Drop it' }, deny: { type: 'plain_text', text: 'Keep it' } };
        }
        return b;
      }),
    });
    const edit: any[] = [];
    if (acts.date) edit.push({ type: 'datepicker', action_id: 'edit_date', ...(isDate(c.due) ? { initial_date: c.due } : {}), placeholder: { type: 'plain_text', text: acts.date } });
    const opts = others(c);
    if (acts.assign) {
      const pick = w.members.filter(p => p.teamId === c.teamId && (c.status === 'Unclaimed' || p.name !== c.owner));
      if (pick.length) edit.push({ type: 'static_select', action_id: 'claim', placeholder: { type: 'plain_text', text: 'Assign to…' }, options: pick.slice(0, 100).map(p => ({ text: { type: 'plain_text', text: p.name }, value: p.name })) });
    }
    if (acts.reassign && opts.length) edit.push({ type: 'static_select', action_id: 'reassign', placeholder: { type: 'plain_text', text: 'Reassign to…' }, options: opts.slice(0, 100).map(p => ({ text: { type: 'plain_text', text: p.name }, value: p.name })) });
    if (edit.length) blocks.push({ type: 'actions', block_id: `${m.id}|${c.id}|e`, elements: edit });
    if (i < rows.length - 1) blocks.push({ type: 'divider' });
  });
  const tn = team?.tracker === 'jira' ? 'Jira' : team?.tracker === 'asana' ? 'Asana' : '';
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `*Fireflies Commitments* · changes sync to Fireflies${tn ? ` and ${tn}` : ''}` }] });
  const text = `${hello} ${rows.map(r => r.text).join('; ')}`.slice(0, 2900);
  return { text, blocks };
}

/* ======================= TEAMS ======================= */
export function teamsCard(m: Msg, w: World, base: string) {
  if (m.kind === 'recap') return teamsRecap(m, w);
  if (m.kind === 'upcoming') return teamsUpcoming(m, w);
  const { rows, team, title, hello } = parts(m, w);
  const tAct = (t: string, url: string, style?: string) => ({ type: 'Action.OpenUrl', title: t, url, ...(style ? { style } : {}) });
  const body: any[] = [{
    type: 'Container', style: 'accent', bleed: true, items: [
      { type: 'TextBlock', text: 'FIREFLIES · COMMITMENTS', size: 'Small', weight: 'Bolder' },
      { type: 'TextBlock', text: title, size: 'Large', weight: 'Bolder', wrap: true },
      { type: 'TextBlock', text: hello, wrap: true },
    ],
  }];
  for (const c of rows) {
    const acts = messageActions(m.kind, c, m.toName, team.tracker);
    const actions = acts.buttons.map(a => tAct(actionLabel(a, m.kind, c, team.tracker), actionLink(base, m, c, a), ['confirm', 'done', 'accept'].includes(a) ? 'positive' : a === 'drop' ? 'destructive' : undefined));
    if (acts.date) actions.push(tAct(acts.date, actionLink(base, m, c, 'edit_date')));
    if (acts.reassign) actions.push(tAct('Reassign', actionLink(base, m, c, 'reassign')));
    const items: any[] = [
      { type: 'TextBlock', text: c.text, weight: 'Bolder', size: 'Medium', wrap: true },
      { type: 'TextBlock', text: `📅 Due ${isDate(c.due) ? fmtDLong(c.due) : 'no date yet'}`, weight: 'Bolder', color: 'Accent', wrap: true, spacing: 'Small' },
      { type: 'FactSet', facts: itemFacts(c, w.commitments, team.tracker).map(([title, value]) => ({ title, value: title === 'Status' ? value.split(' · ')[0] : value })) },
    ];
    if (c.quote && c.status === 'Suggested') items.push({ type: 'TextBlock', text: `“${c.quote}”`, isSubtle: true, wrap: true, size: 'Small' });
    if (actions.length) items.push({ type: 'ActionSet', actions });
    body.push({ type: 'Container', style: 'emphasis', spacing: 'Medium', items });
  }
  body.push({ type: 'TextBlock', text: `Buttons open a secure Fireflies page. Changes sync to Fireflies${team.tracker === 'jira' ? ' and Jira' : ''}.`, size: 'Small', isSubtle: true, wrap: true });
  return { $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4', msteams: { width: 'Full' }, body };
}

/* ======================= EMAIL ======================= */
const eBtn = (t: string, url: string, primary = false) =>
  `<a href="${esc(url)}" style="display:inline-block;margin:4px 6px 4px 0;padding:9px 14px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;${primary ? 'background:#5B45D6;color:#ffffff' : 'background:#ffffff;color:#141A2E;border:1px solid #D9D5CB'}">${esc(t)}</a>`;
const shell = (inner: string, foot: string) => `<!doctype html><html><body style="margin:0;background:#F6F4EE"><div style="background:#F6F4EE;padding:24px;font-family:Segoe UI,Helvetica,Arial,sans-serif"><table width="600" align="center" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #E4E0D5;border-radius:14px;overflow:hidden"><tr><td style="background:#141A2E;padding:18px 24px;color:#A99BFF;font-size:12px;letter-spacing:2px;font-weight:700">FIREFLIES · COMMITMENTS <span style="color:#8A8EA0;letter-spacing:0;font-weight:400">· concept prototype</span></td></tr>${inner}<tr><td style="padding:14px 24px;background:#FBFAF6;font-size:12px;color:#8A8EA0">${foot}</td></tr></table></div></body></html>`;

export function emailMessage(m: Msg, w: World, base: string) {
  if (m.kind === 'recap') return emailRecap(m, w);
  if (m.kind === 'upcoming') return emailUpcoming(m, w);
  const { rows, team, title, hello } = parts(m, w);
  const items = rows.map(c => {
    const acts = messageActions(m.kind, c, m.toName, team.tracker);
    let btns = acts.buttons.map(a => eBtn(actionLabel(a, m.kind, c, team.tracker), actionLink(base, m, c, a), ['confirm', 'done', 'accept'].includes(a))).join('');
    if (acts.date) btns += eBtn(acts.date, actionLink(base, m, c, 'edit_date'));
    if (acts.reassign) btns += eBtn('Reassign', actionLink(base, m, c, 'reassign'));
    const facts = `<div style="font-size:15px;color:#141A2E;margin-top:6px">📅 Due <b>${esc(isDate(c.due) ? fmtDLong(c.due) : 'no date yet')}</b>${c.said && !c.movedFrom ? ` <span style="color:#8A8EA0">(you said "${esc(c.said)}")</span>` : ''}</div>` +
      itemFacts(c, w.commitments, team.tracker).filter(([k]) => k !== 'Status').map(([k, v]) => `<div style="font-size:13px;color:#6B7083;margin-top:2px">${esc(k)}: ${esc(v)}</div>`).join('') +
      `<div style="font-size:13px;color:#6B7083;margin-top:2px">Status: ${esc(LABEL[c.status])}</div>`;
    return `<tr><td style="padding:16px 0;border-top:1px solid #EEEAE0"><div style="font-size:16px;font-weight:700;color:#141A2E">${esc(c.text)}</div>${facts}${c.quote && c.status === 'Suggested' ? `<div style="font-size:13px;color:#8A8EA0;font-style:italic;margin-top:6px">“${esc(c.quote)}”</div>` : ''}<div style="margin-top:8px">${btns}</div></td></tr>`;
  }).join('');
  const html = shell(`<tr><td style="padding:22px 24px"><div style="font-size:22px;font-weight:700;color:#141A2E">${esc(title)}</div><div style="font-size:15px;color:#3D4459;margin-top:8px;line-height:1.5">${esc(hello)}</div><table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">${items}</table></td></tr>`,
    `Sent to ${esc(m.toName)} by Fireflies Commitments. Buttons open a secure Fireflies page. Changes sync to Fireflies${team.tracker === 'jira' ? ' and Jira' : ''}.`);
  const mt = w.meetings.find(x => x.id === rows[0]?.meetingId || x.id === w.commitments.find(c => c.id === m.cids[0])?.meetingId);
  return { subject: `${firstName(m.toName)}, ${title.charAt(0).toLowerCase() + title.slice(1)} · ${mt?.title || 'Fireflies'}`, html };
}

/* ======================= FRIDAY REPORT ======================= */
export function weeklyReport(team: Team, w: World, today: string) {
  const rows = w.commitments.filter(c => c.teamId === team.id);
  const st = teamStats(rows, today);
  const people: Member[] = w.members.filter(p => p.teamId === team.id);
  const open = rows.filter(c => isOpen(c));
  const tile = (v: number, k: string, color = '#141A2E') => `<td style="padding:6px"><div style="background:#F6F4EE;border-radius:10px;padding:14px;text-align:center"><div style="font-size:26px;font-weight:700;color:${color}">${v}</div><div style="font-size:11px;letter-spacing:1px;font-weight:700;color:#6B7083;text-transform:uppercase">${k}</div></div></td>`;
  const list = open.map(c => `<tr><td style="padding:8px 0;border-top:1px solid #EEEAE0;font-size:14px;color:#141A2E">${esc(c.text)} <span style="color:#8A8EA0">· ${esc(c.owner || 'no owner')}</span></td><td style="padding:8px 0;border-top:1px solid #EEEAE0;font-size:13px;font-weight:600;text-align:right;white-space:nowrap;color:${overdue(c, today) ? '#C0392B' : '#6B7083'}">${overdue(c, today) ? 'Overdue ·' : c.status === 'Confirmed' ? 'Due' : LABEL[c.status] + ' · due'} ${fmtD(c.due)}</td></tr>`).join('');
  const subject = `Weekly commitments · ${team.name} · ${st.resolved} of ${st.total} resolved, ${st.remaining} remaining`;
  const html = shell(`<tr><td style="padding:22px 24px"><div style="font-size:12px;font-weight:700;color:#5B45D6">FOR ALL ${people.length} MEMBERS OF ${esc(team.name.toUpperCase())}</div><div style="font-size:22px;font-weight:700;color:#141A2E;margin-top:6px">Your week in commitments</div><div style="font-size:14px;color:#6B7083;margin-top:4px">Week ending ${fmtDLong(today)} · resolved means done, handed over, or honestly dropped</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px"><tr>${tile(st.total, 'Total assigned')}${tile(st.resolved, 'Resolved', '#0F7B5F')}${tile(st.remaining, 'Remaining')}${tile(st.overdue, 'Overdue', '#C0392B')}</tr></table>
    <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#5B45D6;margin:18px 0 4px">STILL OPEN</div><table width="100%" cellpadding="0" cellspacing="0">${list || '<tr><td style="font-size:14px;color:#6B7083">Nothing open. Nice week.</td></tr>'}</table></td></tr>`,
    `Sent every Friday 5:30 PM to ${esc(people.map(p => firstName(p.name)).join(', '))}. Demo routing: delivered to one demo inbox.`);
  return { subject, html, stats: st };
}
