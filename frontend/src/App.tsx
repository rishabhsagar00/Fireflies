import { useState } from 'react';
import { StoreProvider, useStore } from './store.tsx';
import { ConceptBar, Nav, SubNav } from './components/Shell.tsx';
import { HomeView, MeetingsView, MeetingView, CommitmentsView } from './views/MainViews.tsx';
import { SettingsView } from './views/SettingsView.tsx';
import { RightPanel } from './views/RightPanel.tsx';
import { ImportDialog } from './views/ImportDialog.tsx';
import { ActPage } from './views/ActPage.tsx';

function Shell() {
  const { ui } = useStore();
  const [importing, setImporting] = useState(false);
  const open = () => setImporting(true);
  const main = ui.view === 'home' ? <HomeView onImport={open} /> : ui.view === 'meetings' ? <MeetingsView onImport={open} />
    : ui.view === 'meeting' ? <MeetingView /> : ui.view === 'settings' ? <SettingsView /> : <CommitmentsView />;
  const sub = ui.view === 'meetings' || ui.view === 'meeting', rp = ui.view !== 'home' && ui.view !== 'settings';
  return (<>
    <ConceptBar onImport={open} />
    <div className="app" style={{ gridTemplateColumns: ['auto', sub ? 'auto' : '', 'minmax(0,1fr)', rp ? 'auto' : ''].filter(Boolean).join(' ') }}>
      <Nav /><SubNav /><main className="main">{main}</main><RightPanel />
    </div>
    {importing && <ImportDialog onClose={() => setImporting(false)} />}
  </>);
}

export default function App() {
  if (location.pathname === '/act') return <ActPage />;
  return (
    <StoreProvider fallback={err => (
      <div className="act-page"><div className="act-card"><div className="hd">FIREFLIES · COMMITMENTS</div>
        <div className="bd">{err ? <><b>Could not reach the server.</b><span className="note">{err}</span><button className="btn" onClick={() => location.reload()}>Try again</button></> : <span className="spin" aria-label="Loading" />}</div></div></div>
    )}>
      <Shell />
    </StoreProvider>
  );
}
