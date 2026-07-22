// Expands detected recurring rows (gold.forecast_recurring) into concrete dated ledger
// items across the forecast window. This is the SEED for the editable ledger — once the
// user edits, their copy in localStorage wins until they hit "Restore auto-detected".
//
// Detection lives in gold; this file only knows how to turn a cadence into dates.

import { addMonths, dayInMonth, dayOffset, isValidISO, lastDayOfMonth, parseISO } from './dates';
import type { LedgerItem, RecurringRow } from './types';

const BIWEEKLY_DAYS = 14;

// Seeded ids are derived from the row identity + date rather than a counter, so
// re-seeding produces byte-identical ids: React keys stay stable and "Restore
// auto-detected" doesn't remount every row.
function seedId(description: string, dateISO: string, dedupe: number): string {
  const slug = description.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `seed:${slug}:${dateISO}${dedupe > 0 ? `:${dedupe}` : ''}`;
}

// Every date the given cadence produces inside [startISO, endISO].
function datesFor(row: RecurringRow, startISO: string, endISO: string): string[] {
  const cadence = String(row.cadence);
  const out: string[] = [];

  if (cadence === 'biweekly') {
    if (!isValidISO(row.anchor_date)) return out;
    const anchor = row.anchor_date as string;
    // Normalize the anchor into the window by whole 14-day steps. The anchor is usually in
    // the PAST (it's the last real occurrence), so this steps forward — but it also handles
    // a future anchor by stepping backward, which Math.ceil gives us for free.
    const steps = Math.ceil(dayOffset(anchor, startISO) / BIWEEKLY_DAYS);
    let cursor = parseISO(anchor) + steps * BIWEEKLY_DAYS * 86_400_000;
    const endMs = parseISO(endISO);
    while (cursor <= endMs) {
      out.push(new Date(cursor).toISOString().slice(0, 10));
      cursor += BIWEEKLY_DAYS * 86_400_000;
    }
    return out;
  }

  // monthly / semimonthly are day-of-month driven. Walk each month the window touches —
  // starting one month back, since a window opening mid-month still needs that month's
  // earlier days evaluated (they just fall outside the range and get filtered below).
  const dom = Number(row.day_of_month);
  if (!Number.isFinite(dom)) return out;

  let month = addMonths(startISO, -1);
  const lastMonth = addMonths(endISO, 1);
  while (parseISO(month) <= parseISO(lastMonth)) {
    out.push(dayInMonth(month, dom));
    if (cadence === 'semimonthly') {
      // The second leg is the LAST day of the month — the pair the user actually gets paid
      // on. Guard against a same-day collision if day_of_month ever equals the month end.
      const eom = dayInMonth(month, lastDayOfMonth(month));
      if (eom !== out[out.length - 1]) out.push(eom);
    }
    month = addMonths(month, 1);
  }
  return out;
}

/**
 * Expand every recurring row into dated ledger items covering `days` from `startISO`
 * (inclusive of both ends). Rows with no usable schedule or a non-positive amount are
 * skipped rather than dropped onto day 0.
 */
export function expandRecurring(rows: RecurringRow[], startISO: string, days: number): LedgerItem[] {
  const endISO = new Date(parseISO(startISO) + (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const items: LedgerItem[] = [];
  const used = new Map<string, number>();

  for (const row of rows) {
    const amount = Math.abs(Number(row.typical_amount) || 0);
    if (amount <= 0) continue;
    const type = String(row.direction) === 'in' ? ('in' as const) : ('out' as const);
    const desc = String(row.description);
    const group = String(row.group ?? 'Other');

    for (const dateISO of datesFor(row, startISO, endISO)) {
      if (dateISO < startISO || dateISO > endISO) continue;
      const key = `${desc}|${dateISO}`;
      const dedupe = used.get(key) ?? 0;
      used.set(key, dedupe + 1);
      items.push({ id: seedId(desc, dateISO, dedupe), dateISO, desc, group, type, amount });
    }
  }

  items.sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.desc.localeCompare(b.desc));
  return items;
}
