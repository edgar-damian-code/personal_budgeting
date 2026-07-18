import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDown, ArrowUp, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
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
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@databricks/appkit-ui/react';
import {
  formatCurrency,
  formatSignedCurrency,
  formatMonthLong,
  formatMonthShort,
  formatMonthOnly,
  currentMonthStart,
} from '../../lib/format';

// @databricks/appkit-ui's DataTable component (all versions tested, 0.38.1 through
// 0.45.0) hangs the entire page on ANY interactive state change — sorting, column
// visibility, even pagination — reproduced deterministically outside our own code.
// Replaced with a hand-rolled table over plain Table/*, which has no internal state
// machinery of its own, plus a raw `useAnalyticsQuery` call. Its result rows arrive
// with every column — including BOOLEAN/DECIMAL/BIGINT — as a JSON string, not a
// native boolean/number, so coerce explicitly rather than relying on truthiness
// (`!"false"` is `false` in JS, which would silently drop every row).
type BudgetVsActualRow = {
  budget_month: string;
  category: string;
  group: string;
  type: string;
  hide_from_reports: boolean | string;
  budgeted_amount: number | string;
  actual_amount: number | string;
  transaction_count: number | string;
  variance: number | string;
  pct_used: number | string | null;
};

type BreakdownSortKey = 'category' | 'group' | 'actual';

type CashflowRow = {
  month: string;
  income: number;
  outflows: number;
  cc_payments: number;
  fixed_outflows: number;
  variable_outflows: number;
  net_cashflow: number;
  income_count: number;
  outflow_count: number;
};

type KpiCardDef = {
  key: string;
  label: string;
  getValue: (row: CashflowRow) => number;
  goodDirection: 'up' | 'down';
  tone: 'success' | 'neutral' | 'auto';
  signed?: boolean;
};

const KPI_CARDS: KpiCardDef[] = [
  { key: 'income', label: 'Income', getValue: (r) => r.income, goodDirection: 'up', tone: 'success' },
  { key: 'fixed', label: 'Fixed Outflows', getValue: (r) => Math.abs(r.fixed_outflows), goodDirection: 'down', tone: 'neutral' },
  { key: 'cc', label: 'CC Payments', getValue: (r) => Math.abs(r.cc_payments), goodDirection: 'down', tone: 'neutral' },
  { key: 'variable', label: 'Variable Outflows', getValue: (r) => Math.abs(r.variable_outflows), goodDirection: 'down', tone: 'neutral' },
  { key: 'net', label: 'Net Cash Flow', getValue: (r) => r.net_cashflow, goodDirection: 'up', tone: 'auto', signed: true },
];

export function CashFlowPage() {
  const cashflowParams = useMemo(() => ({}), []);
  const { data, loading, error } = useAnalyticsQuery('monthly_cashflow', cashflowParams);

  const sortedRows = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => a.month.localeCompare(b.month));
  }, [data]);

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
    const groups = new Map<string, CashflowRow[]>();
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
  const { data: budgetData, loading: budgetLoading, error: budgetError } = useAnalyticsQuery(
    'budget_vs_actual',
    budgetParams,
  );

  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortKey, setSortKey] = useState<BreakdownSortKey>('actual');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function toggleSort(key: BreakdownSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const breakdownRows = useMemo(() => {
    const rows = (budgetData ?? []) as BudgetVsActualRow[];
    const filtered = rows
      .filter((r) => String(r.hide_from_reports) !== 'true' && Number(r.actual_amount) !== 0)
      .filter((r) => r.category.toLowerCase().includes(categoryFilter.trim().toLowerCase()));
    return [...filtered].sort((a, b) => {
      let cmp: number;
      if (sortKey === 'category') cmp = a.category.localeCompare(b.category);
      else if (sortKey === 'group') cmp = a.group.localeCompare(b.group);
      else cmp = Number(a.actual_amount) - Number(b.actual_amount);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [budgetData, categoryFilter, sortKey, sortDir]);

  function sortIcon(key: BreakdownSortKey) {
    if (sortKey !== key) return null;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Cash Flow</h2>
          {latestRow && (
            <p className="text-sm text-muted-foreground">
              Updated daily from Tiller · latest data: {formatMonthLong(latestRow.month)}
            </p>
          )}
        </div>
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

      {loading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {KPI_CARDS.map((card) => (
            <Skeleton key={card.key} className="h-24 w-full" />
          ))}
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
            <EmptyTitle>No cash flow data yet</EmptyTitle>
            <EmptyDescription>
              gold.monthly_cashflow has no rows. Check that the daily ELT job has run.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {!loading && !error && activeRow && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {KPI_CARDS.map((card) => {
              const value = card.getValue(activeRow);
              const previousValue = previousRow ? card.getValue(previousRow) : undefined;
              const diff = previousValue !== undefined ? value - previousValue : undefined;
              const isGood = diff === undefined ? undefined : card.goodDirection === 'up' ? diff >= 0 : diff <= 0;
              const valueColorClass =
                card.tone === 'success'
                  ? 'text-success'
                  : card.tone === 'auto'
                    ? value >= 0
                      ? 'text-success'
                      : 'text-destructive'
                    : 'text-foreground';

              return (
                <Card key={card.key}>
                  <CardHeader className="pb-2">
                    <CardDescription>{card.label}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-xl font-semibold ${valueColorClass}`}>
                      {card.signed ? formatSignedCurrency(value) : formatCurrency(value)}
                    </div>
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
                    <Bar dataKey="outflows" name="Total Outflows" fill="var(--foreground)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Outflow Breakdown — {formatMonthLong(activeRow.month)}</CardTitle>
              <CardDescription>Category-level actuals for the selected month</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Filter by category..."
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="mb-3 max-w-xs"
              />

              {budgetLoading && <Skeleton className="h-64 w-full" />}

              {budgetError && (
                <Alert variant="destructive">
                  <AlertTitle>Could not load breakdown</AlertTitle>
                  <AlertDescription>{budgetError}</AlertDescription>
                </Alert>
              )}

              {!budgetLoading && !budgetError && breakdownRows.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Wallet />
                    </EmptyMedia>
                    <EmptyTitle>No outflows found</EmptyTitle>
                    <EmptyDescription>
                      {categoryFilter
                        ? `No categories match "${categoryFilter}".`
                        : `No category spending recorded for ${formatMonthLong(activeRow.month)} yet.`}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}

              {!budgetLoading && !budgetError && breakdownRows.length > 0 && (
                <>
                  <div className="max-h-[420px] overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            <button
                              type="button"
                              onClick={() => toggleSort('category')}
                              className="flex items-center gap-1 font-medium"
                            >
                              Category {sortIcon('category')}
                            </button>
                          </TableHead>
                          <TableHead>
                            <button
                              type="button"
                              onClick={() => toggleSort('group')}
                              className="flex items-center gap-1 font-medium"
                            >
                              Group {sortIcon('group')}
                            </button>
                          </TableHead>
                          <TableHead className="text-right">
                            <button
                              type="button"
                              onClick={() => toggleSort('actual')}
                              className="ml-auto flex items-center gap-1 font-medium"
                            >
                              Actual {sortIcon('actual')}
                            </button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {breakdownRows.map((r) => (
                          <TableRow key={r.category}>
                            <TableCell>{r.category}</TableCell>
                            <TableCell className="text-muted-foreground">{r.group}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(Number(r.actual_amount))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{breakdownRows.length} categories</p>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
