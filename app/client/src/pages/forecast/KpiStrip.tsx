import { Card, CardContent } from '@databricks/appkit-ui/react';
import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import { formatDayLabel, formatDayLong } from './dates';
import { MoneyInput } from './MoneyInput';
import type { ForecastSummary } from './forecast';

function Tile({
  label,
  children,
  tone,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  tone?: 'danger';
}) {
  return (
    <Card
      className="flex-[1_1_190px] border"
      style={
        tone === 'danger'
          ? {
              background: 'color-mix(in srgb, var(--destructive) 8%, var(--card))',
              borderColor: 'color-mix(in srgb, var(--destructive) 35%, transparent)',
            }
          : undefined
      }
    >
      <CardContent className="px-5 py-4">
        <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{label}</div>
        {children}
      </CardContent>
    </Card>
  );
}

export function KpiStrip({
  summary,
  startBal,
  onStartBalChange,
  balanceAsOf,
  endISO,
}: {
  summary: ForecastSummary;
  startBal: number;
  onStartBalChange: (next: number) => void;
  balanceAsOf: string | null;
  endISO: string;
}) {
  const endTone = summary.endBalance < 0 ? 'var(--destructive)' : 'var(--foreground)';
  const lowTone = summary.danger ? 'var(--destructive)' : 'var(--foreground)';

  return (
    <div className="flex flex-wrap gap-3">
      <Card className="flex-[1_1_260px] border">
        <CardContent className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Balance today
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              Ally Spending ··1871
              {balanceAsOf ? ` · as of ${formatDayLabel(balanceAsOf)}` : ''}
            </div>
          </div>
          <MoneyInput
            value={startBal}
            onChange={onStartBalChange}
            ariaLabel="Starting checking balance"
            className="w-[140px] shrink-0"
          />
        </CardContent>
      </Card>

      <Tile label={`Projected · ${formatDayLabel(endISO)}`}>
        <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums" style={{ color: endTone }}>
          {formatCurrency(summary.endBalance)}
        </div>
      </Tile>

      <Tile
        tone={summary.danger ? 'danger' : undefined}
        label={
          <span className="inline-flex items-center gap-1.5">
            Lowest point
            {summary.danger && <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--destructive)' }} />}
          </span>
        }
      >
        <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums" style={{ color: lowTone }}>
          {formatCurrency(summary.lowest)}
        </div>
        <div className="text-muted-foreground mt-0.5 text-xs">
          {summary.lowestDateISO ? formatDayLong(summary.lowestDateISO) : 'today'}
        </div>
      </Tile>

      <Tile label="Planned CC payments">
        <div
          className="mt-1.5 font-mono text-2xl font-semibold tabular-nums"
          style={{ color: 'var(--warning)' }}
        >
          {formatCurrency(summary.plannedCC)}
        </div>
      </Tile>
    </div>
  );
}
