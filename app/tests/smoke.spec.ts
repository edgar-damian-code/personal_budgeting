import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const NAV_TABS = ['Cash Flow', 'Forecast', 'Credit Cards', 'Budget vs Actual', 'Spend Analysis'];

// Per-tab landmarks. Assertions stay STRUCTURAL (headings, section labels) rather than
// data-specific, so a nightly gold refresh can't turn the deploy gate red.
const TAB_CONTENT: { route: string; heading: string; landmarks: (string | RegExp)[] }[] = [
  { route: '/', heading: 'Cash Flow', landmarks: ['Net Cash Flow', 'Fixed Outflows'] },
  {
    route: '/forecast',
    heading: 'Cash Flow Forecast',
    landmarks: ['Balance today', 'Lowest point', 'Plan credit-card payments', 'Forecast ledger'],
  },
  // The activity title carries the month ("Monthly Activity — July 2026"), so match a prefix.
  { route: '/credit-cards', heading: 'Credit Cards', landmarks: [/^Monthly Activity/] },
  { route: '/budget', heading: 'Budget vs. Actual', landmarks: [] },
  { route: '/spend', heading: 'Spend Analysis', landmarks: ['Total Spend'] },
];

// ── Tests ───────────────────────────────────────────────────────────────────

let testArtifactsDir: string;
let consoleLogs: string[] = [];
let consoleErrors: string[] = [];
let pageErrors: string[] = [];
let failedRequests: string[] = [];

test('smoke test - app loads and displays Cash Flow tab', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Cash Flow', exact: true })).toBeVisible();

  for (const tab of NAV_TABS) {
    await expect(page.getByRole('link', { name: tab, exact: true })).toBeVisible();
  }

  // Data loaded from gold.monthly_cashflow — wait for the KPI cards to render.
  // ("Income" also appears in the trend chart legend, so assert on card-only labels.)
  await expect(page.getByText('Net Cash Flow', { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('Fixed Outflows', { exact: true })).toBeVisible();
});

for (const tab of TAB_CONTENT) {
  test(`smoke test - ${tab.heading} tab renders`, async ({ page }) => {
    await page.goto(tab.route);

    await expect(page.getByRole('heading', { name: tab.heading, exact: true })).toBeVisible({
      timeout: 30000,
    });
    for (const landmark of tab.landmarks) {
      const locator =
        typeof landmark === 'string'
          ? page.getByText(landmark, { exact: true })
          : page.getByText(landmark);
      await expect(locator.first()).toBeVisible({ timeout: 30000 });
    }
    // A tab that errored renders the Alert instead of its content.
    await expect(page.getByText(/^Could not load/)).toHaveCount(0);
  });
}

test('smoke test - forecast reacts to a planned card payment', async ({ page }) => {
  await page.goto('/forecast');
  await expect(page.getByRole('heading', { name: 'Cash Flow Forecast' })).toBeVisible({ timeout: 30000 });

  // The ledger must actually seed from gold.forecast_recurring — an empty ledger means
  // expandRecurring dropped everything (bad cadence, window mismatch, missing anchor).
  await expect(page.getByText(/\d+ transactions?$/).first()).toBeVisible({ timeout: 30000 });

  const projected = page.getByText('Projected ·').locator('..').locator('div.font-mono').first();
  const before = await projected.textContent();

  await page.getByRole('button', { name: 'Add a payment' }).first().click();
  const amount = page.getByLabel(/Payment amount for/).first();
  await amount.fill('1500');
  await amount.blur();

  // Planning a payment must move the projected end balance.
  await expect(projected).not.toHaveText(before ?? '');
});

// ── Lifecycle hooks ─────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  consoleLogs = [];
  consoleErrors = [];
  pageErrors = [];
  failedRequests = [];

  // Create temp directory for test artifacts
  testArtifactsDir = join(process.cwd(), '.smoke-test');
  mkdirSync(testArtifactsDir, { recursive: true });

  // Capture console logs and errors (including React errors)
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();

    // Skip empty lines and formatting placeholders
    if (!text.trim() || /^%[osd]$/.test(text.trim())) {
      return;
    }

    // Get stack trace for errors if available
    const location = msg.location();
    const locationStr = location.url ? ` at ${location.url}:${location.lineNumber}:${location.columnNumber}` : '';

    consoleLogs.push(`[${type}] ${text}${locationStr}`);

    // Separately track error messages (React errors appear here)
    if (type === 'error') {
      consoleErrors.push(`${text}${locationStr}`);
    }
  });

  // Capture page errors with full stack trace
  page.on('pageerror', (error) => {
    const errorDetails = `Page error: ${error.message}\nStack: ${error.stack || 'No stack trace available'}`;
    pageErrors.push(errorDetails);
    // Also log to console for immediate visibility
    console.error('Page error detected:', errorDetails);
  });

  // Capture failed requests
  page.on('requestfailed', (request) => {
    failedRequests.push(`Failed request: ${request.url()} - ${request.failure()?.errorText}`);
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const testName = testInfo.title.replace(/ /g, '-').toLowerCase();
  // Always capture artifacts, even if test fails
  const screenshotPath = join(testArtifactsDir, `${testName}-app-screenshot.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const logsPath = join(testArtifactsDir, `${testName}-console-logs.txt`);
  const allLogs = [
    '=== Console Logs ===',
    ...consoleLogs,
    '\n=== Console Errors (React errors) ===',
    ...consoleErrors,
    '\n=== Page Errors ===',
    ...pageErrors,
    '\n=== Failed Requests ===',
    ...failedRequests,
  ];
  writeFileSync(logsPath, allLogs.join('\n'), 'utf-8');

  console.log(`Screenshot saved to: ${screenshotPath}`);
  console.log(`Console logs saved to: ${logsPath}`);
  if (consoleErrors.length > 0) {
    console.log('Console errors detected:', consoleErrors);
  }
  if (pageErrors.length > 0) {
    console.log('Page errors detected:', pageErrors);
  }
  if (failedRequests.length > 0) {
    console.log('Failed requests detected:', failedRequests);
  }

  await page.close();
});
