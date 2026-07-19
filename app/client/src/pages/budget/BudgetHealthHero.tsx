import { AlertTriangle, CalendarRange, PiggyBank, Target } from 'lucide-react';
import { Card, CardContent } from '@databricks/appkit-ui/react';
import { formatCurrency } from '../../lib/format';
import {
  groupColor,
  pctStatus,
  STATUS_TEXT_CLASS,
  STATUS_VAR,
  type BudgetSummary,
} from './aggregate';

const shortMonthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

// "Jan–Jul '26" style range for the YTD callout, derived from the selected month.
function ytdRangeLabel(month: string): string {
  const d = new Date(month);
  const end = shortMonthFormatter.format(d);
  const yy = String(d.getUTCFullYear()).slice(2);
  return `Jan–${end} ’${yy}`;
}

function Donut({ summary }: { summary: BudgetSummary }) {
  const status = pctStatus(summary.pct);
  const centerColor = STATUS_VAR[status];
  const cx = 96;
  const cy = 96;
  const r = 78;
  const circ = 2 * Math.PI * r;

  const spendGroups = summary.groups.filter((g) => g.actual > 0);
  const totalActual = spendGroups.reduce((sum, g) => sum + g.actual, 0);

  // Each segment's fraction, plus the cumulative fraction preceding it (its rotation
  // offset) — computed without post-render mutation to satisfy the immutability lint.
  const fractions = spendGroups.map((g) => (totalActual > 0 ? g.actual / totalActual : 0));
  const segments = spendGroups.map((g, i) => {
    const before = fractions.slice(0, i).reduce((sum, f) => sum + f, 0);
    return (
      <circle
        key={g.group}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={groupColor(g.group)}
        strokeWidth={20}
        strokeDasharray={`${fractions[i] * circ} ${circ}`}
        strokeDashoffset={-before * circ}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    );
  });

  const centerLabel = summary.pct === null ? '—' : `${Math.round(summary.pct)}%`;

  return (
    <svg width={168} height={168} viewBox="0 0 192 192" className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--muted)" strokeWidth={20} />
      {segments}
      <text x={cx} y={cy - 2} textAnchor="middle" fill={centerColor} className="font-mono" fontSize={34} fontWeight={600}>
        {centerLabel}
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle" fill="var(--muted-foreground)" fontSize={13}>
        of budget
      </text>
    </svg>
  );
}

function Callout({
  icon,
  label,
  value,
  sub,
  valueClass = 'text-foreground',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    // py-4 overrides the Card's default py-6 so the callout matches the spec's 16px padding.
    <Card className="flex-1 justify-center py-4">
      <CardContent className="flex flex-col gap-1.5">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          {icon}
          <span>{label}</span>
        </div>
        <span className={`font-mono text-xl font-semibold tabular-nums ${valueClass}`}>{value}</span>
        <span className="text-muted-foreground truncate text-xs">{sub}</span>
      </CardContent>
    </Card>
  );
}

export function BudgetHealthHero({ summary, month }: { summary: BudgetSummary; month: string }) {
  const overStatus = summary.variance >= 0 ? 'success' : 'destructive';
  const overColor = summary.variance >= 0 ? 'text-success' : 'text-destructive';
  const overWord = summary.variance >= 0 ? 'under' : 'over';

  return (
    <div className="flex flex-wrap items-stretch gap-4">
      <Card
        className={`flex-[1_1_380px] justify-center border ${
          overStatus === 'success' ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
        }`}
      >
        <CardContent className="flex items-center gap-6">
          <Donut summary={summary} />
          <div>
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Budget Health</div>
            <div className="mt-1.5 font-mono text-3xl font-semibold tabular-nums">{formatCurrency(summary.totalActual)}</div>
            <div className="text-muted-foreground mt-0.5 text-sm">of {formatCurrency(summary.totalBudget)} budgeted</div>
            <div className={`mt-2.5 font-mono text-sm font-semibold tabular-nums ${overColor}`}>
              {`${summary.variance >= 0 ? '−' : '+'}${formatCurrency(Math.abs(summary.variance))} ${overWord}`}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-[1_1_380px] flex-col gap-4">
        <div className="flex flex-1 gap-4">
          <Callout
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            label="Biggest overage"
            value={
              summary.biggestOverage
                ? `+${formatCurrency(Math.abs(summary.biggestOverage.variance))}`
                : '—'
            }
            sub={summary.biggestOverage?.category ?? 'Nothing over budget'}
            valueClass="text-destructive"
          />
          <Callout
            icon={<PiggyBank className="h-3.5 w-3.5" />}
            label="Biggest saving"
            value={
              summary.biggestSaving ? `−${formatCurrency(Math.abs(summary.biggestSaving.variance))}` : '—'
            }
            sub={summary.biggestSaving?.category ?? 'Nothing under budget'}
            valueClass="text-success"
          />
        </div>
        <div className="flex flex-1 gap-4">
          <Callout
            icon={<Target className="h-3.5 w-3.5" />}
            label="Over budget"
            value={`${summary.overCount} of ${summary.categoryCount}`}
            sub="categories this month"
            valueClass={STATUS_TEXT_CLASS[summary.overCount > 0 ? 'warning' : 'success']}
          />
          <Callout
            icon={<CalendarRange className="h-3.5 w-3.5" />}
            label="YTD actual"
            value={formatCurrency(summary.totalYtd)}
            sub={ytdRangeLabel(month)}
          />
        </div>
      </div>
    </div>
  );
}
