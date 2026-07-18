import { useMemo, useState } from 'react';
import { Wallet } from 'lucide-react';
import {
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
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@databricks/appkit-ui/react';
import { formatCurrency, formatMonthLong } from '../../lib/format';
import { SortableTableHead } from './SortableTableHead';
import type { CategoryMonth } from './types';

type MomSortKey = 'category' | 'group' | 'lastMo' | 'thisMo' | 'delta' | 'ytd';

type MomRow = {
  category: string;
  group: string;
  lastMo: number;
  thisMo: number;
  delta: number;
  ytd: number;
};

export function MomBreakdownTable({
  categoryMonthly,
  activeMonth,
  previousMonth,
}: {
  categoryMonthly: CategoryMonth[];
  activeMonth: string;
  previousMonth: string | null;
}) {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<MomSortKey>('thisMo');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function toggleSort(key: MomSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const rows = useMemo<MomRow[]>(() => {
    const year = activeMonth.slice(0, 4);
    const thisMonth = categoryMonthly.filter((r) => r.month === activeMonth && Math.abs(r.outflows) > 0.004);

    const built = thisMonth.map((r): MomRow => {
      const last = previousMonth
        ? categoryMonthly.find((x) => x.category === r.category && x.month === previousMonth)
        : undefined;
      const lastMo = last ? Math.abs(last.outflows) : 0;
      const thisMo = Math.abs(r.outflows);
      const ytd = categoryMonthly
        .filter((x) => x.category === r.category && x.month.slice(0, 4) === year && x.month <= activeMonth)
        .reduce((sum, x) => sum + Math.abs(x.outflows), 0);
      return { category: r.category, group: r.group, lastMo, thisMo, delta: thisMo - lastMo, ytd };
    });

    const filtered = built.filter((r) => r.category.toLowerCase().includes(filter.trim().toLowerCase()));
    return [...filtered].sort((a, b) => {
      const cmp = sortKey === 'category' || sortKey === 'group' ? a[sortKey].localeCompare(b[sortKey]) : a[sortKey] - b[sortKey];
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [categoryMonthly, activeMonth, previousMonth, filter, sortKey, sortDir]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outflow Breakdown — {formatMonthLong(activeMonth)}</CardTitle>
        <CardDescription>Category actuals vs. last month</CardDescription>
      </CardHeader>
      <CardContent>
        <Input
          placeholder="Filter by category..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mb-3 max-w-xs"
        />

        {rows.length === 0 && (
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

        {rows.length > 0 && (
          <>
            <div className="max-h-[420px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead label="Category" sortKey="category" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                    <SortableTableHead label="Group" sortKey="group" activeKey={sortKey} direction={sortDir} onSort={toggleSort} />
                    <SortableTableHead label="Last Mo" sortKey="lastMo" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
                    <SortableTableHead label="This Mo" sortKey="thisMo" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
                    <SortableTableHead label="Δ MoM" sortKey="delta" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
                    <SortableTableHead label="YTD" sortKey="ytd" activeKey={sortKey} direction={sortDir} onSort={toggleSort} align="right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const deltaColor = r.delta === 0 ? 'text-muted-foreground' : r.delta > 0 ? 'text-destructive' : 'text-success';
                    const deltaText = r.delta === 0 ? '—' : `${r.delta > 0 ? '+' : '−'}${formatCurrency(Math.abs(r.delta))}`;
                    return (
                      <TableRow key={r.category}>
                        <TableCell>{r.category}</TableCell>
                        <TableCell className="text-muted-foreground">{r.group}</TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">{formatCurrency(r.lastMo)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(r.thisMo)}</TableCell>
                        <TableCell className={`text-right tabular-nums ${deltaColor}`}>{deltaText}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(r.ytd)}</TableCell>
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
