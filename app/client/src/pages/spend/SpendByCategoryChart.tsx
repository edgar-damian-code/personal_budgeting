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
import { formatCurrency } from '../../lib/format';
import { groupColor } from '../../lib/groupColors';
import { bucketBy } from './aggregate';
import type { Breakdown, SpendTransactionRow } from './types';

const MAX_BARS = 15;

export function SpendByCategoryChart({
  rows,
  breakdown,
  onBreakdownChange,
}: {
  rows: SpendTransactionRow[];
  breakdown: Breakdown;
  onBreakdownChange: (b: Breakdown) => void;
}) {
  const buckets = bucketBy(rows, (r) => (breakdown === 'group' ? r.group : r.category));
  const shown = buckets.slice(0, MAX_BARS);
  const max = shown[0]?.amount ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{breakdown === 'group' ? 'Spend by Group' : 'Spend by Category'}</CardTitle>
            <CardDescription>
              Filtered range · {rows.length} {rows.length === 1 ? 'transaction' : 'transactions'}
            </CardDescription>
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
        {shown.length === 0 ? (
          <p className="text-muted-foreground text-sm">No spend in the current filters.</p>
        ) : (
          <div className="space-y-2.5">
            {shown.map((b) => (
              <div key={b.key} className="grid grid-cols-[minmax(96px,1.1fr)_3fr_auto] items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: groupColor(b.group) }} />
                  <span className="truncate text-sm font-medium">{b.key}</span>
                </div>
                <div className="bg-muted h-2.5 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${max > 0 ? (b.amount / max) * 100 : 0}%`, background: groupColor(b.group) }}
                  />
                </div>
                <span className="w-16 text-right font-mono text-sm tabular-nums">{formatCurrency(b.amount)}</span>
              </div>
            ))}
            {buckets.length > MAX_BARS && (
              <p className="text-muted-foreground pt-1 text-xs">+{buckets.length - MAX_BARS} more not shown</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
