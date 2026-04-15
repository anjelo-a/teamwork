import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import {
  getEnvInteger,
  getEnvString,
  round,
  stripTrailingSlash,
  summarizeNumberSeries,
  toIsoTimestamp,
} from './perf-utils.mjs';

const DEFAULT_WEB_BASE_URL = 'http://127.0.0.1:3001';
const DEFAULT_RUNS = 10;
const DEFAULT_TIMEOUT_MS = 90000;
const DEFAULT_WARMUP_RUNS = 1;
const BOARD_READY_SELECTORS = [
  '[data-perf-board-ready="true"]',
  'h2:has-text("Filters")',
];
const BOARD_ERROR_SELECTORS = ['text=Board unavailable', 'button:has-text("Retry board")'];
const BOARD_READY_POLL_INTERVAL_MS = 250;

export async function runFrontendBenchmarks(options) {
  const webBaseUrl = stripTrailingSlash(
    options.webBaseUrl ?? getEnvString('WEB_BASE_URL', DEFAULT_WEB_BASE_URL),
  );
  const accessToken = options.accessToken ?? getEnvString('BENCH_ACCESS_TOKEN');
  const workspaceId = options.workspaceId ?? getEnvString('BENCH_WORKSPACE_ID');
  const runs = options.runs ?? getEnvInteger('FRONTEND_RUNS', DEFAULT_RUNS);
  const timeoutMs = options.timeoutMs ?? getEnvInteger('FRONTEND_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
  const warmupRuns =
    options.warmupRuns ?? getEnvInteger('FRONTEND_WARMUP_RUNS', DEFAULT_WARMUP_RUNS);

  const boardUrl = `${webBaseUrl}/workspaces/${workspaceId}/board`;
  const browser = await chromium.launch({ headless: true });
  const runResults = [];
  const warmupResults = [];

  try {
    for (let warmupRunNumber = 1; warmupRunNumber <= warmupRuns; warmupRunNumber += 1) {
      const warmupResult = await runBoardMeasurement({
        browser,
        boardUrl,
        accessToken,
        timeoutMs,
      });
      warmupResults.push({
        run: warmupRunNumber,
        ...warmupResult,
      });
    }

    for (let runNumber = 1; runNumber <= runs; runNumber += 1) {
      const result = await runBoardMeasurement({
        browser,
        boardUrl,
        accessToken,
        timeoutMs,
      });
      runResults.push({
        run: runNumber,
        ...result,
      });
    }
  } finally {
    await browser.close();
  }

  const successfulRuns = runResults.filter((result) => result.success);
  const boardReadySeries = successfulRuns.map((result) => result.boardReadyMs);
  const domContentLoadedSeries = successfulRuns.map((result) => result.domContentLoadedMs);
  const loadEventSeries = successfulRuns.map((result) => result.loadEventMs);

  return {
    capturedAt: toIsoTimestamp(),
    webBaseUrl,
    boardUrl,
    config: {
      runs,
      warmupRuns,
      timeoutMs,
    },
    warmupSuccessfulRuns: warmupResults.filter((result) => result.success).length,
    warmupFailedRuns: warmupResults.filter((result) => !result.success).length,
    successfulRuns: successfulRuns.length,
    failedRuns: runResults.length - successfulRuns.length,
    metrics: {
      boardReadyMs: summarizeNumberSeries(boardReadySeries),
      domContentLoadedMs: summarizeNumberSeries(domContentLoadedSeries),
      loadEventMs: summarizeNumberSeries(loadEventSeries),
    },
    warmups: warmupResults,
    runs: runResults,
  };
}

async function runBoardMeasurement({
  browser,
  boardUrl,
  accessToken,
  timeoutMs,
}) {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Keep auth token in localStorage only. Setting a web-domain auth cookie causes
    // server bootstrap to switch into cookie-session marker mode, which can drop
    // Bearer auth on client API requests during benchmarks.
    await page.addInitScript((token) => {
      window.localStorage.setItem('teamwork.accessToken', token);
    }, accessToken);

    const start = performance.now();
    await page.goto(boardUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const readySignal = await waitForBoardReady({ page, timeoutMs });
    const boardReadyMs = performance.now() - start;

    const navigationTiming = await page.evaluate(() => {
      const navEntry = performance.getEntriesByType('navigation')[0];

      if (!navEntry || typeof navEntry !== 'object') {
        return {
          domContentLoadedMs: 0,
          loadEventMs: 0,
          responseStartMs: 0,
        };
      }

      return {
        domContentLoadedMs:
          typeof navEntry.domContentLoadedEventEnd === 'number'
            ? navEntry.domContentLoadedEventEnd
            : 0,
        loadEventMs: typeof navEntry.loadEventEnd === 'number' ? navEntry.loadEventEnd : 0,
        responseStartMs: typeof navEntry.responseStart === 'number' ? navEntry.responseStart : 0,
      };
    });

    return {
      success: true,
      readySignal,
      boardReadyMs: round(boardReadyMs),
      domContentLoadedMs: round(navigationTiming.domContentLoadedMs),
      loadEventMs: round(navigationTiming.loadEventMs),
      responseStartMs: round(navigationTiming.responseStartMs),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await context.close();
  }
}

async function waitForBoardReady({ page, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const errorSelector = await findFirstVisibleSelector(page, BOARD_ERROR_SELECTORS);
    if (errorSelector) {
      throw new Error(`Board rendered an error state before readiness (${errorSelector}).`);
    }

    const readySelector = await findFirstVisibleSelector(page, BOARD_READY_SELECTORS);
    if (readySelector) {
      return readySelector;
    }

    await page.waitForTimeout(BOARD_READY_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Timed out waiting for board readiness (${timeoutMs}ms). Ready selectors: ${BOARD_READY_SELECTORS.join(', ')}. Error selectors: ${BOARD_ERROR_SELECTORS.join(', ')}.`,
  );
}

async function findFirstVisibleSelector(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    if (await locator.isVisible().catch(() => false)) {
      return selector;
    }
  }

  return null;
}

async function runFromCli() {
  const result = await runFrontendBenchmarks({});
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runFromCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
