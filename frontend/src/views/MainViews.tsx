// Home, Meetings, one Meeting (Commitments / Summary / Transcript tabs) and the
// Commitments page (a member sees only their own; a manager sees the team).
import { useState } from 'react';
import { type ChatEvent, type Commitment, type Meeting, type Recap, CH, buildRecap, fmtClock, fmtD, firstName, trackerName } from '../../../shared/core.ts';
import { http, useStore } from '../store.tsx';
import { CommitmentRow } from '../components/CommitmentRow.tsx';
import { Topbar } from '../components/Shell.tsx';
import { Avatar, Empty, Icon, Kpis } from '../components/ui.tsx';

/** summary text from Fireflies may contain <b> and <mark>; render only those tags */
function Rich({ html }: { html: string }) {
  const parts = html.split(/(<\/?(?:b|mark)>)/g);
  const out: JSX.Element[] = []; let b = false, mk = false;
  parts.forEach((p, i) => {
    if (p === '<b>') b = true; else if (p === '</b>') b = false; else if (p === '<mark>') mk = true; else if (p === '</mark>') mk = false;
    else if (p) out.push(mk ? <mark key={i}>{p}</mark> : b ? <b key={i}>{p}</b> : <span key={i}>{p}</span>);
  });
  return <>{out}</>;
}

function MiniCounts({ rows }: { rows: Commitment[] }) {
  const { isOpen, overdue } = useStore();
  const o = rows.filter(c => isOpen(c) && c.status !== 'Unclaimed').length, d = rows.filter(c => c.status === 'Done').length, u = rows.filter(c => c.status === 'Unclaimed').length, od = rows.filter(overdue).length;
  return (
    <span className="mini num">
      <span><i style={{ background: 'var(--accent-2)' }} />{o} open</span><span><i style={{ background: 'var(--ok)' }} />{d} done</span>
      {od > 0 && <span style={{ color: 'var(--bad)' }}><i style={{ background: 'var(--bad)' }} />{od} overdue</span>}
      {u > 0 && <span style={{ color: 'var(--warn)' }}><i style={{ background: 'var(--warn)' }} />{u} no owner</span>}
    </span>
  );
}
function MeetingRow({ m }: { m: Meeting }) {
  const { S, mineC, setUI, membersOf, isMgr } = useStore();
  const all = S.commitments.filter(c => c.meetingId === m.id && c.status !== 'NotCommitment'), mine = all.filter(mineC);
  const rows = isMgr() ? all : mine;   // a team member only sees their own items
  return (
    <button className="mrow" onClick={() => setUI({ view: 'meeting', meeting: m.id, tab: 'commitments', edit: null })}>
      <span className="ic"><Icon n="video" /></span>
      <span style={{ minWidth: 0 }}><span className="t">{m.title}{m.source === 'import' && <span className="tagnew" style={{ marginLeft: 8 }}>IMPORTED</span>}</span>
        <span className="s"><span>{fmtD(m.date)}{m.startTime && `, ${fmtClock(m.startTime)}`}</span>{m.mins > 0 && <span>{m.mins} min</span>}{mine.length > 0 && <span style={{ color: 'var(--accent-2)' }}>{mine.length} yours</span>}</span></span>
      <span className="cm"><span className="people">{membersOf(m.teamId).slice(0, 4).map(n => <Avatar key={n} name={n} />)}</span><MiniCounts rows={rows} /></span>
    </button>
  );
}
const useMyMeetings = () => { const { S, myTeam } = useStore(); return S.meetings.filter(m => m.teamId === myTeam()); };
const whenAt = (t: string) => t ? `${fmtD(t.slice(0, 10))}, ${fmtClock(t.slice(11, 16))}` : '';
/** the latest meeting of my team that is held already, and the one whose next meeting is live right now */
function useLastAndLive() {
  const { S } = useStore();
  const list = useMyMeetings();
  const today = S.now.slice(0, 10);
  const last = [...list].filter(m => m.date <= today).sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime))[0] || list[0];
  const live = list.find(m => !!m.live?.startAt && !m.live.endedAt);
  return { last, live };
}
/** a team member's view: the meeting window while the meeting runs, otherwise the latest status */
function ProgressCard({ m, live }: { m: Meeting; live: boolean }) {
  const { S } = useStore();
  if (live && m.live) return <MeetingWindow m={m} />;
  const r = buildRecap(m, S.meetings, S.commitments, S.now.slice(0, 10));
  return (
    <section className="card pad"><div className="sec"><h2>Status since "{m.title}"</h2>
      <span className="hint">Fred posts this in the meeting chat when the next meeting starts</span></div>
      <RecapLists r={r} />
    </section>
  );
}

/** the call as everyone in it sees it (stand-in for Teams, Meet or Zoom): who is in, and the meeting chat */
function MeetingWindow({ m }: { m: Meeting }) {
  const l = m.live; if (!l?.startAt) return null;
  const t = (x: string) => fmtClock(x.slice(11, 16));
  return (
    <section className="card" style={{ overflow: 'hidden', border: '1px solid var(--line-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#0E0E10', borderBottom: '1px solid var(--line)' }}>
        {!l.endedAt ? <span style={{ color: 'var(--bad)', fontWeight: 700, fontSize: 12 }}>● LIVE</span> : <span className="note" style={{ fontWeight: 700 }}>ENDED</span>}
        <b style={{ fontSize: 14 }}>Next "{m.series || m.title}" meeting</b>
        <span className="note">started {t(l.startAt)} · meeting app (Teams / Meet / Zoom) · demo window</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 210px) 1fr', minHeight: 260 }}>
        <div style={{ borderRight: '1px solid var(--line)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="lab">In the call · {l.people.length}</div>
          {l.people.map(p => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {p.name.startsWith('Fred') ? <span className="av" style={{ width: 24, height: 24, borderRadius: 12, background: 'var(--accent)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>F</span> : <Avatar name={p.name} />}
              <span style={{ fontSize: 13 }}>{p.name}</span>
            </div>))}
        </div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 520, overflowY: 'auto' }}>
          <div className="lab">Meeting chat</div>
          {l.chat.map((e, i) => <ChatLine key={i} e={e} />)}
          {!l.fredAt && !l.endedAt && <div className="note">Fred posts the status here {fmtClock(new Date(new Date(l.startAt + ':00Z').getTime() + 120000).toISOString().slice(11, 16))} (2 minutes after the start).</div>}
        </div>
      </div>
    </section>
  );
}
function ChatLine({ e }: { e: ChatEvent }) {
  const t = fmtClock(e.at.slice(11, 16));
  if (e.type === 'join') return <div className="note" style={{ fontSize: 12 }}>{t} · {e.who} joined</div>;
  if (e.type === 'note') return <div className="note" style={{ fontSize: 12 }}>{t} · {e.text}</div>;
  const r = e.recap!;
  const col = (label: string, color: string, xs: { id: string; text: string; state: string }[]) => (
    <div style={{ marginTop: 6 }}><div style={{ fontWeight: 700, color, fontSize: 12.5 }}>{label} · {xs.length}</div>
      {xs.map(x => <div key={x.id} style={{ fontSize: 13, padding: '2px 0' }}>{x.text} <span className="note">· {x.state}</span></div>)}
      {!xs.length && <div className="note">none</div>}</div>);
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ flex: '0 0 26px', width: 26, height: 26, borderRadius: 13, background: 'var(--accent)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>F</span>
      <div style={{ background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px', minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12 }}><b>Fred (Fireflies)</b> <span className="note">{t}</span></div>
        <div style={{ fontSize: 13, marginTop: 2 }}>{e.text}</div>
        {col('✅ Completed', 'var(--ok)', r.done)}
        {col('⏳ Remaining', 'var(--warn)', r.open)}
        {col('🙋 Needs an owner', 'var(--accent-2)', r.need)}
        <div className="note" style={{ fontSize: 11.5, marginTop: 6 }}>No owner names · the manager assigns the items without an owner</div>
      </div>
    </div>
  );
}

export function HomeView({ onImport }: { onImport: () => void }) {
  const { scoped, mineC, isMgr, me, today, overdue, isOpen, setUI, toast } = useStore();
  const rows = scoped(), mineOpen = rows.filter(c => mineC(c) && isOpen(c));
  const need = rows.filter(c => (mineC(c) && (c.status === 'Suggested' || overdue(c) || (c.status === 'PendingAccept' && c.pending === me) || (c.status === 'Confirmed' && c.due === today))) || (isMgr() && c.status === 'Unclaimed'))
    .sort((a, b) => Number(overdue(b)) - Number(overdue(a)));
  const meetings = useMyMeetings();
  return (<>
    <Topbar crumb="Home" />
    <div className="content"><div className="wrapc">
      <section className="welcome"><div><h1>Welcome back, {firstName(me)}!</h1><p>You have {mineOpen.length} open commitment{mineOpen.length === 1 ? '' : 's'}{need.length ? `; ${need.length} need${need.length === 1 ? 's' : ''} you today` : ''}.</p></div>
        <button className="btn pri" onClick={() => setUI({ view: 'commitments' })}><Icon n="commit" />My commitments</button></section>
      <div><h2 style={{ fontSize: 17 }}>Quick Start</h2><p className="note" style={{ margin: '4px 0 12px', fontSize: 13 }}>Capture your first meeting or upload a recording</p>
        <div className="quick">
          <button onClick={() => toast('Not part of this concept prototype.')}><Icon n="cal" />Schedule Meeting</button>
          <button onClick={onImport} style={{ opacity: 1 }}><Icon n="upload" />Import Fireflies meeting</button>
          <button onClick={() => toast('Not part of this concept prototype.')}><Icon n="plus" />Capture Meeting</button></div></div>
      <section className="card pad"><div className="sec"><h2>Needs you today</h2><button className="link" onClick={() => setUI({ view: 'commitments' })}>See all</button></div>
        <div className="clist">{need.slice(0, 5).map(c => <CommitmentRow key={c.id} c={c} actions assign owner={isMgr()} />)}{!need.length && <Empty>You are all caught up.</Empty>}</div></section>
      <section><div className="sec"><h2>Recent</h2><button className="link" onClick={() => setUI({ view: 'meetings' })}>All meetings</button></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{meetings.slice(0, 3).map(m => <MeetingRow key={m.id} m={m} />)}</div></section>
    </div></div>
  </>);
}

export function MeetingsView({ onImport }: { onImport: () => void }) {
  const list = useMyMeetings();
  const { toast, isMgr } = useStore();
  if (!isMgr()) return <MemberMeetings />;
  return (<>
    <Topbar crumb="Meetings" />
    <div className="content">
      <div className="toolbar"><div className="pillgrp"><button aria-pressed="true">Hosted by me</button><button aria-pressed="false" onClick={() => toast('Not part of this concept prototype.')}>Shared with me</button></div>
        <button className="btn" onClick={() => toast('Not part of this concept prototype.')}><Icon n="filter" />Filters</button></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{list.map(m => <MeetingRow key={m.id} m={m} />)}{!list.length && <Empty>No meetings yet.</Empty>}</div>
    </div>
  </>);
}


/** My Meetings for a team member: only the last meeting's summary and the next scheduled meeting */
function MemberMeetings() {
  const { S, mineC, setUI } = useStore();
  const { last, live } = useLastAndLive();
  const mine = last ? S.commitments.filter(c => c.meetingId === last.id && mineC(c) && c.status !== 'NotCommitment') : [];
  return (<>
    <Topbar crumb="My Meetings" />
    <div className="content"><div className="wrapc">
      {live ? <ProgressCard m={live} live /> : last ? <ProgressCard m={last} live={false} /> : null}
      {last ? <section className="card pad">
        <div className="sec"><h2>Last meeting · {last.title}</h2><span className="hint">{fmtD(last.date)}{last.startTime && `, ${fmtClock(last.startTime)}`} · AI summary from Fireflies</span></div>
        {last.keywords.length > 0 && <div className="kw">{last.keywords.map(k => <span key={k}>{k}</span>)}</div>}
        <ul className="ov">{last.overview.map((x, i) => <li key={i}><Rich html={x} /></li>)}</ul>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <span className="note">{mine.length ? `${mine.length} commitment${mine.length === 1 ? '' : 's'} from this meeting ${mine.length === 1 ? 'is' : 'are'} yours` : 'Nothing from this meeting is yours'}</span>
          {mine.length > 0 && <button className="btn" onClick={() => setUI({ view: 'meeting', meeting: last.id, tab: 'commitments', edit: null })}>See my items</button>}
        </div>
      </section> : <section className="card pad"><Empty>No meetings yet.</Empty></section>}
    </div></div>
  </>);
}

/** completed, remaining and needs-an-owner commitments by title only (the same as the pre-read and Fred's post) */
function RecapLists({ r }: { r: Recap }) {
  const col = (label: string, color: string, xs: Recap['done'], none: string) => (
    <div><div className="lab" style={{ color }}>{label} · {xs.length}</div>
      {xs.map(x => <div key={x.id} className="note" style={{ color: 'var(--fg)', padding: '4px 0' }}>{x.text} <span className="note">· {x.state}</span></div>)}
      {!xs.length && <div className="note">{none}</div>}</div>);
  return (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
    {col('✓ COMPLETED', 'var(--ok)', r.done, 'none yet')}
    {col('◷ REMAINING', 'var(--warn)', r.open, 'nothing remaining')}
    {col('? NEEDS AN OWNER', 'var(--accent-2)', r.unconfirmed, 'every item has an owner')}
  </div>);
}

/** manager only. In the product the next meeting comes from the calendar and Fred joins it on his own;
 *  these steps stand in for the calendar and the call in this prototype. */
function LiveMeeting({ m }: { m: Meeting }) {
  const { S, run, busy, me, membersOf, setUI } = useStore();
  const [who, setWho] = useState('');
  const r = buildRecap(m, S.meetings, S.commitments, S.now.slice(0, 10));
  const l = m.live, running = !!l?.startAt && !l.endedAt, ended = !!l?.endedAt;
  const notIn = membersOf(m.teamId).filter(p => !l?.people.some(x => x.name === p));
  const go = (what: string, extra: object = {}) => run(what, async () => {
    const out = await http<{ message: string; meetingId: string }>(`meetings/${m.id}/live`, { do: what, actor: me, ...extra });
    if (out.meetingId) setUI({ view: 'meeting', meeting: out.meetingId, tab: 'commitments', edit: null });
    return out.message;
  });
  const step = (n: number, label: string, done: boolean, active: boolean) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: done ? 'var(--ok)' : active ? 'var(--fg)' : 'var(--fg-3)' }}>
      <span style={{ width: 18, height: 18, borderRadius: 9, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, border: '1px solid currentColor' }}>{done ? '✓' : n}</span>{label}</span>);
  return (<>
    <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="sec" style={{ margin: 0 }}><h2>Next meeting{m.series ? ` · series "${m.series}"` : ''}</h2>
        <span className="hint">comes from your calendar · Fred joins as a participant</span></div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {step(1, '30 min before: pre-read in the team channel', !!l?.preAt, !l?.preAt)}
        {step(2, 'Meeting: Fred posts the status in the meeting chat', !!l?.fredAt, running)}
        {step(3, 'Meeting ends: upcoming commitments + private cards', ended, running)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {!running && !ended && <>
          <button className={`btn ${l?.preAt ? '' : 'pri'}`} disabled={busy} onClick={() => go('pre')}>{l?.preAt ? 'Post the pre-read again' : '① Meeting in 30 min · post pre-read'}</button>
          <button className={`btn ${l?.preAt ? 'pri' : ''}`} disabled={busy} onClick={() => go('start')}>② Meeting starts · Fred joins</button>
        </>}
        {running && <>
          <select className="sm" value={who} onChange={e => setWho(e.target.value)} aria-label="Who joins"><option value="">Someone joins…</option>{notIn.map(p => <option key={p}>{p}</option>)}</select>
          <button className="btn" disabled={busy || !who} onClick={() => go('join', { person: who }).then(() => setWho(''))}>Joins</button>
          {!l?.fredAt && <button className="btn" disabled={busy} onClick={() => go('post')}>Skip the 2-minute wait</button>}
          <button className="btn pri" disabled={busy} onClick={() => go('end')}>③ Meeting ends</button>
        </>}
        {ended && l?.nextMeetingId && <button className="btn pri" onClick={() => setUI({ view: 'meeting', meeting: l.nextMeetingId!, tab: 'commitments', edit: null })}>Open the new meeting</button>}
        <span className="note">demo stand-in for the calendar and the call</span>
      </div>
      {l?.preAt && <div className="note">Pre-read posted {whenAt(l.preAt)}{running ? ` · meeting started ${whenAt(l.startAt!)}` : ''}{l.fredAt ? ` · Fred posted ${fmtClock(l.fredAt.slice(11, 16))}` : ''}</div>}
      {!running && !ended && <><div className="lab">What the pre-read will show · no names</div><RecapLists r={r} /></>}
    </section>
    {(running || ended) && <MeetingWindow m={m} />}
  </>);
}

export function MeetingView() {
  const { S, ui, setUI, isMgr, mineC, team, membersOf } = useStore();
  const mine0 = useMyMeetings();
  const m = S.meetings.find(x => x.id === ui.meeting) || mine0[0];
  if (!m) return <MeetingsView onImport={() => undefined} />;
  const rows = S.commitments.filter(c => c.meetingId === m.id && c.status !== 'NotCommitment'), t = team(m.teamId);
  const mine = rows.filter(mineC);
  const tabs: [typeof ui.tab, string, number | ''][] = [['commitments', isMgr() ? 'Commitments' : 'My commitments', isMgr() ? rows.length : mine.length], ['summary', 'Summary', ''], ['transcript', 'Transcript', '']];
  return (<>
    <Topbar crumb={<><button onClick={() => setUI({ view: 'meetings' })} style={{ color: 'var(--fg-2)' }}>Meetings</button> / <b>{m.title}</b></>} />
    <div className="content">
      <div className="mhead"><div><h1>{m.title}</h1>
        <div className="meta num"><span>{fmtD(m.date)}{m.startTime && `, ${fmtClock(m.startTime)}`}</span>{m.mins > 0 && <span>{m.mins} min</span>}<span>{t.name}</span>{m.source === 'import' && <span>Imported from Fireflies</span>}</div></div>
        <div className="people">{membersOf(m.teamId).slice(0, 6).map(n => <Avatar key={n} name={n} />)}</div></div>
      <div className="tabs" role="tablist">{tabs.map(([k, l, n]) => (
        <button key={k} role="tab" aria-selected={ui.tab === k} onClick={() => setUI({ tab: k })}>{l}{n !== '' && <span className="c">{n}</span>}{k === 'commitments' && <span className="tagnew">NEW</span>}</button>))}</div>
      {ui.tab === 'commitments' && (<>
        {isMgr() ? <LiveMeeting key={m.id} m={m} /> : m.live?.startAt && !m.live.endedAt ? <MeetingWindow m={m} /> : null}
        {!isMgr() && <section className="card pad"><div className="sec"><h2>Yours from this meeting</h2><span className="hint">act here or from your {CH[t.channel][0]}; both stay in sync</span></div>
          <div className="clist">{mine.map(c => <CommitmentRow key={c.id} c={c} actions meeting={false} />)}{!mine.length && <Empty>Nothing from this meeting is yours.</Empty>}</div></section>}
        {isMgr() && <section className="card pad"><div className="sec"><h2>All commitments from this meeting</h2><span className="hint">assign anything without an owner</span></div>
          <div className="clist">{rows.map(c => <CommitmentRow key={c.id} c={c} owner meeting={false} assign actions />)}{!rows.length && <Empty>Nothing from this meeting.</Empty>}</div></section>}
      </>)}
      {ui.tab === 'summary' && (
        <section className="card pad"><div className="sec"><h2>Overview</h2><span className="hint">AI summary from Fireflies</span></div>
          {m.keywords.length > 0 && <div className="kw">{m.keywords.map(k => <span key={k}>{k}</span>)}</div>}
          <ul className="ov">{m.overview.map((x, i) => <li key={i}><Rich html={x} /></li>)}</ul>
          <div className="oldai">Action items are now Commitments: each has an owner who confirmed it, a real date and a status.</div></section>
      )}
      {ui.tab === 'transcript' && (
        <section className="card pad"><div className="sec"><h2>Transcript</h2><span className="hint">highlighted: where each commitment was said</span></div>
          <div className="tr">{m.lines.map(([tm, sp, tx], i) => (
            <div className="ts" key={i}><Avatar name={sp} /><div><div className="sp">{sp} <time>{tm}</time></div><div style={{ color: 'var(--fg-2)' }}><Rich html={tx} /></div></div></div>))}</div></section>
      )}
    </div>
  </>);
}

export function CommitmentsView() {
  const { ui, setUI, isMgr, scoped, isOpen, overdue, me, team, myTeam } = useStore();
  const rows = scoped().filter(c => c.status !== 'NotCommitment' && c.status !== 'Reassigned');
  const resolved = (c: Commitment) => ['Done', 'Dropped'].includes(c.status);
  const t = team(myTeam());
  let tabs: [string, string, (c: Commitment) => boolean][];
  let head: JSX.Element;
  if (isMgr()) {
    const pend = (c: Commitment) => isOpen(c) && c.status !== 'Unclaimed', un = (c: Commitment) => c.status === 'Unclaimed';
    tabs = [['all', 'All', () => true], ['pending', 'Pending', pend], ['resolved', 'Resolved', resolved], ['owner', 'Needs an owner', un]];
    head = <><div className="mhead"><div><h1>Team commitments</h1><div className="meta">{t.name} · every commitment from your team's meetings</div></div></div>
      <Kpis list={[[rows.length, 'All commitments'], [rows.filter(resolved).length, 'Resolved', 'good'], [rows.filter(pend).length, 'Pending'], [rows.filter(un).length, 'Needs an owner', rows.filter(un).length ? 'warnk' : '']]} /></>;
  } else {
    const conf = (c: Commitment) => c.status === 'Suggested' || (c.status === 'PendingAccept' && c.pending === me);
    const pend = (c: Commitment) => isOpen(c) && !conf(c);
    tabs = [['all', 'All', () => true], ['confirm', 'To confirm', conf], ['pending', 'Pending', pend], ['done', 'Done', resolved]];
    head = <><div className="mhead"><div><h1>My commitments</h1><div className="meta">Only the things you said you'd do. Act here or from your {CH[t.channel][0]}; both stay in sync with {trackerName(t.tracker) || 'Fireflies'}.</div></div></div>
      <Kpis list={[[rows.length, 'Total assigned'], [rows.filter(resolved).length, 'Done', 'good'], [rows.filter(isOpen).length, 'Pending'], [rows.filter(overdue).length, 'Overdue', rows.filter(overdue).length ? 'alert' : '']]} /></>;
  }
  const cur = tabs.find(x => x[0] === ui.ctab) || tabs[0];
  const list = rows.filter(cur[2]).sort((a, b) => (Number(overdue(b)) - Number(overdue(a))) || (Number(isOpen(b)) - Number(isOpen(a))) || String(a.due || '9').localeCompare(String(b.due || '9')));
  return (<>
    <Topbar crumb={isMgr() ? <>Commitments / <b>{t.name}</b></> : 'My commitments'} />
    <div className="content">{head}
      <div className="htabs" role="tablist">{tabs.map(([k, l, fn]) => (
        <button key={k} role="tab" aria-selected={cur[0] === k} onClick={() => setUI({ ctab: k })}>{l}<span className="c">{rows.filter(fn).length}</span></button>))}</div>
      <section className="card pad"><div className="clist">{list.map(c => <CommitmentRow key={c.id} c={c} actions assign={isMgr()} owner={isMgr()} />)}{!list.length && <Empty>Nothing here.</Empty>}</div></section>
    </div>
  </>);
}
