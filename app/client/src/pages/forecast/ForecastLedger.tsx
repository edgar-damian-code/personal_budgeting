import { useState } from 'react';
import { Button, Card, CardContent, Input } from '@databricks/appkit-ui/react';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import { formatDayLabel } from './dates';
import { MoneyInput } from './MoneyInput';
import type { ForecastEvent, LedgerItem, WeekBucket } from './types';

function signedCurrency(value: number): string {
  return `${value < 0 ? '−' : '+'}${formatCurrency(Math.abs(value))}`;
}

// Dots follow the Spend Analysis ledger's per-ACCOUNT convention rather than the group
// palette: money moving within checking is --card-checking (the same violet the Spend
// ledger uses for ··1871), and each card payment carries its own --card-* token, so a
// payment row reads as the card it pays across every tab.
//
// Inflows stay --success — direction is worth more than account identity on a row that is
// the only thing keeping the balance positive. (Their group is 'Income', which has no
// --group-* token and used to fall back to the same grey as "Other".)
function dotColor(event: ForecastEvent): string {
  if (event.color) return event.color; // planned card payment
  if (event.sign > 0) return 'var(--success)';
  return 'var(--card-checking)';
}

function EventRow({ event }: { event: ForecastEvent }) {
  const inflow = event.sign > 0;
  const amountColor = inflow ? 'var(--success)' : event.editable ? 'var(--foreground)' : 'var(--warning)';
  return (
    <div className="grid grid-cols-[64px_12px_1fr_auto_auto] items-center gap-3 border-b py-2 last:border-b-0">
      <span className="text-muted-foreground font-mono text-xs">{formatDayLabel(event.dateISO)}</span>
      <span className="h-2 w-2 rounded-sm" style={{ background: dotColor(event) }} aria-hidden />
      <span className="min-w-0 truncate text-sm">
        {event.desc}
        {!event.editable && <span className="text-muted-foreground ml-2 text-[11px]">· in planner</span>}
      </span>
      <span
        className="min-w-[88px] text-right font-mono text-sm tabular-nums"
        style={{ color: amountColor }}
      >
        {signedCurrency(event.sign * event.amount)}
      </span>
      <span
        className="min-w-[92px] text-right font-mono text-sm tabular-nums"
        style={{ color: event.balAfter < 0 ? 'var(--destructive)' : 'var(--muted-foreground)' }}
      >
        {formatCurrency(event.balAfter)}
      </span>
    </div>
  );
}

function EditRow({
  event,
  minDate,
  maxDate,
  onUpdate,
  onRemove,
}: {
  event: ForecastEvent;
  minDate: string;
  maxDate: string;
  onUpdate: (id: string, patch: Partial<LedgerItem>) => void;
  onRemove: (id: string) => void;
}) {
  const id = event.itemId as string;
  const inflow = event.type === 'in';
  return (
    <div className="flex flex-wrap items-center gap-2 border-b py-2 last:border-b-0">
      <Input
        type="date"
        value={event.dateISO}
        min={minDate}
        max={maxDate}
        aria-label="Transaction date"
        onChange={(e) => onUpdate(id, { dateISO: e.target.value })}
        className="h-9 w-[142px] shrink-0"
      />
      <Input
        value={event.desc}
        aria-label="Transaction description"
        onChange={(e) => onUpdate(id, { desc: e.target.value })}
        className="h-9 min-w-[140px] flex-1"
      />
      <Button
        variant="outline"
        className="h-9 w-[68px] shrink-0 font-mono text-xs"
        style={{ color: inflow ? 'var(--success)' : 'var(--muted-foreground)' }}
        aria-label={`Direction: ${inflow ? 'inflow' : 'outflow'}. Click to toggle.`}
        onClick={() => onUpdate(id, { type: inflow ? 'out' : 'in' })}
      >
        {inflow ? '+ in' : '− out'}
      </Button>
      <MoneyInput
        value={event.amount}
        onChange={(amount) => onUpdate(id, { amount })}
        ariaLabel="Transaction amount"
        className="w-[116px] shrink-0"
      />
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label="Remove transaction"
        onClick={() => onRemove(id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function WeekRow({
  week,
  editMode,
  minDate,
  maxDate,
  onUpdate,
  onRemove,
  onAdd,
}: {
  week: WeekBucket;
  editMode: boolean;
  minDate: string;
  maxDate: string;
  onUpdate: (id: string, patch: Partial<LedgerItem>) => void;
  onRemove: (id: string) => void;
  onAdd: (dateISO: string) => void;
}) {
  const hasEvents = week.events.length > 0;
  // Weeks with activity default open; empty weeks collapse. Edit mode forces every week
  // open so a row can be added to a week that currently has nothing in it.
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = editMode || (manualOpen ?? hasEvents);
  const toggleable = hasEvents && !editMode;

  return (
    <div
      className="rounded-lg border"
      style={
        week.anyNegative
          ? {
              background: 'color-mix(in srgb, var(--destructive) 7%, var(--card))',
              borderColor: 'color-mix(in srgb, var(--destructive) 32%, transparent)',
            }
          : undefined
      }
    >
      <div
        className={`grid grid-cols-[20px_1fr_auto_auto] items-center gap-3 px-4 py-3 ${
          toggleable ? 'cursor-pointer' : ''
        }`}
        onClick={toggleable ? () => setManualOpen(!open) : undefined}
        role={toggleable ? 'button' : undefined}
        tabIndex={toggleable ? 0 : undefined}
        onKeyDown={
          toggleable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setManualOpen(!open);
                }
              }
            : undefined
        }
      >
        <span className="text-muted-foreground">
          {hasEvents || editMode ? (
            open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : null}
        </span>
        <div className="min-w-0">
          <span className="text-sm font-semibold">
            {formatDayLabel(week.startISO)} – {formatDayLabel(week.endISO)}
          </span>
          <span className="text-muted-foreground ml-2 text-xs">
            {hasEvents
              ? `${week.events.length} ${week.events.length === 1 ? 'transaction' : 'transactions'}`
              : 'No expected activity'}
          </span>
        </div>
        {hasEvents && (
          <span
            className="text-right font-mono text-xs tabular-nums"
            style={{ color: week.net >= 0 ? 'var(--success)' : 'var(--muted-foreground)' }}
          >
            {signedCurrency(week.net)}
          </span>
        )}
        <span
          className="min-w-[96px] text-right font-mono text-sm font-semibold tabular-nums"
          style={{ color: week.endBalance < 0 ? 'var(--destructive)' : 'var(--foreground)' }}
        >
          {formatCurrency(week.endBalance)}
        </span>
      </div>

      {open && (hasEvents || editMode) && (
        <div className="border-t px-4 pt-1 pb-2 pl-11">
          {week.events.map((event) =>
            editMode && event.editable ? (
              <EditRow
                key={event.itemId}
                event={event}
                minDate={minDate}
                maxDate={maxDate}
                onUpdate={onUpdate}
                onRemove={onRemove}
              />
            ) : (
              <EventRow key={event.itemId ?? `${event.dateISO}-${event.desc}`} event={event} />
            ),
          )}
          {editMode && (
            <Button
              variant="outline"
              className="mt-2 border-dashed"
              size="sm"
              onClick={() => onAdd(week.startISO)}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add transaction to this week
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function ForecastLedger({
  weeks,
  editMode,
  onToggleEdit,
  onReseed,
  minDate,
  maxDate,
  onUpdate,
  onRemove,
  onAdd,
}: {
  weeks: WeekBucket[];
  editMode: boolean;
  onToggleEdit: () => void;
  onReseed: () => void;
  minDate: string;
  maxDate: string;
  onUpdate: (id: string, patch: Partial<LedgerItem>) => void;
  onRemove: (id: string) => void;
  onAdd: (dateISO: string) => void;
}) {
  return (
    <Card className="border">
      <CardContent className="px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Forecast ledger</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {editMode
                ? 'Fix amounts and dates, add or remove rows. Card payments are managed in the planner.'
                : 'Weeks with activity expand to daily detail.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {editMode && (
              <Button variant="ghost" size="sm" onClick={onReseed}>
                Restore auto-detected
              </Button>
            )}
            <Button variant={editMode ? 'default' : 'outline'} size="sm" onClick={onToggleEdit}>
              {editMode ? 'Done editing' : 'Edit transactions'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {weeks.map((week) => (
            <WeekRow
              key={week.index}
              week={week}
              editMode={editMode}
              minDate={minDate}
              maxDate={maxDate}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onAdd={onAdd}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
