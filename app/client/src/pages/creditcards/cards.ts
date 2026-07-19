// Per-card brand identity — display name + accent color (a --card-* token from index.css),
// keyed by account_num. The 3 cards are fixed; anything unexpected falls back to the data's
// own `account` name and a neutral color.
export const CARD_META: Record<string, { name: string; color: string }> = {
  '1002': { name: 'Hilton Honors Aspire', color: 'var(--card-aspire)' },
  '8957': { name: 'Prime Visa', color: 'var(--card-prime)' },
  '4870': { name: 'Southwest Plus', color: 'var(--card-southwest)' },
};

export function cardName(accountNum: string, fallback: string): string {
  return CARD_META[accountNum]?.name ?? fallback;
}

export function cardColor(accountNum: string): string {
  return CARD_META[accountNum]?.color ?? 'var(--muted-foreground)';
}

// Net activity: negative (paid the balance down) is good; positive (balance grew) is bad.
export function netIsGood(net: number): boolean {
  return net <= 0;
}

// Signed "$X" with a Unicode minus for negatives (matches the mockup's ∓ styling).
export function formatSignedAmount(value: number): string {
  const sign = value < 0 ? '−' : '+';
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString('en-US')}`;
}
