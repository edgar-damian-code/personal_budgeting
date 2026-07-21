import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@databricks/appkit-ui/react';
import { groupColor } from '../../lib/groupColors';
import type { Breakdown, SpendMonthlyRow } from './types';

const TOP_N = 6;
const OTHER = 'Other';
const OTHER_COLOR = '#3a4048';
// Rotating categorical palette for category mode (group mode uses the group palette).
const CAT_PALETTE = ['#34d399', '#6aa6e8', '#e8b54a', '#f4796b', '#b08cf0', '#4ecb8f', '#d9b06a'];

const PLOT_H = 280; // px — height of the tallest month bar
const monthAbbr = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

function fmtK(n: number): string {
  if (n <= 0) return '$0';
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

type Built = {
  months: string[];
  series: string[]; // bottom → top; Other last
  colorOf: (series: string, i: number) => string;
  valueAt: (month: string, series: string) => number;
  totalAt: (month: string) => number;
  maxTotal: number;
};

function buildStacks(rows: SpendMonthlyRow[], breakdown: Breakdown): Built {
  const keyOf = (r: SpendMonthlyRow) => (breakdown === 'group' ? r.group : r.category);

  const seriesTotals = new Map<string, number>();
  const months = new Set<string>();
  for (const r of rows) {
    months.add(r.month);
    seriesTotals.set(keyOf(r), (seriesTotals.get(keyOf(r)) ?? 0) + Number(r.spend));
  }
  const ranked = [...seriesTotals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const topKeys = ranked.slice(0, TOP_N);
  const hasOther = ranked.length > TOP_N;
  const series = [...topKeys, ...(hasOther ? [OTHER] : [])];

  // month → series → summed spend
  const cells = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  for (const r of rows) {
    const seriesKey = topKeys.includes(keyOf(r)) ? keyOf(r) : OTHER;
    const row = cells.get(r.month) ?? new Map<string, number>();
    row.set(seriesKey, (row.get(seriesKey) ?? 0) + Number(r.spend));
    cells.set(r.month, row);
    totals.set(r.month, (totals.get(r.month) ?? 0) + Number(r.spend));
  }

  const monthList = [...months].sort((a, b) => a.localeCompare(b));
  const maxTotal = Math.max(0, ...[...totals.values()]);

  return {
    months: monthList,
    series,
    colorOf: (s, i) => (s === OTHER ? OTHER_COLOR : breakdown === 'group' ? groupColor(s) : CAT_PALETTE[i % CAT_PALETTE.length]),
    valueAt: (m, s) => cells.get(m)?.get(s) ?? 0,
    totalAt: (m) => totals.get(m) ?? 0,
    maxTotal,
  };
}

export function MonthlySpendChart({
  rows,
  breakdown,
  onBreakdownChange,
}: {
  rows: SpendMonthlyRow[];
  breakdown: Breakdown;
  onBreakdownChange: (b: Breakdown) => void;
}) {
  const b = buildStacks(rows, breakdown);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Monthly Spend</CardTitle>
            <CardDescription>Last 12 months · stacked by {breakdown}</CardDescription>
          </div>
          <Select value={breakdown} onValueChange={(v) => onBreakdownChange(v as Breakdown)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="category">By category</SelectItem>
              <SelectItem value="group">By group</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {b.months.length === 0 || b.maxTotal === 0 ? (
          <p className="text-muted-foreground text-sm">No spend in the last 12 months.</p>
        ) : (
          <>
            <div className="flex items-end gap-1.5 sm:gap-2.5" style={{ height: PLOT_H + 20 }}>
              {b.months.map((m) => {
                const total = b.totalAt(m);
                const barH = b.maxTotal > 0 ? (total / b.maxTotal) * PLOT_H : 0;
                return (
                  <div key={m} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-muted-foreground font-mono text-[10px] tabular-nums">{fmtK(total)}</span>
                    <div
                      className="flex w-full max-w-[46px] flex-col-reverse overflow-hidden rounded-t-sm"
                      style={{ height: barH }}
                    >
                      {b.series.map((s, i) => {
                        const v = b.valueAt(m, s);
                        if (v <= 0) return null;
                        return (
                          <div
                            key={s}
                            title={`${s}: ${fmtK(v)}`}
                            style={{ height: `${(v / total) * 100}%`, background: b.colorOf(s, i) }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-1.5 sm:gap-2.5">
              {b.months.map((m) => (
                <span key={m} className="text-muted-foreground flex-1 text-center text-[10px]">
                  {monthAbbr.format(new Date(m))}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
              {b.series.map((s, i) => (
                <span key={s} className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.colorOf(s, i) }} />
                  {s}
                </span>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
