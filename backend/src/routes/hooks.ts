// Endpoints that other systems call: Slack button clicks, Jira issue updates, and the
// Teams/email action links (opened from the /act page of the frontend).
import { Router, raw, json } from 'express';
import { verifySignature } from '../integrations/slack.ts';
import { getMessage, loadWorld } from '../db.ts';
import { act, ActError, ACTIONS, reopenFromJira, type Action, type Source } from '../domain/engine.ts';
import { newCtx, flush, serial } from '../domain/service.ts';
import { baseUrl, jiraWebhookSecret } from './api.ts';
import { messageActions, isOpen, LABEL, fmtD, messageTitle } from '../../../shared/core.ts';

export const hooks = Router();

/* ---------------- Slack interactivity ---------------- */
hooks.post('/slack/interactions', raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const rawBody = (req.body as Buffer).toString('utf8');
  if (!verifySignature(rawBody, req.get('x-slack-request-timestamp'), req.get('x-slack-signature'))) {
    return res.status(401).send('Bad signature');
  }
  // answer Slack right away (it waits only 3 seconds); the work continues below
  res.status(200).send('');
  try {
    const payload = JSON.parse(new URLSearchParams(rawBody).get('payload') || '{}');
    if (payload.type !== 'block_actions') return;
    const a = payload.actions?.[0]; if (!a) return;
    const [mid, cid] = String(a.block_id || '').split('|');
    const msg = await getMessage(Number(mid));
    if (!msg || !cid) return;
    const action = a.action_id as Action;
    if (!ACTIONS.includes(action)) return;
    const extra = { src: 'slack' as Source, to: a.selected_option?.value, date: a.selected_date };
    // demo routing: everyone's messages arrive in one Slack account, so the person acting is
    // the one the message was for (in production this is the Slack user who clicked)
    const actor = msg.toName;
    await serial(async () => {
      const ctx = await newCtx();
      let toast = '';
      try { toast = await act(ctx, action, cid, actor, extra); ctx.note = `Updated in Slack: ${toast}`; }
      catch (e: any) { toast = e instanceof ActError ? `⚠️ ${e.message}` : 'Something went wrong. Try again from Fireflies.'; if (!(e instanceof ActError)) console.error(e); }
      await flush(ctx, baseUrl(req), payload.response_url ? { messageId: msg.id, responseUrl: payload.response_url, toast } : undefined);
    });
  } catch (e) { console.error('[slack interactions]', e); }
});

/* ---------------- Jira webhook ---------------- */
/** who the issue now belongs to, if it names a member of the team: an owner-<first-last> label, or the Assignee */
function jiraOwner(ctx: { members: (teamId: string) => string[]; w: { members: { name: string; email: string; teamId: string }[] } }, c: { teamId: string; owner: string }, issue: any): string | null {
  const slug = (n: string) => n.toLowerCase().replace(/^dr\.\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const members = ctx.members(c.teamId);
  const labels = ((issue.fields?.labels || []) as string[]).filter(l => l.startsWith('owner-') && l !== 'owner-none');
  for (const l of labels) { const p = members.find(n => 'owner-' + slug(n) === l); if (p && p !== c.owner) return p; }
  const a = issue.fields?.assignee;
  if (a) {
    const p = ctx.w.members.find(x => x.teamId === c.teamId && ((a.emailAddress && x.email && a.emailAddress.toLowerCase() === x.email.toLowerCase()) || (a.displayName && a.displayName.toLowerCase() === x.name.toLowerCase())));
    if (p && p.name !== c.owner) return p.name;
  }
  return null;
}
hooks.post('/jira/webhook', json({ limit: '2mb' }), async (req, res) => {
  if (String(req.query.secret || '') !== await jiraWebhookSecret()) return res.status(401).json({ error: 'Bad secret' });
  res.json({ ok: true });
  try {
    const issue = req.body?.issue; if (!issue?.key) return;
    const statusCat = issue.fields?.status?.statusCategory?.key;
    const statusName = issue.fields?.status?.name || 'In Progress';
    const changed = (req.body?.changelog?.items || []).map((i: any) => String(i.field).toLowerCase());
    await serial(async () => {
      const ctx = await newCtx();
      const all = ctx.w.commitments.filter(x => x.trk === issue.key);
      const c = all.find(isOpen) || all[all.length - 1];
      if (!c) return;
      try {
        if (!isOpen(c)) {
          // closed here; Jira moved it out of Done → open it again
          if (statusCat !== 'done' && (c.status === 'Done' || c.status === 'Dropped')) reopenFromJira(ctx, c, statusName);
          else return;
        }
        else if (statusCat === 'done') await act(ctx, 'done', c.id, c.owner || 'Jira', { src: 'jira' });
        else if ((c.status === 'Unclaimed' || c.status === 'Suggested') && (changed.includes('labels') || changed.includes('assignee')) && jiraOwner(ctx, c, issue)) {
          // the manager assigned it in Jira (owner label, or an Assignee who is a team member)
          const to = jiraOwner(ctx, c, issue)!;
          ctx.skipKey = issue.key;
          await act(ctx, 'claim', c.id, ctx.team(c).manager, { src: 'jira', to });
        }
        else if (changed.includes('duedate') && issue.fields?.duedate && issue.fields.duedate !== c.due) {
          ctx.skipKey = issue.key; // the date came from this issue; don't write it back to it
          await act(ctx, 'edit_date', c.id, c.owner || 'Jira', { src: 'jira', date: issue.fields.duedate });
        } else return;
      } catch (e: any) { if (!(e instanceof ActError)) throw e; return; }
      ctx.note = `Updated from Jira (${issue.key})`;
      await flush(ctx, baseUrl(req));
    });
  } catch (e) { console.error('[jira webhook]', e); }
});

/* ---------------- Teams / email action links ---------------- */
async function linkContext(m: number, c: string, t: string) {
  const msg = await getMessage(m);
  const w = await loadWorld();
  const row = w.commitments.find(x => x.id === c);
  if (!msg || !row || row.token !== t || !msg.cids.includes(c)) return null;
  return { msg, w, row };
}

hooks.get('/link', async (req, res) => {
  const lc = await linkContext(Number(req.query.m), String(req.query.c || ''), String(req.query.t || ''));
  if (!lc) return res.status(404).json({ error: 'This link is not valid any more. Open Fireflies to update the commitment.' });
  const { msg, w, row } = lc;
  const team = w.teams.find(x => x.id === row.teamId)!;
  const acts = messageActions(msg.kind, row, msg.toName, team.tracker);
  res.json({
    toName: msg.toName, text: row.text, status: LABEL[row.status], open: isOpen(row), due: row.due, dueText: fmtD(row.due),
    title: messageTitle(msg, w.commitments, w.meetings)[0], tracker: team.tracker, channel: msg.channel,
    allowed: [...acts.buttons, ...(acts.date ? ['edit_date'] : []), ...(acts.reassign ? ['reassign'] : [])],
    teammates: w.members.filter(p => p.teamId === row.teamId && p.name !== row.owner).map(p => p.name),
  });
});

hooks.post('/link', json(), async (req, res) => {
  const { m, c, t, a, v } = req.body || {};
  if (!ACTIONS.includes(a)) return res.status(400).json({ error: 'Unknown action.' });
  const lc = await linkContext(Number(m), String(c || ''), String(t || ''));
  if (!lc) return res.status(404).json({ error: 'This link is not valid any more. Open Fireflies to update the commitment.' });
  try {
    const out = await serial(async () => {
      const ctx = await newCtx();
      const src: Source = lc.msg.channel === 'teams' ? 'teams' : lc.msg.channel === 'email' ? 'email' : 'slack';
      const message = await act(ctx, a as Action, c, lc.msg.toName, { src, to: a === 'reassign' ? v : undefined, date: a === 'edit_date' ? v : undefined });
      ctx.note = `Updated ${src === 'teams' ? 'in Teams' : 'by email'}: ${message}`;
      await flush(ctx, baseUrl(req));
      const row = ctx.byId(c)!;
      return { message, status: LABEL[row.status], dueText: fmtD(row.due) };
    });
    res.json(out);
  } catch (e: any) { res.status(e instanceof ActError ? 409 : 500).json({ error: e.message }); }
});

