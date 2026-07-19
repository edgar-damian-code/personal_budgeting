import type { IsoRange } from './types';

// Local-time 'YYYY-MM-DD' (the range brackets date-typed rows; local calendar is what the
// user picks, so format from local y/m/d rather than UTC).
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Default range: first of the current month through today.
export function currentMonthToDate(): IsoRange {
  const now = new Date();
  return { start: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), end: toIsoDate(now) };
}

export function rangeDays(r: IsoRange): number {
  const ms = fromIsoDate(r.end).getTime() - fromIsoDate(r.start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

// The equal-length window immediately before `r` — for month-over-month comparisons.
export function priorRange(r: IsoRange): IsoRange {
  const days = rangeDays(r);
  const priorEnd = fromIsoDate(r.start);
  priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - (days - 1));
  return { start: toIsoDate(priorStart), end: toIsoDate(priorEnd) };
}

const mdFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

// "Jul 1 – Jul 18, 2026"
export function formatRangeLabel(r: IsoRange): string {
  const a = fromIsoDate(r.start);
  const b = fromIsoDate(r.end);
  return `${mdFormatter.format(a)} – ${mdFormatter.format(b)}, ${b.getFullYear()}`;
}

// Named quick-pick ranges for the date picker.
export function presetRanges(): { label: string; range: IsoRange }[] {
  const now = new Date();
  const today = toIsoDate(now);
  const monthStart = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return toIsoDate(d);
  };
  return [
    { label: 'Month to date', range: { start: monthStart, end: today } },
    { label: 'Last month', range: { start: toIsoDate(lastMonthStart), end: toIsoDate(lastMonthEnd) } },
    { label: 'Last 30 days', range: { start: daysAgo(29), end: today } },
    { label: 'Last 90 days', range: { start: daysAgo(89), end: today } },
    { label: 'Year to date', range: { start: toIsoDate(new Date(now.getFullYear(), 0, 1)), end: today } },
  ];
}
