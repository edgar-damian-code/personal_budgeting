const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const signedCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
  signDisplay: 'always',
});

const monthLongFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthShortFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const monthOnlyFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });
const dateShortFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatSignedCurrency(value: number): string {
  return signedCurrencyFormatter.format(value);
}

export function formatMonthLong(isoDate: string): string {
  return monthLongFormatter.format(new Date(isoDate));
}

export function formatMonthShort(isoDate: string): string {
  return monthShortFormatter.format(new Date(isoDate));
}

export function formatMonthOnly(isoDate: string): string {
  return monthOnlyFormatter.format(new Date(isoDate));
}

// Short calendar date, e.g. "Jul 18" (used for payment / balance-snapshot dates).
export function formatDateShort(isoDate: string): string {
  return dateShortFormatter.format(new Date(isoDate));
}

// `fraction` is a 0-1 ratio (e.g. net_cashflow / income), not an already-scaled percentage.
export function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

export function currentMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}
