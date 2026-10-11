// The demo clock. "Now" is the real time plus an offset kept in the database, in the team's
// wall-clock time (IST). "Next morning 9:30" moves the offset so the clock lands on the next
// working day at 9:30 AM; time then keeps running normally from there, so a 48-hour
// hand-over or the hourly reminder job behave exactly as they would in production.
import { config } from '../config.ts';
import { getSetting, setSetting } from '../db.ts';
import { nextWorkday } from '../../../shared/core.ts';

interface Clock { offsetMin: number }

const local = (ms: number) => new Date(ms + config.tzOffsetMinutes * 60000).toISOString().slice(0, 16);

export async function now(): Promise<string> {
  const c = await getSetting<Clock>('clock', { offsetMin: 0 });
  return local(Date.now() + c.offsetMin * 60000);
}

/** set the clock so that it reads `target` ("YYYY-MM-DDTHH:MM", team time) right now */
export async function setNow(target: string) {
  const targetMs = new Date(target + ':00Z').getTime() - config.tzOffsetMinutes * 60000;
  await setSetting('clock', { offsetMin: Math.round((targetMs - Date.now()) / 60000) });
}

export async function nextMorning(): Promise<string> {
  const n = await now();
  const t = nextWorkday(n.slice(0, 10)) + 'T09:30';
  await setNow(t);
  return t;
}
