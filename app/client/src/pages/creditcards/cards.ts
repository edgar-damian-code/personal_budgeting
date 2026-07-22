// Per-card brand identity — display name + accent color (a --card-* token from index.css),
// keyed by account_num. The 3 cards are fixed; anything unexpected falls back to the data's
// own `account` name and a neutral color.
// `color` is the MARK (small elements: dots, split bars, chart series — lightness-tuned
// per theme). `face` is the EXACT card brand hex, for large surfaces where the fill reads
// as the physical card. See the --card-* block in index.css for why they differ.
export const CARD_META: Record<
  string,
  { name: string; short: string; initials: string; color: string; face: string }
> = {
  '1002': {
    name: 'Hilton Honors Aspire',
    short: 'Hilton Aspire',
    initials: 'HA',
    color: 'var(--card-aspire)',
    face: 'var(--card-aspire-face)',
  },
  '8957': {
    name: 'Prime Visa',
    short: 'Prime Visa',
    initials: 'PV',
    color: 'var(--card-prime)',
    face: 'var(--card-prime-face)',
  },
  '4870': {
    name: 'Southwest Plus',
    short: 'Southwest',
    initials: 'SW',
    color: 'var(--card-southwest)',
    face: 'var(--card-southwest-face)',
  },
};

export function cardName(accountNum: string, fallback: string): string {
  return CARD_META[accountNum]?.name ?? fallback;
}

// Compact name for tight surfaces (the Forecast planner cards and ledger rows).
export function cardShortName(accountNum: string, fallback: string): string {
  return CARD_META[accountNum]?.short ?? fallback;
}

// Two-letter monogram for the planner's card chip.
export function cardInitials(accountNum: string, fallback: string): string {
  return CARD_META[accountNum]?.initials ?? fallback.slice(0, 2).toUpperCase();
}

// Small-element identity color (ledger dots, split bars, chart series).
export function cardColor(accountNum: string): string {
  return CARD_META[accountNum]?.color ?? 'var(--muted-foreground)';
}

// Exact brand color, for large fills that should read as the physical card. Pair with
// --card-ink for text — all four brand colors are dark.
export function cardFaceColor(accountNum: string): string {
  return CARD_META[accountNum]?.face ?? 'var(--muted-foreground)';
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
