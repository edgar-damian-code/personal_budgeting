import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Alert,
  AlertTitle,
  AlertDescription,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@databricks/appkit-ui/react';
import { formatCurrency, formatMonthLong, formatMonthShort, formatMonthOnly, currentMonthStart } from '../../lib/format';
import { GroupsSlicer } from './GroupsSlicer';
import { HeroBanner } from './HeroBanner';
import { MomBreakdownTable } from './MomBreakdownTable';
import type { BudgetVsActualRow, CashflowMonth, CategoryMonth, MonthlyCashflowRow } from './types';

type KpiCardDef = {
  key: string;
  label: string;
  getValue: (row: CashflowMonth) => number;
  goodDirection: 'up' | 'down';
  tone: 'success' | 'neutral';
};

const KPI_CARDS: KpiCardDef[] = [
  { key: 'income', label: 'Income', getValue: (r) => r.income, goodDirection: 'up', tone: 'success' },
  { key: 'fixed', label: 'Fixed Outflows', getValue: (r) => Math.abs(r.fixed_outflows), goodDirection: 'down', tone: 'neutral' },
  { key: 'cc', label: 'CC Payments', getValue: (r) => Math.abs(r.cc_payments), goodDirection: 'down', tone: 'neutral' },
  { key: 'variable', label: 'Variable Outflows', getValue: (r) => Math.abs(r.variable_outflows), goodDirection: 'down', tone: 'neutral' },
];

export function CashFlowPage() {
  const cashflowParams = useMemo(() => ({}), []);
  const { data, loading, error } = useAnalyticsQuery('monthly_cashflow', cashflowParams);
  const rawRows = useMemo(() => (data ?? []) as MonthlyCashflowRow[], [data]);

  const [excludedGroups, setExcludedGroups] = useState<Set<string>>(new Set());
  function toggleGroup(group: string) {
    setExcludedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  const filteredRawRows = useMemo(
    () => rawRows.filter((r) => !excludedGroups.has(r.group)),
    [rawRows, excludedGroups],
  );

  // Re-aggregate month+group+category rows to month level for the cards/chart/hero banner.
  const sortedRows = useMemo<CashflowMonth[]>(() => {
    const byMonth = new Map<string, CashflowMonth>();
    for (const r of filteredRawRows) {
      const existing = byMonth.get(r.month) ?? {
        month: r.month,
        income: 0,
        outflows: 0,
        cc_payments: 0,
        fixed_outflows: 0,
        variable_outflows: 0,
        net_cashflow: 0,
        income_count: 0,
        outflow_count: 0,
      };
      existing.income += Number(r.income);
      existing.outflows += Number(r.outflows);
      existing.cc_payments += Number(r.cc_payments);
      existing.fixed_outflows += Number(r.fixed_outflows);
      existing.variable_outflows += Number(r.variable_outflows);
      existing.net_cashflow += Number(r.net_cashflow);
      existing.income_count += Number(r.income_count);
      existing.outflow_count += Number(r.outflow_count);
      byMonth.set(r.month, existing);
    }
    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredRawRows]);

  // Re-aggregate to month+category for the MoM breakdown table. Expense-type only — the
  // table is specifically an *outflow* breakdown, so Income and Transfer categories
  // (e.g. "Credit Card" payments, which are internal moves, not spend) don't belong here.
  const categoryMonthly = useMemo<CategoryMonth[]>(() => {
    const byKey = new Map<string, CategoryMonth>();
    for (const r of filteredRawRows) {
      if (r.type !== 'Expense') continue;
      const key = `${r.category}|${r.month}`;
      const existing = byKey.get(key) ?? { category: r.category, group: r.group, month: r.month, outflows: 0 };
      existing.outflows += Number(r.outflows);
      byKey.set(key, existing);
    }
    return [...byKey.values()];
  }, [filteredRawRows]);

  const defaultMonth = useMemo(() => {
    if (!sortedRows.length) return null;
    const todayMonth = currentMonthStart();
    const hasCurrentMonth = sortedRows.some((r) => r.month === todayMonth);
    return hasCurrentMonth ? todayMonth : sortedRows[sortedRows.length - 1].month;
  }, [sortedRows]);

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const activeMonth = selectedMonth ?? defaultMonth;

  const activeIndex = activeMonth ? sortedRows.findIndex((r) => r.month === activeMonth) : -1;
  const activeRow = activeIndex >= 0 ? sortedRows[activeIndex] : null;
  const previousRow = activeIndex > 0 ? sortedRows[activeIndex - 1] : null;
  const latestRow = sortedRows[sortedRows.length - 1] ?? null;

  const ytdOutflows = useMemo(() => {
    if (!activeMonth) return 0;
    const year = activeMonth.slice(0, 4);
    return sortedRows
      .filter((r) => r.month.slice(0, 4) === year && r.month <= activeMonth)
      .reduce((sum, r) => sum + Math.abs(r.outflows), 0);
  }, [sortedRows, activeMonth]);

  const trendData = useMemo(
    () =>
      sortedRows.slice(-12).map((r) => ({
        monthLabel: formatMonthShort(r.month),
        income: r.income,
        outflows: Math.abs(r.outflows),
      })),
    [sortedRows],
  );

  // Group months by year, most recent year and month first, so the selector reads
  // as a two-level year > month picker instead of one long flat list.
  const monthsByYear = useMemo(() => {
    const groups = new Map<string, CashflowMonth[]>();
    for (const row of sortedRows) {
      const year = row.month.slice(0, 4);
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year)!.push(row);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, rows]) => [year, [...rows].reverse()] as const);
  }, [sortedRows]);

  const budgetParams = useMemo(() => ({ budget_month: sql.date(activeMonth ?? '1970-01-01') }), [activeMonth]);
  const { data: budgetData } = useAnalyticsQuery('budget_vs_actual', budgetParams);

  // Union of both sources: monthly_cashflow is scoped to checking-account activity, so
  // groups with no direct checking transaction (e.g. Travel — paid by card, never
  // hitting checking directly) would otherwise never appear as a slicer option even
  // though they have real rows in the Budget vs Actual table (now its own tab).
  const availableGroups = useMemo(() => {
    const fromCashflow = rawRows.map((r) => r.group);
    const fromBudget = ((budgetData ?? []) as BudgetVsActualRow[]).map((r) => r.group);
    return [...new Set([...fromCashflow, ...fromBudget])].sort();
  }, [rawRows, budgetData]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Cash Flow</h2>
          {latestRow && (
            <p className="text-sm text-muted-foreground">
              Updated daily from Tiller · latest data: {formatMonthLong(latestRow.month)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-3">
          {availableGroups.length > 0 && (
            <GroupsSlicer groups={availableGroups} excluded={excludedGroups} onToggle={toggleGroup} />
          )}
          {sortedRows.length > 0 && (
            <Select value={activeMonth ?? undefined} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[220px]">
                {/* SelectItem content is month-only (year lives in the group header), so
                    give the trigger its own full "Month Year" text explicitly. */}
                <SelectValue placeholder="Select a month">
                  {activeMonth ? formatMonthLong(activeMonth) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {monthsByYear.map(([year, rows]) => (
                  <SelectGroup key={year}>
                    <SelectLabel>{year}</SelectLabel>
                    {rows.map((r) => (
                      <SelectItem key={r.month} value={r.month}>
                        {formatMonthOnly(r.month)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {loading && (
        <div className="space-y-6">
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {KPI_CARDS.map((card) => (
              <Skeleton key={card.key} className="h-24 w-full" />
            ))}
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load cash flow data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && sortedRows.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Wallet />
            </EmptyMedia>
            <EmptyTitle>No cash flow data{excludedGroups.size > 0 ? ' for this filter' : ' yet'}</EmptyTitle>
            <EmptyDescription>
              {excludedGroups.size > 0
                ? 'Every group is excluded, or the remaining groups have no activity. Adjust the Groups filter.'
                : 'gold.monthly_cashflow has no rows. Check that the daily ELT job has run.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {!loading && !error && activeRow && (
        <>
          <HeroBanner activeRow={activeRow} previousRow={previousRow} ytdOutflows={ytdOutflows} />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {KPI_CARDS.map((card) => {
              const value = card.getValue(activeRow);
              const previousValue = previousRow ? card.getValue(previousRow) : undefined;
              const diff = previousValue !== undefined ? value - previousValue : undefined;
              const isGood = diff === undefined ? undefined : card.goodDirection === 'up' ? diff >= 0 : diff <= 0;
              const valueColorClass = card.tone === 'success' ? 'text-success' : 'text-foreground';

              return (
                <Card key={card.key}>
                  <CardHeader className="pb-2">
                    <CardDescription>{card.label}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-xl font-semibold tabular-nums ${valueColorClass}`}>{formatCurrency(value)}</div>
                    {diff !== undefined && (
                      <div
                        className={`mt-1 flex items-center gap-1 text-xs ${isGood ? 'text-success' : 'text-destructive'}`}
                      >
                        {diff >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span>{formatCurrency(Math.abs(diff))} vs last month</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Income vs. Outflows</CardTitle>
              <CardDescription>Last {trendData.length} months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="monthLabel"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={72}
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickFormatter={(value: number) => formatCurrency(value)}
                    />
                    <Tooltip
                      formatter={(value?: number) => formatCurrency(value ?? 0)}
                      contentStyle={{
                        backgroundColor: 'var(--popover)',
                        color: 'var(--popover-foreground)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} />
                    <Bar dataKey="income" name="Income" fill="var(--success)" radius={[4, 4, 0, 0]} />
                    {/* Softer than --foreground (pure white in dark mode reads harsh next to income green) */}
                    <Bar dataKey="outflows" name="Total Outflows" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <MomBreakdownTable
            categoryMonthly={categoryMonthly}
            activeMonth={activeRow.month}
            previousMonth={previousRow?.month ?? null}
          />
        </>
      )}
    </div>
  );
}
