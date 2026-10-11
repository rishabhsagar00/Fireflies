import type { CSSProperties, ReactNode } from 'react';
import { type Commitment, LABEL, daysBetween, hue, initials } from '../../../shared/core.ts';

const I: Record<string, ReactNode> = {
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  fred: <><rect x="5" y="8" width="14" height="11" rx="4" /><path d="M12 4v4" /><circle cx="9.5" cy="13.5" r=".6" /><circle cx="14.5" cy="13.5" r=".6" /></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" /></>,
  tasks: <><path d="M4 6h10M4 12h10M4 18h7" /><path d="M16 17l2 2 4-4" /></>,
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  commit: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8.5 12l2.5 2.5L16 9.5" /></>,
  chart: <path d="M5 20V10M12 20V4M19 20v-7" />,
  bot: <><rect x="4" y="7" width="16" height="12" rx="3" /><path d="M9 13h.01M15 13h.01M12 3v4" /></>,
  zap: <path d="M13 3L5 14h6l-1 7 8-11h-6z" />,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  bell: <><path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21a2 2 0 004 0" /></>,
  filter: <path d="M4 5h16l-6 8v6l-4-2v-4z" />,
  hash: <path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16" />,
  grid: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 10h16M10 10v10" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 20h16" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  warn: <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></>,
  back: <path d="M15 6l-6 6 6 6" />,
  chev: <path d="M9 6l6 6-6 6" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  check: <path d="M5 12l4 4 10-10" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  swap: <path d="M7 7h12l-3-3M17 17H5l3 3" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4.5 4.5-7 8-7s7 2.5 8 7" /></>,
  refresh: <><path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 4v7h-7" /></>,
};
export const Icon = ({ n, style }: { n: string; style?: CSSProperties }) => (
  <svg className="i" viewBox="0 0 24 24" aria-hidden="true" style={style}>{I[n]}</svg>
);
export const Avatar = ({ name }: { name: string }) => (
  <span className="av" title={name} style={{ background: `hsl(${hue(name)} 42% 38%)` }}>{initials(name)}</span>
);
export const Pill = ({ c, today, isOverdue }: { c: Commitment; today: string; isOverdue: boolean }) =>
  isOverdue ? <span className="pill p-Overdue">Overdue · {daysBetween(c.due, today)}d</span>
    : <span className={`pill p-${c.status}`}>{LABEL[c.status] || c.status}</span>;

export const Kpis = ({ list }: { list: [number, string, string?][] }) => (
  <div className="kpis">{list.map(([v, k, cls]) => <div key={k} className={`kpi ${cls || ''}`}><div className="v">{v}</div><div className="k">{k}</div></div>)}</div>
);
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;
