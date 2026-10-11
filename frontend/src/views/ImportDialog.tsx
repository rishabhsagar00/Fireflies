// Import a meeting in the format Fireflies already produces. Fireflies' own AI did the
// extraction; importing turns its action items into commitments and sends the cards.
import { useEffect, useRef, useState } from 'react';
import { http, useStore } from '../store.tsx';

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { run, busy, setUI, S } = useStore();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { fetch('/api/sample-meeting').then(r => r.text()).then(setText).catch(() => setErr('Could not load the sample file.')); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const submit = () => {
    let meeting: unknown;
    try { meeting = JSON.parse(text); } catch { setErr('This is not valid JSON. Check for a missing comma or quote.'); return; }
    setErr('');
    run('import', async () => {
      const r = await http<{ meetingId: string; count: number; owners: number }>('meetings/import', { meeting });
      onClose(); setUI({ view: 'meeting', meeting: r.meetingId, tab: 'commitments' });
      return `Imported ${r.count} commitments. ${r.owners} people got a card to confirm.`;
    });
  };
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="imp-t" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="dialog">
        <div className="dh"><div><h2 id="imp-t" style={{ fontSize: 17 }}>Import a Fireflies meeting</h2>
          <div className="note" style={{ marginTop: 4 }}>The transcript, summary and action items Fireflies already produced. Days are counted from the demo clock ({S.now.slice(0, 10)}). Team ids: {S.teams.map(t => t.id).join(', ')}.</div></div>
          <button className="btn" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="db">
          <div className="importbar">
            <button className="btn" onClick={() => fileRef.current?.click()}>Upload .json / .txt file</button>
            <button className="btn" onClick={() => fetch('/api/sample-meeting').then(r => r.text()).then(setText)}>Use sample: release in 5 days</button>
            <input ref={fileRef} type="file" accept=".json,.txt,application/json,text/plain" hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) f.text().then(setText); e.target.value = ''; }} />
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} spellCheck={false} aria-label="Fireflies meeting file" />
          {err && <div className="status-line err">{err}</div>}
        </div>
        <div className="df"><button className="btn" onClick={onClose}>Cancel</button><button className="btn pri" disabled={busy || !text.trim()} onClick={submit}>Import and send cards</button></div>
      </div>
    </div>
  );
}
