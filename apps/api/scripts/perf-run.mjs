import { prepareFixtures } from './perf-fixtures.mjs';
import { runBackendBenchmarks } from './perf-backend.mjs';
import { runFrontendBenchmarks } from './perf-frontend.mjs';
import { fileURLToPath } from 'node:url';
import {
  getEnvString,
  toIsoTimestamp,
  writeJsonArtifact,
  writeMarkdownArtifact,
} from './perf-utils.mjs';

const VALID_RUN_LABELS = new Set(['baseline', 'after']);
const VALID_ENV_LABELS = new Set(['local', 'deployed']);

export async function runPerformanceCapture() {
  const runLabel = getEnvString('RUN_LABEL', 'baseline').toLowerCase();
  const envLabel = getEnvString('ENV_LABEL', 'local').toLowerCase();

  if (!VALID_RUN_LABELS.has(runLabel)) {
    throw new Error(`RUN_LABEL must be one of: ${Array.from(VALID_RUN_LABELS).join(', ')}`);
  }

  if (!VALID_ENV_LABELS.has(envLabel)) {
    throw new Error(`ENV_LABEL must be one of: ${Array.from(VALID_ENV_LABELS).join(', ')}`);
  }

  const fixture = await prepareFixtures();
  const backend = await runBackendBenchmarks({
    apiBaseUrl: fixture.apiBaseUrl,
    accessToken: fixture.auth.accessToken,
    workspaceId: fixture.workspaceId,
    sampleTaskId: fixture.sampleTaskId,
  });
  const frontend = await runFrontendBenchmarks({
    accessToken: fixture.auth.accessToken,
    workspaceId: fixture.workspaceId,
  });

  assertBenchmarkQuality(backend, frontend);

  const output = {
    capturedAt: toIsoTimestamp(),
    runLabel,
    environmentLabel: envLabel,
    apiBaseUrl: fixture.apiBaseUrl,
    webBaseUrl: frontend.webBaseUrl,
    fixture: {
      workspaceId: fixture.workspaceId,
      sampleTaskId: fixture.sampleTaskId,
      taskPrefix: fixture.taskPrefix,
      targetTaskCount: fixture.targetTaskCount,
      benchmarkTaskCount: fixture.benchmarkTaskCount,
      createdTaskCount: fixture.createdTaskCount,
    },
    backend,
    frontend,
  };

  const artifactName = `${runLabel}-${envLabel}.json`;
  const outputPath = await writeJsonArtifact(artifactName, output);

  const runNotesPath = await writeMarkdownArtifact(
    `${runLabel}-${envLabel}.md`,
    buildRunNotes(output),
  );

  return {
    artifactName,
    outputPath,
    runNotesPath,
    output,
  };
}

function assertBenchmarkQuality(backend, frontend) {
  const invalidBackendEndpoints = backend.endpoints.filter(
    (endpoint) => endpoint.non2xx > 0 || endpoint.errors > 0 || endpoint.timeouts > 0,
  );

  if (invalidBackendEndpoints.length > 0) {
    const endpointLabels = invalidBackendEndpoints.map((endpoint) => endpoint.label).join(', ');
    throw new Error(
      `Backend benchmark produced invalid responses for: ${endpointLabels}. Check throttling/auth before using this run.`,
    );
  }

  if (frontend.successfulRuns === 0) {
    throw new Error(
      'Frontend benchmark produced zero successful runs. Check web runtime mode and board load readiness before using this run.',
    );
  }
}

function buildRunNotes(output) {
  const backendRows = output.backend.endpoints
    .map((endpoint) => {
      return `| ${endpoint.label} | ${endpoint.latencyMs.p50} | ${endpoint.latencyMs.p95} | ${endpoint.latencyMs.p99} | ${endpoint.requestsPerSecond} | ${endpoint.errors + endpoint.non2xx + endpoint.timeouts} |`;
    })
    .join('\n');

  return [
    `# ${output.runLabel} / ${output.environmentLabel} Benchmark Snapshot`,
    '',
    `Captured at: ${output.capturedAt}`,
    `API: ${output.apiBaseUrl}`,
    `Web: ${output.webBaseUrl}`,
    '',
    '## Backend Endpoints',
    '',
    '| Endpoint | p50 latency (ms) | p95 latency (ms) | p99 latency (ms) | req/s | error count |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    backendRows,
    '',
    '## Frontend Board',
    '',
    `- Successful runs: ${output.frontend.successfulRuns}/${output.frontend.config.runs}`,
    `- Board ready p50: ${output.frontend.metrics.boardReadyMs.p50}ms`,
    `- Board ready p95: ${output.frontend.metrics.boardReadyMs.p95}ms`,
    `- Board ready p99: ${output.frontend.metrics.boardReadyMs.p99}ms`,
  ].join('\n');
}

async function runFromCli() {
  const result = await runPerformanceCapture();
  console.log(`Wrote ${result.artifactName}`);
  console.log(`JSON: ${result.outputPath}`);
  console.log(`Notes: ${result.runNotesPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runFromCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
