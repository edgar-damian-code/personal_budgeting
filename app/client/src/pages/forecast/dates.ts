// UTC-safe date helpers for the forecast window.
//
// Every date in the forecast is a bare calendar date (yyyy-mm-dd) with no time component.
// We parse them at UTC midnight and do all arithmetic in UTC so a user in a negative-offset
// timezone never sees a payment slide to the previous day. `todayISO()` is the one place we
// read the LOCAL clock — "today" should match the user's calendar, not UTC's.

const DAY_MS = 86_400_000;

export function todayISO(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

export function parseISO(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return isoOf(parseISO(iso) + n * DAY_MS);
}

// Whole days from `fromISO` to `toISO` (negative when toISO is earlier).
export function dayOffset(fromISO: string, toISO: string): number {
  return Math.round((parseISO(toISO) - parseISO(fromISO)) / DAY_MS);
}

export function isValidISO(iso: string | null | undefined): boolean {
  return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(parseISO(iso));
}

// Last calendar day of the month containing `iso` (28-31).
export function lastDayOfMonth(iso: string): number {
  const d = new Date(parseISO(iso));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

// First-of-month ISO for the month containing `iso`.
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

// Advance `iso` by n months, landing on the 1st.
export function addMonths(iso: string, n: number): string {
  const d = new Date(parseISO(monthStart(iso)));
  return isoOf(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

// Build a date in the month containing `monthISO` on `day`, CLAMPED to the month's length.
// A bill on the 31st posts on Feb 28; a bill on day 0/negative is pulled to the 1st.
export function dayInMonth(monthISO: string, day: number): string {
  const clamped = Math.min(Math.max(Math.round(day), 1), lastDayOfMonth(monthISO));
  return `${monthISO.slice(0, 7)}-${String(clamped).padStart(2, '0')}`;
}

const dayLabelFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dayLongFmt = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

// "Jul 21"
export function formatDayLabel(iso: string): string {
  return dayLabelFmt.format(new Date(parseISO(iso)));
}

// "July 21, 2026"
export function formatDayLong(iso: string): string {
  return dayLongFmt.format(new Date(parseISO(iso)));
}
