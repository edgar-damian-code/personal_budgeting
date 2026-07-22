// The forecast engine: ledger items + planned card payments -> dated events with a running
// balance, a daily series for the chart, and week buckets for the ledger.
//
// Everything downstream (KPIs, chart, ledger) reads from buildEvents' output so there is
// exactly one running-balance calculation in the page.

import { cardColor } from '../creditcards/cards';
import { addDays, dayOffset, isValidISO } from './dates';
import type { ForecastEvent, LedgerItem, Plan, WeekBucket } from './types';

export const WINDOW_DAYS = 56; // 8 weeks
export const DAYS_PER_WEEK = 7;

// Within a single day, order income first, then ordinary outflows, then card payments.
// Payments are the discretionary lever, so showing them last makes the "can I afford this
// payment on this day" read correct — the balance they draw from is already settled.
const ORDER: Record<string, number> = { in: 0, out: 1 };
function rankOf(ev: { type: string; editable: boolean }): number {
  if (!ev.editable) return 2; // card payment
  return ORDER[ev.type] ?? 1;
}

export type BuildEventsArgs = {
  items: LedgerItem[];
  plan: Plan;
  cardNames: Record<string, string>;
  startISO: string;
  days: number;
  startBal: number;
};

/**
 * Merge editable ledger items and planned card payments into one date-ordered event list,
 * each carrying the balance AFTER it posts. Events outside the window are dropped.
 */
export function buildEvents({
  items,
  plan,
  cardNames,
  startISO,
  days,
  startBal,
}: BuildEventsArgs): ForecastEvent[] {
  const lastOff = days - 1;
  const events: ForecastEvent[] = [];

  for (const item of items) {
    if (!isValidISO(item.dateISO)) continue;
    const off = dayOffset(startISO, item.dateISO);
    if (off < 0 || off > lastOff) continue;
    const amount = Math.abs(Number(item.amount) || 0);
    events.push({
      off,
      dateISO: item.dateISO,
      desc: item.desc,
      group: item.group,
      type: item.type,
      sign: item.type === 'in' ? 1 : -1,
      amount,
      balAfter: 0, // filled below
      editable: true,
      itemId: item.id,
    });
  }

  for (const [cardNum, payments] of Object.entries(plan)) {
    for (const p of payments) {
      const amt = Number(p.amt) || 0;
      if (amt <= 0 || !isValidISO(p.date)) continue;
      const off = dayOffset(startISO, p.date);
      if (off < 0 || off > lastOff) continue;
      events.push({
        off,
        dateISO: p.date,
        desc: `Payment — ${cardNames[cardNum] ?? `Card ··${cardNum}`}`,
        group: 'Credit Card',
        type: 'out',
        sign: -1,
        amount: amt,
        balAfter: 0,
        editable: false,
        color: cardColor(cardNum),
      });
    }
  }

  events.sort((a, b) => a.off - b.off || rankOf(a) - rankOf(b) || b.amount - a.amount);

  let balance = startBal;
  for (const ev of events) {
    balance += ev.sign * ev.amount;
    ev.balAfter = balance;
  }
  return events;
}

/**
 * End-of-day balance for each of the `days` days in the window. Days with no events carry
 * the previous day's closing balance forward, so the chart is a continuous line.
 */
export function dailyBalances(events: ForecastEvent[], startBal: number, days: number): number[] {
  const series = new Array<number>(days);
  let balance = startBal;
  let i = 0;
  for (let off = 0; off < days; off++) {
    while (i < events.length && events[i].off <= off) {
      balance = events[i].balAfter;
      i++;
    }
    series[off] = balance;
  }
  return series;
}

/** Group events into 7-day buckets, carrying the balance through weeks with no activity. */
export function computeWeeks(
  events: ForecastEvent[],
  startBal: number,
  startISO: string,
  days: number,
): WeekBucket[] {
  const weekCount = Math.ceil(days / DAYS_PER_WEEK);
  const weeks: WeekBucket[] = [];
  let carry = startBal;

  for (let index = 0; index < weekCount; index++) {
    const inWeek = events.filter((e) => Math.floor(e.off / DAYS_PER_WEEK) === index);
    if (inWeek.length > 0) carry = inWeek[inWeek.length - 1].balAfter;
    weeks.push({
      index,
      startISO: addDays(startISO, index * DAYS_PER_WEEK),
      endISO: addDays(startISO, Math.min(index * DAYS_PER_WEEK + 6, days - 1)),
      events: inWeek,
      net: inWeek.reduce((sum, e) => sum + e.sign * e.amount, 0),
      endBalance: carry,
      anyNegative: inWeek.some((e) => e.balAfter < 0),
    });
  }
  return weeks;
}

export type ForecastSummary = {
  endBalance: number;
  lowest: number;
  lowestDateISO: string | null;
  plannedCC: number;
  danger: boolean;
};

/** KPI-strip figures, derived from the same event list the chart and ledger use. */
export function summarize(
  events: ForecastEvent[],
  startBal: number,
  series: number[],
): ForecastSummary {
  // The starting balance is a candidate low: an all-outflow window never rises above it,
  // and an empty forecast has no events to min over at all.
  let lowest = startBal;
  let lowestDateISO: string | null = null;
  for (const ev of events) {
    if (ev.balAfter < lowest) {
      lowest = ev.balAfter;
      lowestDateISO = ev.dateISO;
    }
  }
  const plannedCC = events
    .filter((e) => !e.editable)
    .reduce((sum, e) => sum + e.amount, 0);

  return {
    endBalance: series.length > 0 ? series[series.length - 1] : startBal,
    lowest,
    lowestDateISO,
    plannedCC,
    danger: lowest < 0,
  };
}

// Stable id for a user-added ledger row. Date.now + a counter is enough here — ids only
// need to be unique within one browser's stored plan.
let uidCounter = 0;
export function newItemId(): string {
  uidCounter += 1;
  return `user:${Date.now().toString(36)}:${uidCounter.toString(36)}`;
}
