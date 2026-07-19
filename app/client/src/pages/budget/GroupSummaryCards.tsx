import { Card, CardContent } from '@databricks/appkit-ui/react';
import { formatCurrency } from '../../lib/format';
import {
  groupColor,
  pctStatus,
  STATUS_BG_CLASS,
  STATUS_TEXT_CLASS,
  type BudgetGroupSummary,
} from './aggregate';

function GroupCard({ g }: { g: BudgetGroupSummary }) {
  const status = pctStatus(g.pct);
  const over = g.variance < 0;
  const barWidth = g.pct === null ? 0 : Math.min(g.pct, 100);

  return (
    <Card className={`flex-[1_1_200px] ${g.hasSpend ? '' : 'opacity-50'}`}>
      <CardContent className="flex flex-col gap-2.5 py-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: groupColor(g.group) }} />
          <span className="text-sm font-medium">{g.group}</span>
        </div>

        <div className="font-mono text-lg font-semibold tabular-nums">
          {formatCurrency(g.actual)}
          <span className="text-muted-foreground text-xs font-normal"> / {formatCurrency(g.budget)}</span>
        </div>

        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div className={`h-full ${STATUS_BG_CLASS[status]}`} style={{ width: `${barWidth}%` }} />
        </div>

        {g.hasSpend ? (
          <div className="flex justify-between text-xs">
            <span className={`font-mono tabular-nums ${STATUS_TEXT_CLASS[status]}`}>
              {g.pct === null ? '—' : `${Math.round(g.pct)}% used`}
            </span>
            <span className={`font-mono tabular-nums ${over ? 'text-destructive' : 'text-success'}`}>
              {`${over ? '+' : '−'}${formatCurrency(Math.abs(g.variance))}`}
            </span>
          </div>
        ) : (
          <div className="text-muted-foreground text-xs">No spend this month</div>
        )}
      </CardContent>
    </Card>
  );
}

export function GroupSummaryCards({ groups }: { groups: BudgetGroupSummary[] }) {
  return (
    <div className="flex flex-wrap gap-4">
      {groups.map((g) => (
        <GroupCard key={g.group} g={g} />
      ))}
    </div>
  );
}
