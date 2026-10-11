// Right panel: the Jira panel and Ask Fred. (Messages are sent for real to Slack, Teams or
// email; the list of what was sent is on the Settings page.)
import { type Commitment, firstName, fmtT, trackerName } from '../../../shared/core.ts';
import { useStore } from '../store.tsx';
import { Empty, Icon } from '../components/ui.tsx';

function FredAnswer() {
  const { scoped, isMgr, overdue, isOpen, today, setUI } = useStore();
  const rows = scoped(), od = rows.filter(overdue), dt = rows.filter(c => c.status === 'Confirmed' && c.due === today), cf = rows.filter(c => c.status === 'Suggested'), un = rows.filter(c => c.status === 'Unclaimed');
  const who = (c: Commitment) => isMgr() ? ` (${firstName(c.owner)})` : '';
  return (
    <div className="answer"><div><b>{rows.filter(isOpen).length} open</b> {isMgr() ? 'in your team' : 'commitments are yours'}.</div>
      {od.length > 0 && <div><b style={{ color: 'var(--bad)' }}>Overdue:</b> {od.map(c => c.text + who(c)).join('; ')}</div>}
      {dt.length > 0 && <div><b>Due today:</b> {dt.map(c => c.text + who(c)).join('; ')}</div>}
      {cf.length > 0 && <div><b>Waiting for confirmation:</b> {cf.map(c => c.text).join('; ')}</div>}
      {isMgr() && un.length > 0 && <div><b style={{ color: 'var(--warn)' }}>No owner:</b> {un.length}. <button className="link" onClick={() => setUI({ view: 'commitments', ctab: 'owner' })}>Assign them →</button></div>}</div>
  );
}

export function RightPanel() {
  const { S, ui, setUI, me, team, myTeam, scoped } = useStore();
  if (ui.view === 'home' || ui.view === 'settings') return null;
  const t = team(myTeam()), tn = trackerName(t.tracker);
  const rp = ui.rp === 'tracker' && tn ? 'tracker' : 'fred';
  const tabs = (
    <div className="seg" role="group" aria-label="Panel">
      {tn && <button aria-pressed={rp === 'tracker'} onClick={() => setUI({ rp: 'tracker' })}>{tn}</button>}
      <button aria-pressed={rp === 'fred'} onClick={() => setUI({ rp: 'fred' })}>Ask Fred</button>
    </div>
  );
  if (rp === 'tracker') {
    const items = scoped().filter(c => c.trk).sort((a, b) => (Number(a.trkClosed) - Number(b.trkClosed)) || String(a.due).localeCompare(String(b.due)));
    const real = S.integrations.jira && t.tracker === 'jira';
    return (
      <aside className="rp trkpanel" aria-label={tn}><div className="rh"><Icon n="layers" /><b>{tn} · {t.name}</b>{tabs}</div><div className="rb">
        <p className="note" style={{ margin: 0 }}>{real ? <>Live from your Jira (<a className="link" href={S.integrations.jiraBaseUrl} target="_blank" rel="noreferrer">{S.integrations.jiraBaseUrl.replace(/^https?:\/\//, '')}</a>). </> : <>{tn} is not connected, so keys are simulated. </>}
          Fireflies writes every change here: new issue on Confirm, due date when the date moves, {t.tracker === 'jira' ? 'Done' : 'complete'} when it is closed. Closing it in {tn} also closes it in Fireflies.</p>
        {items.map(c => (
          <div key={c.id} className={`it ${ui.trkFocus === c.id ? 'hl' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              {real && c.trk.startsWith(S.integrations.jiraProjectKey + '-') ? <a className="link" style={{ fontFamily: 'var(--mono)', fontSize: 12 }} href={`${S.integrations.jiraBaseUrl}/browse/${c.trk}`} target="_blank" rel="noreferrer">{c.trk} ↗</a> : <b style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{c.trk}</b>}
              <span className={`st ${c.trkClosed ? 'done' : 'todo'}`}>{c.trkClosed ? (t.tracker === 'jira' ? 'Done' : 'Completed') : (t.tracker === 'jira' ? 'To do' : 'Open')}</span></div>
            <div style={{ fontWeight: 600 }}>{c.text}</div><div className="note">Assignee {c.owner || 'none'} · Due {c.due} · label fireflies-commitment</div>
            {c.tlog.slice(-4).reverse().map(([tm, x], i) => <div key={i} className="lg"><time style={{ fontFamily: 'var(--mono)' }}>{fmtT(tm)}</time><span>{x}</span></div>)}
          </div>))}
        {scoped().filter(c => !c.trk && /^Could not create/.test(c.tlog[c.tlog.length - 1]?.[1] || '')).map(c => (
          <div key={c.id} className="it" style={{ borderColor: 'var(--red, #e5484d)' }}>
            <div style={{ fontWeight: 600 }}>{c.text}</div>
            <div className="note" style={{ color: 'var(--red, #e5484d)' }}>{c.tlog[c.tlog.length - 1][1]}</div>
          </div>))}
        {!items.length && <Empty>Nothing in {tn} yet. Press "Confirm + {tn}" on a commitment.</Empty>}
      </div></aside>
    );
  }
  return (
    <aside className="rp" aria-label="Ask Fred"><div className="rh"><Icon n="fred" /><b>Ask Fred</b>{tabs}</div><div className="rb fred">
      <div style={{ color: 'var(--accent-2)' }}><Icon n="spark" style={{ width: 26, height: 26 }} /></div><h3>Hi {firstName(me)}!<br />Get ready for your meeting</h3>
      <div className="fchips"><button onClick={() => setUI({ fred: 'commit' })}><Icon n="commit" />My commitments<span className="tagnew">NEW</span></button>
        <button onClick={() => setUI({ fred: 'x' })}><Icon n="check" />My action items</button><button onClick={() => setUI({ fred: 'x' })}><Icon n="zap" />Key decisions</button></div>
      {ui.fred === 'commit' && <FredAnswer />}
      {ui.fred === 'x' && <div className="answer">Ask Fred's other answers are not part of this concept prototype. Try <b>My commitments</b>.</div>}
      <div className="ask"><span className="chip"># My Meetings</span>Ask anything. Type / to run AI skills.</div></div></aside>
  );
}
