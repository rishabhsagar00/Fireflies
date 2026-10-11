// App data + the signed-in person + small derived helpers, shared through React context.
// Data comes from GET /api/state and is refreshed whenever the server sends a "changed"
// event (Server-Sent Events), so a click in Slack shows up here immediately.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  type AppState, type Commitment, type Team, type Meeting,
  CLOSED, isOpen as open, overdue as od,
} from '../../shared/core.ts';

export async function http<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch('/api/' + path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
  return j as T;
}

export type View = 'home' | 'meetings' | 'meeting' | 'commitments' | 'settings';
export interface UI {
  view: View; meeting: string; tab: 'commitments' | 'summary' | 'transcript'; ctab: string;
  rp: 'tracker' | 'fred'; edit: { id: string; kind: 'date' | 'reassign' } | null;
  open: Record<string, boolean>; fred: string | null; trkFocus: string | null;
}

interface Store {
  S: AppState; me: string; setMe: (n: string) => void; ui: UI; setUI: (p: Partial<UI>) => void;
  today: string; flash: string; busy: boolean;
  toast: (t: string, err?: boolean) => void;
  doAct: (action: string, id: string, extra?: { to?: string; date?: string }, src?: 'app' | 'msg', actor?: string) => Promise<void>;
  run: (label: string, fn: () => Promise<string | void>) => Promise<void>;
  byId: (id: string) => Commitment | undefined;
  teamOf: (c: Commitment) => Team;
  team: (id: string) => Team;
  meetingOf: (c: Commitment) => Meeting | undefined;
  membersOf: (teamId: string) => string[];
  myTeam: () => string;
  isMgr: () => boolean;
  mineC: (c: Commitment) => boolean;
  scoped: () => Commitment[];
  needsMe: () => number;
  isOpen: (c: Commitment) => boolean;
  overdue: (c: Commitment) => boolean;
}
const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;

const ME_KEY = 'ffc.me';
const readMe = () => { try { return localStorage.getItem(ME_KEY) || 'Arjun Nair'; } catch { return 'Arjun Nair'; } };

export function StoreProvider({ children, fallback }: { children: ReactNode; fallback: (err: string) => ReactNode }) {
  const [S, setS] = useState<AppState | null>(null);
  const [err, setErr] = useState('');
  const [me, setMeState] = useState(readMe);
  const [flash, setFlash] = useState('');
  const [busy, setBusy] = useState(false);
  const [toastMsg, setToast] = useState<{ t: string; err: boolean } | null>(null);
  const [ui, setUIState] = useState<UI>({ view: 'commitments', meeting: '', tab: 'commitments', ctab: 'all', rp: 'tracker', edit: null, open: {}, fred: null, trkFocus: null });
  const setUI = useCallback((p: Partial<UI>) => setUIState(u => ({ ...u, ...p })), []);
  const toastTimer = useRef<number>();

  const load = useCallback(async () => {
    try { setS(await http<AppState>('state')); setErr(''); } catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let t: number | undefined;
    const es = new EventSource('/api/events');
    es.addEventListener('changed', (e) => {
      try { const d = JSON.parse((e as MessageEvent).data); if (d.flash) { setFlash(d.flash); window.setTimeout(() => setFlash(''), 1600); } } catch { /* ignore */ }
      window.clearTimeout(t); t = window.setTimeout(load, 120);
    });
    es.onopen = () => load();
    // backup: some tunnels and proxies hold the live stream back, so also check every 2 seconds
    // (only while the page is visible) and reload as soon as anything changed
    let last = 0, stop = false;
    const check = async () => {
      if (stop || document.visibilityState !== 'visible') return;
      try {
        const r = await fetch('/api/version', { cache: 'no-store' }); const { v } = await r.json();
        if (last && v !== last) { window.clearTimeout(t); t = window.setTimeout(load, 50); }
        last = v;
      } catch { /* offline for a moment */ }
    };
    const iv = window.setInterval(check, 2000); check();
    const onShow = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onShow); window.addEventListener('focus', onShow);
    return () => { stop = true; es.close(); window.clearTimeout(t); window.clearInterval(iv); document.removeEventListener('visibilitychange', onShow); window.removeEventListener('focus', onShow); };
  }, [load]);

  const toast = useCallback((t: string, isErr = false) => {
    setToast({ t, err: isErr }); window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  }, []);
  const setMe = (n: string) => { setMeState(n); try { localStorage.setItem(ME_KEY, n); } catch { /* private mode */ } };

  const run = useCallback(async (_label: string, fn: () => Promise<string | void>) => {
    setBusy(true);
    try { const m = await fn(); if (m) toast(m); await load(); }
    catch (e: any) { toast(e.message, true); }
    finally { setBusy(false); }
  }, [load, toast]);

  const value = useMemo<Store | null>(() => {
    if (!S) return null;
    const today = S.now.slice(0, 10);
    const byId = (id: string) => S.commitments.find(c => c.id === id);
    const team = (id: string) => S.teams.find(t => t.id === id) || S.teams[0];
    const teamOf = (c: Commitment) => team(c.teamId);
    const meetingOf = (c: Commitment) => S.meetings.find(m => m.id === c.meetingId);
    const membersOf = (teamId: string) => S.members.filter(m => m.teamId === teamId).map(m => m.name);
    const myTeam = () => S.members.find(m => m.name === me)?.teamId || S.teams[0]?.id;
    const isMgr = () => team(myTeam()).manager === me;
    const mineC = (c: Commitment) => c.owner === me || (c.status === 'PendingAccept' && c.pending === me);
    const inScope = (c: Commitment) => isMgr() ? c.teamId === myTeam() : mineC(c);
    const scoped = () => S.commitments.filter(inScope);
    const overdue = (c: Commitment) => od(c, today);
    const needsMe = () => scoped().filter(c => mineC(c) && (c.status === 'Suggested' || overdue(c) || (c.status === 'PendingAccept' && c.pending === me) || (c.status === 'Confirmed' && c.due === today))).length
      + (isMgr() ? scoped().filter(c => c.status === 'Unclaimed').length : 0);
    const doAct = async (action: string, id: string, extra: { to?: string; date?: string } = {}, src: 'app' | 'msg' = 'app', actor = me) => {
      await run(action, async () => {
        const r = await http<{ message: string; flash: string }>('action', { action, id, actor, extra, src });
        setFlash(r.flash); window.setTimeout(() => setFlash(''), 1600);
        return r.message;
      });
    };
    return { S, me, setMe, ui, setUI, today, flash, busy, toast, doAct, run, byId, teamOf, team, meetingOf, membersOf, myTeam, isMgr, mineC, scoped, needsMe, isOpen: open, overdue };
  }, [S, me, ui, flash, busy, toast, run, setUI]);

  if (!value) return <>{fallback(err)}</>;
  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div className={`toast ${toastMsg.err ? 'err' : ''}`} role="status">{toastMsg.t}</div>}
    </Ctx.Provider>
  );
}
export { CLOSED };
