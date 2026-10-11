// /act — opened from a button in a Teams card or an email. It shows what will happen and
// asks for one click (mail scanners open links on their own, so nothing changes on page load).
import { useEffect, useState } from 'react';
import { firstName } from '../../../shared/core.ts';

interface Info { toName: string; text: string; status: string; open: boolean; due: string; dueText: string; title: string; channel: string; allowed: string[]; teammates: string[] }
const VERB: Record<string, string> = {
  confirm: 'Confirm this commitment', push_tracker: 'Confirm and add it to Jira', not_commitment: 'Mark as not a commitment', drop: 'Drop this commitment',
  done: 'Mark it done', snooze: 'Move it 1 day later', accept: 'Accept and take it over', decline: 'Decline', keep_waiting: 'Keep waiting',
  edit_date: 'Change the due date', reassign: 'Ask a teammate to take it over',
};

export function ActPage() {
  const q = new URLSearchParams(location.search);
  const m = q.get('m') || '', c = q.get('c') || '', a = q.get('a') || '', t = q.get('t') || '';
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState('');
  const [val, setVal] = useState('');
  const [done, setDone] = useState<{ message: string; status: string; dueText: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/link?m=${encodeURIComponent(m)}&c=${encodeURIComponent(c)}&t=${encodeURIComponent(t)}`)
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setInfo(j); if (a === 'edit_date') setVal(j.due || ''); })
      .catch(e => setErr(e.message));
  }, [m, c, t, a]);
  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ m, c, t, a, v: val }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error); setDone(j);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const needsVal = a === 'edit_date' || a === 'reassign';
  return (
    <div className="act-page"><div className="act-card">
      <div className="hd">FIREFLIES · COMMITMENTS <span style={{ color: 'var(--fg-3)', letterSpacing: 0, fontWeight: 400 }}>· concept prototype</span></div>
      <div className="bd">
        {!info && !err && <span className="spin" aria-label="Loading" />}
        {info && <>
          <div className="note">For {info.toName} · from {info.channel === 'teams' ? 'Microsoft Teams' : info.channel === 'email' ? 'email' : 'Slack'}</div>
          <h1>{info.text}</h1>
          <div className="note">{done ? `${done.status} · Due ${done.dueText}` : `${info.status} · Due ${info.dueText}`}</div>
          {done ? <div className="res">✓ {done.message}</div> : !info.open ? <div className="res">This commitment is already closed ({info.status}).</div>
            : !info.allowed.includes(a) ? <div className="res err">This button no longer applies (the commitment changed). Open Fireflies to update it.</div> : <>
              {a === 'edit_date' && <label className="field">New due date<input className="inp" type="date" value={val} onChange={e => setVal(e.target.value)} /></label>}
              {a === 'reassign' && <label className="field">Give this to (they will be asked to accept)<select className="inp" value={val} onChange={e => setVal(e.target.value)}><option value="">Choose a teammate…</option>{info.teammates.map(p => <option key={p}>{p}</option>)}</select></label>}
              <div><button className="btn pri" disabled={busy || (needsVal && !val)} onClick={submit}>{busy ? 'Saving…' : `${VERB[a] || 'Continue'}${a === 'accept' || a === 'decline' ? '' : ` as ${firstName(info.toName)}`}`}</button></div>
            </>}
        </>}
        {err && <div className="res err">{err}</div>}
        <a className="link" href="/">Open Fireflies Commitments →</a>
      </div>
    </div></div>
  );
}
