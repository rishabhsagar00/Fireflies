// Jira Cloud REST API v3 with an API token (Basic auth: email + token).
// Demo set-up: every issue is assigned to the Jira user whose token is used (you), and the real
// owner is written in the issue ("Owner: Neha Kapoor") and as a label (owner-neha-kapoor).
import { config } from '../config.ts';

const auth = () => 'Basic ' + Buffer.from(`${config.jiraEmail}:${config.jiraApiToken}`).toString('base64');

async function call(path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(config.jiraBaseUrl + path, {
    method: init.method || 'GET',
    headers: { Authorization: auth(), Accept: 'application/json', 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15000), // a slow Jira never holds the app up
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 300), fieldErrors: Record<string, string> = {};
    try {
      const j = JSON.parse(text); fieldErrors = j.errors || {};
      detail = [...(j.errorMessages || []), ...Object.entries(fieldErrors).map(([k, v]) => `${k}: ${v}`)].join('; ') || detail;
    } catch { /* keep raw text */ }
    if (res.status === 401) detail = 'login failed: check JIRA_EMAIL and JIRA_API_TOKEN';
    if (res.status === 404 && path.includes('/project/')) detail = `project "${config.jiraProjectKey}" not found: check JIRA_PROJECT_KEY (the letters before your issue numbers)`;
    const err = new Error(`Jira ${res.status}: ${detail}`) as Error & { fieldErrors?: Record<string, string> };
    err.fieldErrors = fieldErrors;
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

/* Atlassian Document Format helpers */
const para = (text: string, bold = false) => ({ type: 'paragraph', content: [{ type: 'text', text, ...(bold ? { marks: [{ type: 'strong' }] } : {}) }] });
const doc = (...content: unknown[]) => ({ type: 'doc', version: 1, content });

let me: string | null = null;
async function myAccountId(): Promise<string> {
  if (!me) me = (await call('/rest/api/3/myself')).accountId as string;
  return me;
}

export interface IssueInfo { summary: string; due: string; owner: string; meeting: string; meetingDate: string; quote: string; id: string }
const ownerLabel = (owner: string) => owner ? 'owner-' + owner.toLowerCase().replace(/^dr\.\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'owner-none';
const description = (p: IssueInfo) => doc(
  para(`Owner: ${p.owner || 'No owner yet (with the manager to assign)'}`, true),
  ...(p.owner ? [] : [para('To assign it here: replace the label owner-none with the person, e.g. owner-priya-sharma (or set the Assignee to them). Fireflies then sends them a card to confirm.')]),
  para(`Commitment from the meeting "${p.meeting}" (${p.meetingDate}).`),
  ...(p.quote ? [para(`They said: "${p.quote}"`)] : []),
  para(`Tracked by Fireflies Commitments (id ${p.id}). Changes made in Fireflies, Slack, Teams or email appear here as comments; moving this issue to Done closes the commitment.`),
);

/** the project's issue type to use: "Task" if it has one, otherwise its first normal (non sub-task) type */
let issueType: { id: string; name: string } | null = null;
async function pickIssueType(): Promise<{ id: string; name: string }> {
  if (issueType) return issueType;
  const proj = await call(`/rest/api/3/project/${encodeURIComponent(config.jiraProjectKey)}`);
  const types = ((proj.issueTypes || []) as any[]).filter(t => !t.subtask && (t.hierarchyLevel ?? 0) === 0);
  const t = types.find(x => /^task$/i.test(x.name)) || types.find(x => /task|story/i.test(x.name)) || types[0];
  if (!t) throw new Error(`Jira: project ${config.jiraProjectKey} has no issue type that can be created`);
  issueType = { id: String(t.id), name: t.name };
  return issueType;
}

export async function createIssue(p: IssueInfo): Promise<string> {
  const it = await pickIssueType();
  const fields: Record<string, unknown> = {
    project: { key: config.jiraProjectKey }, summary: p.summary.slice(0, 250), issuetype: { id: it.id },
    labels: ['fireflies-commitment', ownerLabel(p.owner)], description: description(p),
  };
  if (p.due) fields.duedate = p.due;
  try { fields.assignee = { accountId: await myAccountId() }; } catch { /* leave unassigned */ }
  const create = async () => (await call('/rest/api/3/issue', { method: 'POST', body: { fields } })).key as string;
  // some projects hide fields on their create screen: drop the ones Jira complains about
  // (never project, summary or issue type), try again, then set what we can afterwards
  for (let attempt = 0; ; attempt++) {
    try {
      const key = await create();
      if (p.due && !fields.duedate) await setDueDate(key, p.due).catch(() => undefined);
      return key;
    } catch (e: any) {
      const bad = Object.keys(e.fieldErrors || {}).filter(k => k in fields && !['project', 'summary', 'issuetype'].includes(k));
      if (attempt >= 2 || !bad.length) { console.error('[jira] create issue failed:', e.message); throw e; }
      bad.forEach(k => delete fields[k]);
    }
  }
}

export async function setDueDate(key: string, due: string) {
  await call(`/rest/api/3/issue/${encodeURIComponent(key)}`, { method: 'PUT', body: { fields: { duedate: due } } });
}

/** owner changed (reassigned, assigned by the manager, or nobody): update the description and the owner label */
export async function setOwner(key: string, p: IssueInfo) {
  const cur = await call(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=labels`);
  const labels = ((cur.fields?.labels || []) as string[]).filter(l => !l.startsWith('owner-')).concat(ownerLabel(p.owner));
  await call(`/rest/api/3/issue/${encodeURIComponent(key)}`, { method: 'PUT', body: { fields: { description: description(p), labels } } });
}

export async function comment(key: string, text: string) {
  await call(`/rest/api/3/issue/${encodeURIComponent(key)}/comment`, { method: 'POST', body: { body: doc(para(`Fireflies Commitments: ${text}`)) } });
}

/** "UP blocks DOWN" (DOWN shows "is blocked by UP") */
export async function linkBlocks(upKey: string, downKey: string) {
  await call('/rest/api/3/issueLink', { method: 'POST', body: { type: { name: 'Blocks' }, outwardIssue: { key: upKey }, inwardIssue: { key: downKey } } });
}

/** Jira groups every status into three categories: "new" (To Do, Idea, Backlog…), "indeterminate"
 *  (In Progress, In Review…) and "done". Moves the issue to the wanted category, preferring the status
 *  named "In Progress" / "To Do"; does nothing if it is already there. Returns the status it ends in. */
export async function setStatusCategory(key: string, cat: 'new' | 'indeterminate'): Promise<string> {
  const k = encodeURIComponent(key);
  const cur = (await call(`/rest/api/3/issue/${k}?fields=status`)).fields?.status;
  const wantName = cat === 'indeterminate' ? /^in progress$/i : /^(to do|todo|open|backlog|selected for development)$/i;
  if (cur?.statusCategory?.key === cat && wantName.test(cur.name || '')) return cur.name;
  const r = await call(`/rest/api/3/issue/${k}/transitions`);
  const opts = ((r.transitions || []) as any[]).filter(t => t.to?.statusCategory?.key === cat);
  const tr = opts.find(t => wantName.test(t.to?.name || '')) || (cur?.statusCategory?.key === cat ? null : opts.find(t => !/review|test|qa|block|hold/i.test(t.to?.name || '')) || opts[0]);
  if (!tr) {
    if (cur?.statusCategory?.key === cat) return cur.name;
    throw new Error(`No transition from "${cur?.name}" to a ${cat === 'new' ? 'To Do' : 'In Progress'} status for ${key}`);
  }
  await call(`/rest/api/3/issue/${k}/transitions`, { method: 'POST', body: { transition: { id: tr.id } } });
  return tr.to.name;
}

/** moves the issue to the first transition whose target status is in the "Done" category */
export async function moveToDone(key: string, note?: string) {
  const r = await call(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`);
  const done = ((r.transitions || []) as any[]).filter(t => t.to?.statusCategory?.key === 'done');
  const tr = done.find(t => /^done$/i.test(t.to?.name || '')) || done.find(t => !/won.?t|cancel|reject|duplicate/i.test(t.to?.name || '')) || done[0];
  if (!tr) throw new Error(`No "Done" transition available for ${key}`);
  await call(`/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, { method: 'POST', body: { transition: { id: tr.id } } });
  if (note) await comment(key, note).catch(() => undefined);
}

/** quick connection check for the Settings page */
export async function whoAmI(): Promise<string> {
  const r = await call('/rest/api/3/myself');
  me = r.accountId;
  issueType = null;
  const it = await pickIssueType();
  return `${r.displayName || r.emailAddress} · project ${config.jiraProjectKey} · new issues are "${it.name}"`;
}
