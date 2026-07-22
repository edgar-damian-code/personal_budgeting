import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Skeleton,
  useAnalyticsQuery,
} from '@databricks/appkit-ui/react';
import { cardShortName } from '../creditcards/cards';
import type { CreditCardMonthlyRow } from '../creditcards/types';
import { BalanceChart } from './BalanceChart';
import { addDays, formatDayLong, todayISO } from './dates';
import { ForecastLedger } from './ForecastLedger';
import { buildEvents, computeWeeks, dailyBalances, newItemId, summarize, WINDOW_DAYS } from './forecast';
import { KpiStrip } from './KpiStrip';
import { PaymentPlanner } from './PaymentPlanner';
import { expandRecurring } from './recurring';
import { clearPlan, loadPlan, savePlan } from './storage';
import type { CheckingBalanceRow, ForecastPlan, LedgerItem, PlannedPayment, RecurringRow } from './types';

export function ForecastPage() {
  const noParams = useMemo(() => ({}), []);

  const {
    data: recurringData,
    loading: recurringLoading,
    error: recurringError,
  } = useAnalyticsQuery('forecast_recurring', noParams);
  const {
    data: balanceData,
    loading: balanceLoading,
    error: balanceError,
  } = useAnalyticsQuery('checking_balance', noParams);
  const {
    data: cardData,
    loading: cardLoading,
    error: cardError,
  } = useAnalyticsQuery('credit_card_monthly', noParams);

  const recurring = useMemo(() => (recurringData ?? []) as RecurringRow[], [recurringData]);
  const balanceRow = useMemo(() => ((balanceData ?? []) as CheckingBalanceRow[])[0] ?? null, [balanceData]);
  const cards = useMemo(() => (cardData ?? []) as CreditCardMonthlyRow[], [cardData]);

  // The window is anchored to today and fixed for the session — recomputing it on every
  // render would shift every date at midnight mid-session.
  const startISO = useMemo(() => todayISO(), []);
  const endISO = useMemo(() => addDays(startISO, WINDOW_DAYS - 1), [startISO]);

  const [stored, setStored] = useState<ForecastPlan>(() => loadPlan());
  const [editMode, setEditMode] = useState(false);

  // Persist on every change. The stored shape is exactly what `stored` holds, so there is
  // no serialization step that could drift from the in-memory model.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    savePlan(stored);
  }, [stored]);

  const queryBalance = balanceRow ? Number(balanceRow.current_balance) || 0 : 0;
  const startBal = stored.startBal ?? queryBalance;

  const seeded = useMemo(
    () => expandRecurring(recurring, startISO, WINDOW_DAYS),
    [recurring, startISO],
  );
  // The user's edited copy wins once it exists; until then the ledger is the live seed.
  const items = stored.items ?? seeded;

  const cardNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of cards) map[c.account_num] = cardShortName(c.account_num, c.account);
    return map;
  }, [cards]);

  const events = useMemo(
    () => buildEvents({ items, plan: stored.plan, cardNames, startISO, days: WINDOW_DAYS, startBal }),
    [items, stored.plan, cardNames, startISO, startBal],
  );
  const series = useMemo(() => dailyBalances(events, startBal, WINDOW_DAYS), [events, startBal]);
  const weeks = useMemo(
    () => computeWeeks(events, startBal, startISO, WINDOW_DAYS),
    [events, startBal, startISO],
  );
  const summary = useMemo(() => summarize(events, startBal, series), [events, startBal, series]);

  // Any mutation materializes `items` — once the user touches the ledger we stop tracking
  // the live seed, otherwise a nightly gold refresh would silently rewrite their edits.
  const mutateItems = useCallback(
    (fn: (current: LedgerItem[]) => LedgerItem[]) => {
      setStored((s) => ({ ...s, items: fn(s.items ?? seeded) }));
    },
    [seeded],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<LedgerItem>) => {
      mutateItems((current) => current.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    [mutateItems],
  );

  const removeItem = useCallback(
    (id: string) => mutateItems((current) => current.filter((it) => it.id !== id)),
    [mutateItems],
  );

  const addItem = useCallback(
    (dateISO: string) => {
      mutateItems((current) => [
        ...current,
        { id: newItemId(), dateISO, desc: 'New transaction', group: 'Other', type: 'out', amount: 0 },
      ]);
    },
    [mutateItems],
  );

  const updatePayment = useCallback((cardNum: string, index: number, patch: Partial<PlannedPayment>) => {
    setStored((s) => {
      const list = [...(s.plan[cardNum] ?? [])];
      list[index] = { ...list[index], ...patch };
      return { ...s, plan: { ...s.plan, [cardNum]: list } };
    });
  }, []);

  const addPayment = useCallback(
    (cardNum: string) => {
      setStored((s) => ({
        ...s,
        plan: { ...s.plan, [cardNum]: [...(s.plan[cardNum] ?? []), { amt: 0, date: startISO }] },
      }));
    },
    [startISO],
  );

  const removePayment = useCallback((cardNum: string, index: number) => {
    setStored((s) => {
      const list = [...(s.plan[cardNum] ?? [])];
      list.splice(index, 1);
      return { ...s, plan: { ...s.plan, [cardNum]: list } };
    });
  }, []);

  // Drop back to the live seed rather than snapshotting it, so the ledger keeps tracking
  // the daily gold refresh until the user edits again.
  const reseed = useCallback(() => setStored((s) => ({ ...s, items: null })), []);

  const resetAll = useCallback(() => {
    clearPlan();
    setStored({ startBal: null, plan: {}, items: null });
    setEditMode(false);
  }, []);

  const anyError = recurringError ?? balanceError ?? cardError;
  const loading = recurringLoading || balanceLoading || cardLoading;
  const hasData = recurring.length > 0 || balanceRow !== null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Cash Flow Forecast</h2>
          <p className="text-muted-foreground text-sm">
            Plan payments and watch the Ally Spending ··1871 balance respond, day by day · as of{' '}
            {formatDayLong(startISO)}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={resetAll}>
          Reset plan
        </Button>
      </div>

      {anyError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load forecast data</AlertTitle>
          <AlertDescription>{anyError}</AlertDescription>
        </Alert>
      )}

      {loading && !anyError && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 flex-[1_1_190px]" />
            ))}
          </div>
          <Skeleton className="h-[360px] w-full" />
          <div className="flex flex-wrap gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56 flex-[1_1_320px]" />
            ))}
          </div>
        </div>
      )}

      {!loading && !anyError && !hasData && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TrendingUp />
            </EmptyMedia>
            <EmptyTitle>No forecast data</EmptyTitle>
            <EmptyDescription>
              gold.forecast_recurring has no rows yet. Run the gold notebook to detect recurring
              transactions.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {!loading && !anyError && hasData && (
        <>
          <KpiStrip
            summary={summary}
            startBal={startBal}
            onStartBalChange={(next) => setStored((s) => ({ ...s, startBal: next }))}
            balanceAsOf={balanceRow?.balance_as_of ?? null}
            endISO={endISO}
          />
          <BalanceChart series={series} startBal={startBal} startISO={startISO} days={WINDOW_DAYS} />
          <PaymentPlanner
            cards={cards}
            plan={stored.plan}
            minDate={startISO}
            maxDate={endISO}
            onUpdate={updatePayment}
            onAdd={addPayment}
            onRemove={removePayment}
          />
          <ForecastLedger
            weeks={weeks}
            editMode={editMode}
            onToggleEdit={() => setEditMode((v) => !v)}
            onReseed={reseed}
            minDate={startISO}
            maxDate={endISO}
            onUpdate={updateItem}
            onRemove={removeItem}
            onAdd={addItem}
          />
        </>
      )}
    </div>
  );
}
