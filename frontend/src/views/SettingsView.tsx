// Settings: the manager picks the channel and tracker for the team; everyone can see the demo
// setup (connections, demo routing, which teams send real messages, webhook addresses).
import { useState } from 'react';
import { type Channel, type Tracker, CH, chName, firstName, fmtD, fmtT, isOpen, messageTitle, teamStats, overdue, trackerName } from '../../../shared/core.ts';
import { http, useStore } from '../store.tsx';
import { Topbar } from '../components/Shell.tsx';

function Report({ teamId }: { teamId: string }) {
  const { S, team, membersOf, today, run, busy } = useStore();
  const t = team(teamId), rows = S.commitments.filter(c => c.teamId === teamId), st = teamStats(rows, today);
  const openRows = rows.filter(isOpen), people = membersOf(teamId);
  return (
    <section className="card report" aria-label="Weekly report preview">
      <div className="hd"><small>FIREFLIES · WEEKLY COMMITMENTS REPORT</small><b>{t.name}</b><div className="note" style={{ marginTop: 4 }}>Every Friday 5:30 PM to {people.length} people: {people.map(firstName).join(', ')}</div></div>
      <div style={{ padding: '12px 14px 0', fontSize: 13 }}><b>Subject:</b> Weekly commitments · {t.name} · {st.resolved} of {st.total} resolved, {st.remaining} remaining</div>
      <div className="tiles">
        <div className="tile"><div className="v">{st.total}</div><div className="k">Total assigned</div></div>
        <div className="tile"><div className="v" style={{ color: 'var(--ok)' }}>{st.resolved}</div><div className="k">Resolved</div></div>
        <div className="tile"><div className="v">{st.remaining}</div><div className="k">Remaining</div></div>
        <div className="tile"><div className="v" style={{ color: 'var(--bad)' }}>{st.overdue}</div><div className="k">Overdue</div></div></div>
      <div style={{ padding: '0 14px 14px', fontSize: 13 }}><div style={{ marginTop: 4, fontWeight: 700, fontSize: 11, letterSpacing: '.08em', color: 'var(--accent-2)' }}>STILL OPEN</div>
        {openRows.map(c => <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderTop: '1px solid var(--line)' }}>
          <span>{c.text} <span className="note">· {c.owner || 'no owner'}</span></span>
          <span style={{ whiteSpace: 'nowrap', fontWeight: 600, color: overdue(c, today) ? 'var(--bad)' : 'var(--fg-2)' }}>{overdue(c, today) ? 'Overdue' : 'Due'} {fmtD(c.due)}</span></div>)}
        {!openRows.length && <div className="note">Nothing open.</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn pri" disabled={busy} onClick={() => run('report', async () => (await http<{ message: string }>(`report/${teamId}/send`, {})).message)}>Email this report now</button>
          <a className="btn" href={`/api/report/${teamId}`} target="_blank" rel="noreferrer">Open the email</a></div>
      </div>
    </section>
  );
}

function Copy({ value }: { value: string }) {
  const { toast } = useStore();
  return <div className="copyrow"><code>{value}</code><button className="btn" onClick={() => navigator.clipboard.writeText(value).then(() => toast('Copied.'), () => toast('Copy failed. Select the text instead.', true))}>Copy</button></div>;
}

function DemoSetup() {
  const { S, run, busy, toast } = useStore();
  const [slackId, setSlackId] = useState(S.routing.slackUserId);
  const [chan, setChan] = useState(S.routing.meetingChannel || '');
  const [mail, setMail] = useState(S.routing.email);
  const [test, setTest] = useState<Record<string, string> | null>(null);
  const I = S.integrations;
  const conns: [string, boolean, string][] = [
    ['Slack', I.slack, I.slack ? (I.slackInteractive ? 'Bot token and signing secret set' : 'Signing secret missing: buttons will not work') : 'Add SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET'],
    ['Microsoft Teams', I.teams, I.teams ? 'Webhook URL set' : 'Add TEAMS_WEBHOOK_URL'],
    ['Email', I.email, I.email ? 'Resend / SMTP set' : 'Add RESEND_API_KEY or SMTP_ values'],
    ['Jira', I.jira, I.jira ? `${I.jiraBaseUrl.replace(/^https?:\/\//, '')} · project ${I.jiraProjectKey}` : 'Add the four JIRA_ values'],
  ];
  return (<>
    <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="sec" style={{ margin: 0 }}><h2>Connections</h2><span className="hint">set on the server (environment variables); see docs/SETUP.md</span></div>
      <div className="conn">{conns.map(([n, on, d]) => <div key={n} className={`c ${on ? 'on' : ''}`}><b><span className="dot" />{n}</b><span className="note">{test?.[n === 'Microsoft Teams' ? 'teams' : n.toLowerCase()] || d}</span></div>)}</div>
      <div><button className="btn" disabled={busy} onClick={() => run('test', async () => { setTest(await http('integrations/test', {})); return 'Checked the connections.'; })}>Test connections</button></div>
    </section>
    <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="sec" style={{ margin: 0 }}><h2>Demo routing</h2><span className="hint">for the demo, one Slack account and one inbox receive everyone's messages</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
        <label className="field">Your Slack member ID (Slack → your profile → ⋯ → Copy member ID)<input className="inp" value={slackId} onChange={e => setSlackId(e.target.value.trim())} placeholder="U0123ABCD" /></label>
        <label className="field">Meeting chat: Slack channel ID for the next-meeting recap (open the channel → its name → About → Channel ID; then /invite the app there)<input className="inp" value={chan} onChange={e => setChan(e.target.value.trim())} placeholder="C0123ABCD" /></label>
        <label className="field">Demo inbox for email messages and the Friday report<input className="inp" type="email" value={mail} onChange={e => setMail(e.target.value.trim())} placeholder="you@yourdomain.com" /></label>
      </div>
      <div><button className="btn pri" disabled={busy} onClick={() => run('routing', async () => { await http('settings', { routing: { slackUserId: slackId, email: mail, meetingChannel: chan } }); return 'Demo routing saved.'; })}>Save routing</button></div>
      <div className="lab" style={{ marginTop: 6 }}>SEND REAL MESSAGES FOR</div>
      <div className="livegrid">{S.teams.map(t => (
        <label key={t.id} className="tgl"><input type="checkbox" checked={S.liveTeams.includes(t.id)} disabled={busy}
          onChange={e => run('live', async () => { await http('settings', { liveTeams: e.target.checked ? [...S.liveTeams, t.id] : S.liveTeams.filter(x => x !== t.id) }); return `${t.name}: real messages ${e.target.checked ? 'on' : 'off'}.`; })} />
          {t.name} <span className="note">· {CH[t.channel][0]}</span></label>))}</div>
      <p className="note" style={{ margin: 0 }}>Every message goes to the person by name ("Hey Neha, …"). If a team's channel is not connected yet, it is sent in Slack instead, then email.</p>
    </section>
    <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="sec" style={{ margin: 0 }}><h2>Sent messages</h2><span className="hint">latest 25 · what went out and where</span></div>
      {S.messages.slice(0, 25).map(m => (
        <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '110px minmax(0,1fr) minmax(0,1.1fr)', gap: 10, fontSize: 12.5, padding: '6px 0', borderTop: '1px solid var(--line)' }}>
          <time style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--fg-3)' }}>{fmtT(m.at)}</time>
          <span><b>{m.toName}</b> · {messageTitle(m, S.commitments, S.meetings)[0]}</span>
          <span className={`dlv ${m.delivered ? 'ok' : 'err'}`} style={{ marginTop: 0 }}><i />{m.delivery || 'Sending…'}</span>
        </div>))}
      {!S.messages.length && <div className="note">Nothing sent yet. Import a meeting to send the first cards.</div>}
    </section>
    <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="sec" style={{ margin: 0 }}><h2>Webhook addresses</h2><span className="hint">paste these into Slack and Jira</span></div>
      <div className="field">Slack → your app → Interactivity &amp; Shortcuts → Request URL<Copy value={S.slackInteractivityUrl} /></div>
      <div className="field">Jira → Settings → System → WebHooks → URL (events: Issue updated)<Copy value={S.jiraWebhookUrl} /></div>
    </section>
    <section className="card pad" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 300px' }}><b>Reset demo</b><div className="note">Deletes everything (including imported meetings) and loads the 8 demo teams again. The demo day becomes today and the demo clock shows the time now.</div></div>
      <button className="btn" disabled={busy} onClick={() => { if (window.confirm('Reset all demo data?')) run('reset', async () => { await http('demo/reset', {}); return 'Demo data reset.'; }); else toast('Nothing changed.'); }}>Reset demo data</button>
    </section>
  </>);
}

export function SettingsView() {
  const { isMgr, myTeam, team, membersOf, run, busy } = useStore();
  const id = myTeam(), t = team(id);
  return (<>
    <Topbar crumb={isMgr() ? <>Settings / <b>Commitment notifications</b></> : 'Settings'} />
    <div className="content">
      {isMgr() ? (<>
        <div className="mhead"><div><h1>Commitment notifications</h1><div className="meta">Choose where {t.name} gets commitment cards and reminders.</div></div></div>
        <section className="card pad"><div className="setrow"><div><b>{t.name}</b><div className="note">{membersOf(id).length} people</div></div>
          <div><div className="lab">SEND MESSAGES IN</div><div className="seg" role="group" aria-label="Channel">{(['slack', 'teams', 'email'] as Channel[]).map(ch => (
            <button key={ch} aria-pressed={t.channel === ch} disabled={busy} onClick={() => run('ch', async () => { await http(`teams/${id}`, { channel: ch }); return `${t.name}: messages now go ${chName(ch)}. Saved.`; })}>{CH[ch][0]}</button>))}</div></div>
          <div><div className="lab">TRACKER</div><div className="seg" role="group" aria-label="Tracker">{(['jira', 'asana', 'none'] as Tracker[]).map(tr => (
            <button key={tr} aria-pressed={t.tracker === tr} disabled={busy} onClick={() => run('tr', async () => { await http(`teams/${id}`, { tracker: tr }); return `${t.name}: tracker set to ${tr === 'none' ? 'none' : trackerName(tr)}.`; })}>{tr === 'none' ? 'None' : trackerName(tr)}</button>))}</div></div></div></section>
        <section className="card pad"><div className="sec"><h2>When reminders go out</h2></div>
          <ul className="ov"><li>Same day as the meeting: each person gets their commitment to confirm.</li><li>Not confirmed after 1 working day: one nudge. After 2 working days: it comes to you to assign.</li><li>One working day before the due date: "Due tomorrow".</li><li>On the due date at 9:30 AM: the last reminder, with "Mark done" and "Need 1 more day". A weekend due date is reminded on Friday.</li><li>Hand-overs: no answer in 2 days goes back to the owner; the second failed hand-over comes to you.</li></ul></section>
        <div className="sec" style={{ margin: '4px 0 0' }}><h2>Friday report</h2></div>
        <Report teamId={id} />
      </>) : (
        <div className="mhead"><div><h1>Notifications</h1><div className="meta">Your commitment cards and reminders arrive {chName(t.channel)}. Your manager, {t.manager}, chooses this for the team.</div></div></div>
      )}
      <div className="sec" style={{ margin: '8px 0 0' }}><h2>Demo setup</h2></div>
      <DemoSetup />
    </div>
  </>);
}
