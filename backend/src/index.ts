import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config.ts';
import { migrate, pool } from './db.ts';
import { api } from './routes/api.ts';
import { hooks } from './routes/hooks.ts';
import { subscribe, currentVersion } from './events.ts';
import { resetDemo } from './domain/seed.ts';
import { startScheduler } from './jobs/scheduler.ts';

const app = express();
app.set('trust proxy', true);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/events', subscribe);
app.get('/api/version', (_req, res) => { res.set('Cache-Control', 'no-store'); res.json({ v: currentVersion() }); });
app.use('/api', hooks);                      // Slack / Jira / action links (own body parsers)
app.use('/api', express.json({ limit: '2mb' }), api);

// the built React app (frontend/dist), with client-side routes such as /act
const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '../../frontend/dist');
if (existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
}

await migrate();
const { rows } = await pool.query('select count(*)::int as n from teams');
if (!rows[0].n) { console.log('Empty database: loading the demo organisation'); await resetDemo(); }
startScheduler();
app.listen(config.port, () => console.log(`Fireflies Commitments on http://localhost:${config.port}`));
