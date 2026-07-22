-- Cash Flow Forecast tab: recurring inflow/outflow seed. queryKey = filename (forecast_recurring).
-- Detection runs in gold (see notebooks/nb_gold__transform_tiller.sql); the app only expands each
-- row into dated events across the forecast window. Cadence drives which date column is used:
--   monthly     -> day_of_month
--   semimonthly -> day_of_month (15) AND the last day of each month
--   biweekly    -> anchor_date, stepped +/- 14 days
SELECT description, category, group, direction, typical_amount,
       cadence, day_of_month, anchor_date, occurrence_count,
       months_present, last_seen, confidence, is_overridden
FROM personal_budgeting.gold.forecast_recurring
ORDER BY direction DESC, typical_amount DESC;
