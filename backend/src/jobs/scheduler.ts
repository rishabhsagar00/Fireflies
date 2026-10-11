// Real schedule (in addition to the "Next morning 9:30" demo button):
//  - every hour at :30, send whatever reminders are due (9:30 AM - 8 PM team time, weekdays)
//  - Friday 5:30 PM, email the weekly report of each team that has real messages on
import cron from 'node-cron';
import { config, emailReady } from '../config.ts';
import { newCtx, flush, serial } from '../domain/service.ts';
import { runReminders } from '../domain/engine.ts';
import { loadWorld, getRouting, getLiveTeams } from '../db.ts';
import { dueFredPosts } from '../domain/meetingRecap.ts';
import { now } from '../domain/clock.ts';
import { weeklyReport } from '../notify/render.ts';
import * as email from '../integrations/email.ts';
import { dow } from '../../../shared/core.ts';

const base = () => config.publicUrl || `http://localhost:${config.port}`;

export async function hourlyReminders() {
  return serial(async () => {
    const ctx = await newCtx();
    const hm = Number(ctx.now.slice(11, 13)) * 60 + Number(ctx.now.slice(14, 16));
    if ([0, 6].includes(dow(ctx.today())) || hm < 9 * 60 + 30 || hm >= 20 * 60) return 0;
    const n = runReminders(ctx);
    if (n) await flush(ctx, base());
    return n;
  });
}

export async function fridayReports() {
  const [w, routing, live, n] = await Promise.all([loadWorld(), getRouting(), getLiveTeams(), now()]);
  if (!emailReady() || !routing.email) return;
  for (const t of w.teams.filter(x => live.includes(x.id))) {
    const r = weeklyReport(t, w, n.slice(0, 10));
    await email.sendEmail(routing.email, `[Demo: for all members] ${r.subject}`, r.html).catch(e => console.error('[report]', t.id, e.message));
  }
}

/** every minute: Fred posts the status in the meeting chat once a running meeting is 2 minutes old */
export async function fredCheck() {
  return serial(async () => { const ctx = await newCtx(); const n = dueFredPosts(ctx); if (n) await flush(ctx, base()); return n; });
}

export function startScheduler() {
  cron.schedule('* * * * *', () => { fredCheck().catch(e => console.error('[fred]', e)); }, { timezone: 'Asia/Kolkata' });
  if (!config.enableScheduler) return;
  cron.schedule('30 * * * *', () => { hourlyReminders().catch(e => console.error('[reminders]', e)); }, { timezone: 'Asia/Kolkata' });
  cron.schedule('30 17 * * 5', () => { fridayReports().catch(e => console.error('[reports]', e)); }, { timezone: 'Asia/Kolkata' });
  console.log('Scheduler on: commitment reminders hourly at :30, weekly report Friday 5:30 PM IST');
}
