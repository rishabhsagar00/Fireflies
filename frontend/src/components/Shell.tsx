// The app frame: concept bar (signed in as, demo clock), left navigation, the Meetings
// channel list and the top bar of each page.
import type { ReactNode } from 'react';
import { firstName, fmtClock, fmtD, hue, initials } from '../../../shared/core.ts';
import { http, useStore, type View } from '../store.tsx';
import { Icon } from './ui.tsx';

export function ConceptBar({ onImport }: { onImport: () => void }) {
  const { S, me, setMe, setUI, run, busy, team } = useStore();
  return (
    <div className="concept" role="region" aria-label="Prototype notice">
      <div><b>Concept prototype</b> · Commitments, a proposed Fireflies.ai feature (capstone project, not an official Fireflies product)</div>
      <div className="ctl">
        <label htmlFor="me" style={{ color: 'var(--fg-3)' }}>Signed in as</label>
        <select id="me" className="sm" style={{ maxWidth: 220 }} value={me}
          onChange={e => { setMe(e.target.value); setUI({ edit: null, ctab: 'all', fred: null, view: 'commitments' }); }}>
          {S.teams.map(t => (
            <optgroup key={t.id} label={t.name}>
              {S.members.filter(m => m.teamId === t.id).map(m => <option key={m.name} value={m.name}>{m.name}{team(t.id).manager === m.name ? ' · manager' : ''}</option>)}
            </optgroup>
          ))}
        </select>
        <button className="ghost" onClick={onImport} disabled={busy}>Import Fireflies meeting</button>
        <span className="clockbox" title="Demo clock: reminders follow this time">{fmtD(S.now.slice(0, 10))}, {fmtClock(S.now.slice(11))} IST</span>
        <button className="ghost" disabled={busy} title="Move the clock to the next working day 9:30 AM and send the reminders that are due"
          onClick={() => run('advance', async () => {
            const r = await http<{ now: string; count: number; sent: number }>('clock/next-morning', {});
            return `${fmtD(r.now.slice(0, 10))}, 9:30 AM. ${r.count ? `${r.count} reminder${r.count > 1 ? 's' : ''} or hand-over change${r.count > 1 ? 's' : ''}, ${r.sent} message${r.sent === 1 ? '' : 's'} sent.` : 'Nothing due.'}`;
          })}>Next morning 9:30 →</button>
      </div>
    </div>
  );
}

const NAV: ([View | string, string, string] | null)[] = [['home', 'Home', 'home'], ['fred', 'AskFred', 'fred'], null, ['meetings', 'Meetings', 'video'], ['tasks', 'Tasks', 'tasks'], ['skills', 'AI Skills', 'spark'], ['commitments', 'Commitments', 'commit'], null, ['analytics', 'Analytics', 'chart'], ['voice', 'Voice Agents', 'bot']];
const LIVE = ['home', 'meetings', 'commitments', 'settings'];

export function Nav() {
  const { ui, setUI, me, needsMe, toast } = useStore();
  const slim = ui.view !== 'home', cur = ui.view === 'meeting' ? 'meetings' : ui.view, n = needsMe();
  const item = ([k, l, i]: [string, string, string]) => {
    const live = LIVE.includes(k);
    return (
      <button key={k} className={`it ${live ? '' : 'muted'}`} aria-current={cur === k} aria-label={l} title={l + (live ? '' : ' (not part of this concept)')}
        onClick={() => live ? setUI({ view: k as View, edit: null, ...(k === 'commitments' ? { ctab: 'all' } : {}) }) : toast('Not part of this concept prototype. Try Meetings or Commitments.')}>
        <Icon n={i} />{!slim && <span className="lbl">{l}</span>}
        {k === 'commitments' && <>{n > 0 && <span className="badge num" title="Needs your attention">{n}</span>}<span className="new">NEW</span></>}
      </button>
    );
  };
  return (
    <nav className={`nav ${slim ? 'slim' : 'wide'}`} aria-label="Main">
      <div className="ws"><span className="sq" style={{ background: `hsl(${hue(me)} 42% 42%)` }}>{initials(me)}</span>{!slim && firstName(me)}</div>
      {NAV.map((x, i) => x ? item(x) : <div key={'s' + i} className="sep" />)}
      <div className="spacer" />{item(['integrations', 'Integrations', 'layers'])}{item(['settings', 'Settings', 'gear'])}
    </nav>
  );
}

export function SubNav() {
  const { ui, setUI, team, myTeam, toast } = useStore();
  if (ui.view !== 'meetings' && ui.view !== 'meeting') return null;
  const items: [string, string, string][] = [['all', 'My Meetings', 'hash'], ['allm', 'All Meetings', 'grid'], ['voice', 'Voice Agent Meetings', 'bot'], ['uploads', 'Uploads', 'upload']];
  return (
    <aside className="sub" aria-label="Meeting channels">
      <div className="search"><Icon n="search" />Search channels</div>
      <div className="list">{items.map(([k, l, i]) => (
        <button key={k} aria-current={k === 'all'} className={k === 'all' ? '' : 'muted'} onClick={() => k === 'all' ? setUI({ view: 'meetings' }) : toast('Not part of this concept prototype.')}>
          <span className="hash"><Icon n={i} /></span>{l}{k === 'uploads' && <span className="tagnew">NEW</span>}
        </button>))}
      </div>
      <div className="hd">All channels</div>
      <div className="list"><button onClick={() => setUI({ view: 'meetings' })}><span className="hash"><Icon n="hash" /></span>{team(myTeam()).name}</button></div>
    </aside>
  );
}

export function Topbar({ crumb }: { crumb: ReactNode }) {
  const { setUI, needsMe, toast } = useStore();
  return (
    <div className="top"><span className="crumb">{crumb}</span>
      <div className="q"><Icon n="search" />Search by title or keyword<kbd>⌘K</kbd></div>
      <button className="bell" aria-label="Commitments that need you" onClick={() => setUI({ view: 'commitments' })}><Icon n="bell" />{needsMe() > 0 && <span className="dot" />}</button>
      <button className="capture" onClick={() => toast('Not part of this concept prototype.')}><Icon n="video" />Capture</button>
    </div>
  );
}
