// One commitment, kept short so anyone can read it at a glance:
//   line 1  the task + its action buttons (the same set as the Slack card)
//   line 2  status · due date · owner · meeting
//   line 3  who did what, from where ("Confirmed by Arjun in Slack · 4:30 PM")
//   line 4  only if linked: who this waits on, or who is waiting on it
// The full timeline of the chain and the history open under "Details".
import { type Commitment, chainOf, daysBetween, firstName, fmtD, fmtT, isDate, lastUpdate, trackerName } from '../../../shared/core.ts';
import { useStore } from '../store.tsx';
import { Icon, Pill } from './ui.tsx';

function ActionButtons({ c }: { c: Commitment }) {
  const { mineC, me, teamOf, doAct, setUI, busy } = useStore();
  if (!mineC(c)) return null;
  const tn = trackerName(teamOf(c).tracker);
  const run = (a: string) => { if (a === 'date' || a === 'reassign') setUI({ edit: { id: c.id, kind: a } }); else { setUI({ edit: null }); doAct(a, c.id); } };
  const B = (a: string, icon: string, label: string, cls = '') => (
    <button key={a} className={`ab ${cls}`} disabled={busy} title={label} onClick={() => run(a)}><Icon n={icon} /><span>{label}</span></button>
  );
  // every action is a visible button, the same set as in the Slack card
  if (c.status === 'PendingAccept') return c.pending === me ? <>{B('accept', 'check', 'Accept', 'go')}{B('decline', 'x', 'Decline')}</> : null;
  if (c.status === 'Suggested') return (<>
    {B('confirm', 'check', 'Confirm', 'go')}
    {tn && B('push_tracker', 'plus', `Confirm + ${tn}`)}
    {B('date', 'cal', 'Date')}
    {B('reassign', 'swap', 'Reassign')}
    {c.dep && B('unlink', 'x', 'Unlink')}
    {B('not_commitment', 'x', 'Not a commitment')}
    {B('drop', 'trash', 'Drop', 'no')}
  </>);
  if (c.status === 'Confirmed' || c.status === 'Waiting') return (<>
    {c.status === 'Confirmed' && B('done', 'check', 'Done', 'go')}
    {tn && !c.trk && B('push_tracker', 'plus', `Add to ${tn}`)}
    {B('date', 'cal', 'Date')}
    {B('reassign', 'swap', 'Reassign')}
    {c.dep && B('unlink', 'x', 'Unlink')}
    {B('drop', 'trash', 'Drop', 'no')}
  </>);
  return null;
}

function Timeline({ c }: { c: Commitment }) {
  const { S, mineC, isOpen, overdue } = useStore();
  const ch = chainOf(c, S.commitments);
  if (ch.length < 2) return null;
  return (
    <div className="tl" aria-label="Timeline">
      {ch.map((x, i) => {
        const prev = ch[i - 1];
        const gap = prev && isDate(prev.due) && isDate(x.due) ? daysBetween(prev.due, x.due) : null;
        const who = x.status === 'PendingAccept' ? `${firstName(x.owner)} → ${firstName(x.pending)}` : x.owner ? (mineC(x) ? 'You' : firstName(x.owner)) : 'No owner yet';
        const state = x.status === 'PendingAccept' || x.status === 'Unclaimed' ? 'hand' : x.status === 'Done' ? 'done' : x.status === 'Dropped' ? 'dropped' : overdue(x) ? 'late' : (prev && isOpen(prev)) ? 'wait' : 'now';
        const label = {
          hand: x.status === 'Unclaimed' ? 'With the manager to assign' : `Waiting for ${firstName(x.pending)} to accept`,
          done: 'Done', dropped: 'Dropped', late: 'Overdue', wait: 'Starts after the step before',
          now: x.status === 'Suggested' ? 'Not confirmed yet' : 'In progress',
        }[state];
        return (
          <span key={x.id} style={{ display: 'contents' }}>
            {i > 0 && <span className="tl-arrow" aria-hidden="true">→</span>}
            <div className={`tl-step ${x.id === c.id ? 'me' : ''} ${state}`}>
              <div className="tl-date">{isDate(x.due) ? fmtD(x.due) : 'No date'}{gap !== null && <span> ({gap >= 0 ? '+' : ''}{gap} day{Math.abs(gap) === 1 ? '' : 's'})</span>}</div>
              <div className="tl-who">{who}</div><div className="tl-text">{x.text}</div><div className="tl-state">{label}</div>
            </div>
          </span>
        );
      })}
    </div>
  );
}

export function CommitmentRow({ c, actions = false, owner = false, meeting = true, assign = false }: { c: Commitment; actions?: boolean; owner?: boolean; meeting?: boolean; assign?: boolean }) {
  const { S, ui, setUI, me, teamOf, meetingOf, membersOf, doAct, today, overdue, flash, busy, isOpen, team } = useStore();
  const m = meetingOf(c), t = teamOf(c), tn = trackerName(t.tracker);
  const ed = ui.edit && ui.edit.id === c.id ? ui.edit.kind : '';
  const teammates = membersOf(c.teamId).filter(p => p !== c.owner);
  const closed = ['Dropped', 'NotCommitment', 'Reassigned'].includes(c.status);
  const last = lastUpdate(c);
  const conf = [...c.history].reverse().find(([, x]) => /^Confirmed by /.test(x));
  const confText = conf ? conf[1].split('. ')[0] : '';
  const dep = c.dep ? S.commitments.find(x => x.id === c.dep) : undefined;
  const waiters = S.commitments.filter(x => x.dep === c.id && isOpen(x) && x.owner);
  const you = (n: string) => n === me ? 'You' : firstName(n);
  return (
    <div className={`r ${closed ? 'strike' : ''} ${flash === c.id ? 'flash' : ''}`}>
      <div className="r-top"><div className="ctext">{c.text}</div><div className="r-acts">{actions && <ActionButtons c={c} />}</div></div>
      <div className="r-meta">
        <Pill c={c} today={today} isOverdue={overdue(c)} />
        <span className="due">{isDate(c.due) ? <>Due <b>{fmtD(c.due)}</b></> : 'No date yet'}</span>
        {owner && <span>{c.owner ? <><Icon n="user" style={{ width: 13, height: 13 }} /> {c.owner}</> : <b style={{ color: 'var(--warn)' }}>No owner</b>}</span>}
        {c.status === 'PendingAccept' && <span style={{ color: 'var(--cyan)' }}>{c.pending === me ? `${firstName(c.owner)} asked you to take this` : `Waiting for ${firstName(c.pending)} to accept`}</span>}
        {meeting && m && <button className="link quiet" onClick={() => setUI({ view: 'meeting', meeting: m.id, tab: 'commitments', edit: null })}>{m.title}</button>}
        {c.trk && <button className={`trk ${c.trkClosed ? 'closed' : ''}`} onClick={() => setUI({ rp: 'tracker', trkFocus: c.id, view: ui.view === 'home' ? 'commitments' : ui.view })} title={`Open in ${tn || 'tracker'}`}>{c.trk}</button>}
      </div>
      {last && <div className="r-last"><Icon n="check" style={{ width: 13, height: 13 }} />{last.text}<span className="t"> · {fmtT(last.at)}</span>{confText && confText !== last.text && <span className="t"> · {confText}</span>}</div>}
      {dep && isOpen(dep) && <div className="r-link"><Icon n="clock" style={{ width: 13, height: 13 }} />Starts after <b>{you(dep.owner) || (dep.status === 'Unclaimed' ? 'an unassigned step' : 'someone')}</b>{dep.owner ? ' finish' + (dep.owner === me ? '' : 'es') : ''} "{dep.text}" · due {fmtD(dep.due)}{dep.status === 'Unclaimed' ? ` (with ${firstName(team(dep.teamId).manager)} to assign)` : ''}</div>}
      {waiters.length > 0 && isOpen(c) && <div className="r-link"><Icon n="user" style={{ width: 13, height: 13 }} /><b>{waiters.map(x => you(x.owner)).join(', ')}</b>&nbsp;{waiters.length > 1 || waiters[0].owner === me ? 'are' : 'is'} waiting on this · next step due {fmtD(waiters[0].due)}</div>}
      {c.status === 'Unclaimed' && !assign && <div className="r-link">With {firstName(t.manager)} to assign</div>}
      {ed === 'date' && (
        <div className="edit"><label htmlFor={`ed-${c.id}`}>New due date</label>
          <input type="date" id={`ed-${c.id}`} defaultValue={isDate(c.due) ? c.due : ''} disabled={busy}
            onChange={e => { if (e.target.value) { setUI({ edit: null }); doAct('edit_date', c.id, { date: e.target.value }); } }} />
          {waiters.length > 0 && <span className="note">Steps waiting on this move by the same number of days.</span>}
          <button className="link" onClick={() => setUI({ edit: null })}>Cancel</button></div>
      )}
      {ed === 'reassign' && (
        <div className="edit"><label htmlFor={`ed-${c.id}`}>Give this to</label>
          <select id={`ed-${c.id}`} className="sm" defaultValue="" disabled={busy}
            onChange={e => { if (e.target.value) { setUI({ edit: null }); doAct('reassign', c.id, { to: e.target.value }); } }}>
            <option value="">Choose a teammate…</option>{teammates.map(p => <option key={p}>{p}</option>)}
          </select><span className="note">They'll be asked to accept. The date stays {fmtD(c.due)}.</span>
          <button className="link" onClick={() => setUI({ edit: null })}>Cancel</button></div>
      )}
      {assign && (c.status === 'Unclaimed' || (c.status === 'Suggested' && c.owner !== me && t.manager === me)) && (
        <div className="edit"><label htmlFor={`as-${c.id}`}>{c.status === 'Unclaimed' ? 'Assign to' : 'Not confirmed yet · assign to'}</label>
          <select className="sm" id={`as-${c.id}`} defaultValue="" disabled={busy}
            onChange={e => { if (e.target.value) doAct('claim', c.id, { to: e.target.value }); }}>
            <option value="">{c.status === 'Unclaimed' ? 'Choose who this belongs to…' : 'Choose someone else…'}</option>{membersOf(c.teamId).filter(p => p !== c.owner).map(p => <option key={p}>{p}</option>)}
          </select><span className="note">They get a message to confirm.</span></div>
      )}
      <button className="link quiet details" aria-expanded={!!ui.open[c.id]} onClick={() => setUI({ open: { ...ui.open, [c.id]: !ui.open[c.id] } })}>{ui.open[c.id] ? 'Hide details' : 'Details'}</button>
      {ui.open[c.id] && <>
        <Timeline c={c} />
        {c.quote && <div className="quote">“{c.quote}”</div>}
        <div className="hist">{c.history.map(([t, x], i) => <div key={i}><time>{fmtT(t)}</time><span>{x}</span></div>)}</div>
      </>}
    </div>
  );
}
