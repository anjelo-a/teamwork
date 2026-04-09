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
const DEFAULT_TIMEOUT_MS = 30000;

export async function runFrontendBenchmarks(options) {
  const webBaseUrl = stripTrailingSlash(
    options.webBaseUrl ?? getEnvString('WEB_BASE_URL', DEFAULT_WEB_BASE_URL),
  );
  const accessToken = options.accessToken ?? getEnvString('BENCH_ACCESS_TOKEN');
  const workspaceId = options.workspaceId ?? getEnvString('BENCH_WORKSPACE_ID');
  const runs = options.runs ?? getEnvInteger('FRONTEND_RUNS', DEFAULT_RUNS);
  const timeoutMs = options.timeoutMs ?? getEnvInteger('FRONTEND_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);

  const boardUrl = `${webBaseUrl}/workspaces/${workspaceId}/board`;
  const browser = await chromium.launch({ headless: true });
  const runResults = [];

  try {
    for (let runNumber = 1; runNumber <= runs; runNumber += 1) {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.addInitScript((token) => {
          window.localStorage.setItem('teamwork.accessToken', token);
        }, accessToken);

        const start = performance.now();
        await page.goto(boardUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        await page.waitForSelector('[data-perf-board-ready="true"]', { timeout: timeoutMs });
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
            responseStartMs:
              typeof navEntry.responseStart === 'number' ? navEntry.responseStart : 0,
          };
        });

        runResults.push({
          run: runNumber,
          success: true,
          boardReadyMs: round(boardReadyMs),
          domContentLoadedMs: round(navigationTiming.domContentLoadedMs),
          loadEventMs: round(navigationTiming.loadEventMs),
          responseStartMs: round(navigationTiming.responseStartMs),
        });
      } catch (error) {
        runResults.push({
          run: runNumber,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        await context.close();
      }
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
      timeoutMs,
    },
    successfulRuns: successfulRuns.length,
    failedRuns: runResults.length - successfulRuns.length,
    metrics: {
      boardReadyMs: summarizeNumberSeries(boardReadySeries),
      domContentLoadedMs: summarizeNumberSeries(domContentLoadedSeries),
      loadEventMs: summarizeNumberSeries(loadEventSeries),
    },
    runs: runResults,
  };
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
