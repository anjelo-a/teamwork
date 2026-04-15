import autocannon from 'autocannon';
import { fileURLToPath } from 'node:url';
import {
  createAuthHeaders,
  getEnvInteger,
  getEnvString,
  round,
  stripTrailingSlash,
  toIsoTimestamp,
} from './perf-utils.mjs';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3000';
const DEFAULT_CONNECTIONS = 1;
const DEFAULT_DURATION_SECONDS = 30;
const DEFAULT_WARMUP_SECONDS = 5;
const DEFAULT_REQUEST_TIMEOUT_SECONDS = 60;

export async function runBackendBenchmarks(options) {
  const apiBaseUrl = stripTrailingSlash(
    options.apiBaseUrl ?? getEnvString('API_BASE_URL', DEFAULT_API_BASE_URL),
  );
  const accessToken = options.accessToken ?? getEnvString('BENCH_ACCESS_TOKEN');
  const workspaceId = options.workspaceId ?? getEnvString('BENCH_WORKSPACE_ID');
  const sampleTaskId = options.sampleTaskId ?? getEnvString('BENCH_TASK_ID');
  const connections = options.connections ?? getEnvInteger('BACKEND_CONNECTIONS', DEFAULT_CONNECTIONS);
  const durationSeconds =
    options.durationSeconds ?? getEnvInteger('BACKEND_DURATION_SECONDS', DEFAULT_DURATION_SECONDS);
  const warmupSeconds =
    options.warmupSeconds ?? getEnvInteger('BACKEND_WARMUP_SECONDS', DEFAULT_WARMUP_SECONDS);
  const requestTimeoutSeconds =
    options.requestTimeoutSeconds ??
    getEnvInteger('BACKEND_REQUEST_TIMEOUT_SECONDS', DEFAULT_REQUEST_TIMEOUT_SECONDS);

  const authHeaders = createAuthHeaders(accessToken);
  const scenarios = [
    {
      id: 'tasks-inbox',
      label: 'GET /tasks',
      method: 'GET',
      path: '/tasks',
    },
    {
      id: 'workspace-tasks',
      label: 'GET /workspaces/:workspaceId/tasks',
      method: 'GET',
      path: `/workspaces/${workspaceId}/tasks`,
    },
    {
      id: 'update-status',
      label: 'PATCH /workspaces/:workspaceId/tasks/:taskId/status',
      method: 'PATCH',
      path: `/workspaces/${workspaceId}/tasks/${sampleTaskId}/status`,
      body: { status: 'in_progress' },
      headers: { 'Content-Type': 'application/json' },
    },
  ];

  const results = [];

  for (const scenario of scenarios) {
    await executeAutocannon({
      url: `${apiBaseUrl}${scenario.path}`,
      connections,
      duration: warmupSeconds,
      timeout: requestTimeoutSeconds,
      method: scenario.method,
      headers: {
        ...authHeaders,
        ...(scenario.headers ?? {}),
      },
      body: scenario.body ? JSON.stringify(scenario.body) : undefined,
    });

    const measured = await executeAutocannon({
      url: `${apiBaseUrl}${scenario.path}`,
      connections,
      duration: durationSeconds,
      timeout: requestTimeoutSeconds,
      method: scenario.method,
      headers: {
        ...authHeaders,
        ...(scenario.headers ?? {}),
      },
      body: scenario.body ? JSON.stringify(scenario.body) : undefined,
    });

    results.push({
      id: scenario.id,
      label: scenario.label,
      method: scenario.method,
      path: scenario.path,
      latencyMs: {
        avg: round(readAverageLatency(measured.latency)),
        p50: round(readLatencyPercentile(measured.latency, 50)),
        p95: round(readLatencyPercentile(measured.latency, 95)),
        p99: round(readLatencyPercentile(measured.latency, 99)),
      },
      requestsPerSecond: round(readRequestsPerSecond(measured.requests)),
      totalRequests: measured.requests?.total ?? 0,
      errors: measured.errors ?? 0,
      timeouts: measured.timeouts ?? 0,
      non2xx: measured.non2xx ?? 0,
      bytesPerSecond: round(readBytesPerSecond(measured.throughput)),
    });
  }

  return {
    capturedAt: toIsoTimestamp(),
    apiBaseUrl,
    config: {
      connections,
      durationSeconds,
      warmupSeconds,
      requestTimeoutSeconds,
    },
    endpoints: results,
  };
}

function executeAutocannon(options) {
  return new Promise((resolve, reject) => {
    autocannon(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}

function readAverageLatency(latency) {
  if (!latency || typeof latency !== 'object') {
    return 0;
  }

  if (typeof latency.average === 'number') {
    return latency.average;
  }

  if (typeof latency.mean === 'number') {
    return latency.mean;
  }

  return 0;
}

function readRequestsPerSecond(requests) {
  if (!requests || typeof requests !== 'object') {
    return 0;
  }

  if (typeof requests.average === 'number') {
    return requests.average;
  }

  if (typeof requests.mean === 'number') {
    return requests.mean;
  }

  return 0;
}

function readBytesPerSecond(throughput) {
  if (!throughput || typeof throughput !== 'object') {
    return 0;
  }

  if (typeof throughput.average === 'number') {
    return throughput.average;
  }

  if (typeof throughput.mean === 'number') {
    return throughput.mean;
  }

  return 0;
}

function readLatencyPercentile(latency, percentile) {
  if (!latency || typeof latency !== 'object') {
    return 0;
  }

  const directKeys = [
    `p${percentile}`,
    `${percentile}`,
    `p${String(percentile).replace('.', '_')}`,
  ];

  for (const key of directKeys) {
    const value = latency[key];
    if (typeof value === 'number') {
      return value;
    }
  }

  const percentileEntries = Object.entries(latency)
    .map(([key, value]) => ({ key, value: typeof value === 'number' ? value : null }))
    .filter((entry) => entry.value !== null && entry.key.startsWith('p'))
    .map((entry) => ({
      percentile: Number.parseFloat(entry.key.slice(1).replace('_', '.')),
      value: entry.value,
    }))
    .filter((entry) => Number.isFinite(entry.percentile))
    .sort((left, right) => left.percentile - right.percentile);

  if (percentileEntries.length === 0) {
    return readAverageLatency(latency);
  }

  const exact = percentileEntries.find((entry) => entry.percentile === percentile);
  if (exact) {
    return exact.value;
  }

  const lower = [...percentileEntries]
    .reverse()
    .find((entry) => entry.percentile < percentile);
  const upper = percentileEntries.find((entry) => entry.percentile > percentile);

  if (!lower && upper) {
    return upper.value;
  }

  if (!upper && lower) {
    return lower.value;
  }

  if (!lower || !upper || upper.percentile === lower.percentile) {
    return readAverageLatency(latency);
  }

  const progress = (percentile - lower.percentile) / (upper.percentile - lower.percentile);
  return lower.value + (upper.value - lower.value) * progress;
}

async function runFromCli() {
  const result = await runBackendBenchmarks({});
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runFromCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
