// localStorage persistence for the Forecast tab.
//
// This is the ONLY place user input lives — the app stays read-only against Delta, so
// planned card payments, ledger edits, and the starting-balance override never write back
// to Databricks. Anything unparseable is discarded rather than half-restored: a corrupt
// blob should reset to auto-detected defaults, not throw on render.

import { isValidISO } from './dates';
import type { ForecastPlan, LedgerItem, Plan, PlannedPayment } from './types';

export const STORAGE_KEY = 'hod.forecast.plan.v1';

export const EMPTY_PLAN: ForecastPlan = { startBal: null, plan: {}, items: null };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parsePayments(raw: unknown): PlannedPayment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((p) => ({ amt: Number(p.amt) || 0, date: String(p.date ?? '') }))
    .filter((p) => p.amt > 0 && isValidISO(p.date));
}

function parseItems(raw: unknown): LedgerItem[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .filter(isRecord)
    .map((it) => ({
      id: String(it.id ?? ''),
      dateISO: String(it.dateISO ?? ''),
      desc: String(it.desc ?? ''),
      group: String(it.group ?? 'Other'),
      type: it.type === 'in' ? ('in' as const) : ('out' as const),
      amount: Math.abs(Number(it.amount) || 0),
    }))
    .filter((it) => it.id !== '' && isValidISO(it.dateISO));
}

export function loadPlan(): ForecastPlan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PLAN;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return EMPTY_PLAN;

    const plan: Plan = {};
    if (isRecord(parsed.plan)) {
      for (const [cardNum, payments] of Object.entries(parsed.plan)) {
        const list = parsePayments(payments);
        if (list.length > 0) plan[cardNum] = list;
      }
    }

    const startBal = Number(parsed.startBal);
    return {
      // A stored 0 is a legitimate override, so test for finiteness rather than truthiness.
      startBal: Number.isFinite(startBal) ? startBal : null,
      plan,
      items: parseItems(parsed.items),
    };
  } catch {
    return EMPTY_PLAN;
  }
}

export function savePlan(plan: ForecastPlan): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // Quota or private-mode failures are non-fatal — the in-memory plan still works for
    // this session, it just won't survive a reload.
  }
}

export function clearPlan(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
