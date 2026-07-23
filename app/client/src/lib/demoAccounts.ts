// Fixed 1:1 aliases for the real account/card last-4 that appear throughout the app.
// Demo mode swaps the real digits for these when masking query rows (see demoData.ts).
//
// account_num doubles as the identity key for card colors and names (CARD_META in
// creditcards/cards.ts, ACCOUNT_COLOR in spend/aggregate.ts) AND as displayed text
// (··1002). So those lookups run the value through realAccountNum() first, mapping a demo
// last-4 back to the real key — that way the fake digits still resolve to the right card
// color/name. Aliases are chosen so none collides with a real last-4.
export const DEMO_ACCOUNT_ALIAS: Record<string, string> = {
  '1871': '2048', // Ally joint checking ··1871
  '4072': '3175', // Ally spending ··4072
  '4061': '6390', // Ally savings ··4061
  '9920': '7712', // Ally savings ··9920
  '1002': '5581', // Amex Hilton Aspire ··1002
  '8957': '6624', // Chase Prime Visa ··8957
  '4870': '9047', // Chase Southwest ··4870
};

const REAL_BY_ALIAS: Record<string, string> = {};
for (const [real, fake] of Object.entries(DEMO_ACCOUNT_ALIAS)) REAL_BY_ALIAS[fake] = real;

// Map a possibly-demo-aliased last-4 back to the real account_num used as the identity key.
// Returns the input unchanged when it isn't a demo alias (i.e. demo off, real digits).
export function realAccountNum(accountNum: string): string {
  return REAL_BY_ALIAS[accountNum] ?? accountNum;
}
