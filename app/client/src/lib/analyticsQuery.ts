import { useMemo } from 'react';
import { useAnalyticsQuery as baseUseAnalyticsQuery } from '@databricks/appkit-ui/react';
import { useDemoMode } from './demoMode';
import { maskRows } from './demoData';

// Drop-in replacement for AppKit's useAnalyticsQuery. Every page imports the hook from
// here instead of '@databricks/appkit-ui/react'; behaviour is identical except that,
// when demo mode is on, the returned rows are pseudonymized in the browser (see
// lib/demoData.ts). Nothing else about the query — params, loading/error state,
// warehouse status — changes.
//
// The signature is pinned to the underlying hook via Parameters/ReturnType. Per-query
// generic inference collapses to the default instantiation, which is harmless here:
// every call site already casts `data` to its own row type (e.g. `as SpendRow[]`).
export function useAnalyticsQuery(
  ...args: Parameters<typeof baseUseAnalyticsQuery>
): ReturnType<typeof baseUseAnalyticsQuery> {
  const { demoMode } = useDemoMode();
  const result = baseUseAnalyticsQuery(...args);

  const data = useMemo(
    () =>
      (demoMode && Array.isArray(result.data)
        ? maskRows(result.data)
        : result.data) as typeof result.data,
    [demoMode, result.data],
  );

  return { ...result, data };
}
