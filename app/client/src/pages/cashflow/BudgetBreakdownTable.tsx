import { useMemo, useState } from 'react';
import { Wallet } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@databricks/appkit-ui/react';
import { formatCurrency, formatMonthLong } from '../../lib/format';
import { SortableTableHead } from './SortableTableHead';
import type { BudgetVsActualRow } from './types';

type BudgetSortKey = 'category' | 'group' | 'budgeted' | 'actual' | 'ytd' | 'variance' | 'pctUsed';

type BudgetRow = {
  category: string;
  group: string;
  budgeted: number;
  actual: number;
  ytd: number;
  variance: number;
  pctUsed: number | null;
};

function pctBar(pct: number | null) {
  if (pct === null) return <span className="text-muted-foreground">—</span>;
  const barClass = pct > 100 ? 'bg-destructive' : pct >= 90 ? 'bg-warning' : 'bg-success';
  const textClass = pct > 100 ? 'text-destructive' : pct >= 90 ? 'text-warning' : 'text-success';
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <div className={`h-full ${barClass}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`font-mono text-xs tabular-nums ${textClass} w-10 shrink-0 text-right`}>{pct.toFixed(0)}%</span>
    </div>
  );
}

export function BudgetBreakdownTable({
  data,
  loading,
  error,
  activeMonth,
  excludedCategories,
}: {
  data: BudgetVsActualRow[] | null;
  loading: boolean;
  error: string | null;
  activeMonth: string;
  excludedCategories: Set<string>;
}) {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<BudgetSortKey>('actual');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function toggleSort(key: BudgetSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const rows = useMemo<BudgetRow[]>(() => {
    const raw = data ?? [];
    const built = raw
      .filter((r) => String(r.hide_from_reports) !== 'true')
      .filter((r) => Number(r.actual_amount) !== 0)
      .filter((r) => !excludedCategories.has(r.category))
      .filter((r) => r.category.toLowerCase().includes(filter.trim().toLowerCase()))
      .map(
        (r): BudgetRow => ({
          category: r.category,
          group: r.group,
          budgeted: Number(r.budgeted_amount),
          actual: Number(r.actual_amount),
          ytd: Number(r.ytd_actual_amount),
          variance: Number(r.variance),
          pctUsed: r.pct_used === null || r.pct_used === undefined ? null : Number(r.pct_used),
        }),
      );

    return [...built].sort((a, b) => {
      let cmp: number;
      if (sortKey === 'category' || sortKey === 'group') cmp = a[sortKey].localeCompare(b[sortKey]);
      else if (sortKey === 'pctUsed') cmp = (a.pctUsed ?? -1) - (b.pctUsed ?? -1);
      else cmp = a[sortKey] - b[sortKey];
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, excludedCategories, filter, sortKey, sortDir]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget vs. Actual — {formatMonthLong(activeMonth)}</CardTitle>
        <CardDescription>Category spend against budget</CardDescription>
      </CardHeader>
      <CardContent>
        <Input
          placeholder="Filter by category..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mb-3 max-w-xs"
        />

        {loading && <Skeleton className="h-64 w-full" />}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not load budget breakdown</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && rows.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Wallet />
              </EmptyMedia>
              <EmptyTitle>No outflows found</EmptyTitle>
              <EmptyDescription>
                {filter
                  ? `No categories match "${filter}".`
                  : `No category spending recorded for ${formatMonthLong(activeMonth)} yet.`}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <div className="max-h-[420px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead label="Category" sortKey="category" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                    <SortableTableHead label="Group" sortKey="group" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                    <SortableTableHead label="Budget" sortKey="budgeted" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
                    <SortableTableHead label="Actual" sortKey="actual" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
                    <SortableTableHead label="YTD" sortKey="ytd" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
                    <SortableTableHead label="Variance" sortKey="variance" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
                    <SortableTableHead label="% Used" sortKey="pctUsed" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const over = r.variance < 0;
                    const varianceColor = r.variance === 0 ? 'text-muted-foreground' : over ? 'text-destructive' : 'text-success';
                    const varianceText =
                      r.variance === 0 ? 'on budget' : `${over ? '+' : '−'}${formatCurrency(Math.abs(r.variance))}`;
                    return (
                      <TableRow key={r.category}>
                        <TableCell>{r.category}</TableCell>
                        <TableCell className="text-muted-foreground">{r.group}</TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">{formatCurrency(r.budgeted)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(r.actual)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(r.ytd)}</TableCell>
                        <TableCell className={`text-right tabular-nums ${varianceColor}`}>{varianceText}</TableCell>
                        <TableCell className="min-w-[110px]">{pctBar(r.pctUsed)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">{rows.length} categories</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
