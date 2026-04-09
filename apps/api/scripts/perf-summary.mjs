import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolvePerfArtifactPath, round, writeMarkdownArtifact } from './perf-utils.mjs';

const COMPARISON_TARGETS = [
  { runLabel: 'baseline', envLabel: 'local' },
  { runLabel: 'baseline', envLabel: 'deployed' },
  { runLabel: 'after', envLabel: 'local' },
  { runLabel: 'after', envLabel: 'deployed' },
];

export async function generatePerfSummary() {
  const artifacts = await loadArtifacts();
  const summary = buildSummaryMarkdown(artifacts);
  const outputPath = await writeMarkdownArtifact('summary.md', summary);
  return { outputPath, summary };
}

async function loadArtifacts() {
  const output = {};

  for (const target of COMPARISON_TARGETS) {
    const key = `${target.runLabel}-${target.envLabel}`;
    output[key] = await readArtifact(`${key}.json`);
  }

  return output;
}

async function readArtifact(fileName) {
  const path = resolvePerfArtifactPath(fileName);

  try {
    const value = await fs.readFile(path, 'utf8');
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildSummaryMarkdown(artifacts) {
  const localComparison = buildComparison(artifacts['baseline-local'], artifacts['after-local']);
  const deployedComparison = buildComparison(
    artifacts['baseline-deployed'],
    artifacts['after-deployed'],
  );

  return [
    '# Performance Summary',
    '',
    'This report compares baseline and after captures for local and deployed environments.',
    '',
    '## Local Delta',
    '',
    ...renderComparison(localComparison),
    '',
    '## Deployed Delta',
    '',
    ...renderComparison(deployedComparison),
    '',
    '## Resume Bullet Drafts',
    '',
    ...buildResumeBullets(localComparison, deployedComparison),
    '',
    '## Required Artifacts',
    '',
    '- baseline-local.json',
    '- baseline-deployed.json',
    '- after-local.json',
    '- after-deployed.json',
  ].join('\n');
}

function buildComparison(baseline, after) {
  if (!isCompleteArtifact(baseline) || !isCompleteArtifact(after)) {
    return {
      complete: false,
      reason:
        'Missing one or both artifacts. Run `pnpm perf:run` for both baseline and after captures before generating summary.',
    };
  }

  const backendRows = [];
  const baselineEndpoints = toEndpointMap(baseline.backend?.endpoints ?? []);
  const afterEndpoints = toEndpointMap(after.backend?.endpoints ?? []);
  const endpointIds = new Set([...Object.keys(baselineEndpoints), ...Object.keys(afterEndpoints)]);

  for (const endpointId of endpointIds) {
    const before = baselineEndpoints[endpointId];
    const now = afterEndpoints[endpointId];
    if (!before || !now) {
      continue;
    }

    backendRows.push({
      endpoint: before.label,
      p50DeltaMs: delta(now.latencyMs?.p50, before.latencyMs?.p50),
      p95DeltaMs: delta(now.latencyMs?.p95, before.latencyMs?.p95),
      p99DeltaMs: delta(now.latencyMs?.p99, before.latencyMs?.p99),
      reqPerSecDelta: delta(now.requestsPerSecond, before.requestsPerSecond),
      p95DeltaPercent: deltaPercent(now.latencyMs?.p95, before.latencyMs?.p95),
    });
  }

  const frontend = {
    p50DeltaMs: delta(
      after.frontend?.metrics?.boardReadyMs?.p50,
      baseline.frontend?.metrics?.boardReadyMs?.p50,
    ),
    p95DeltaMs: delta(
      after.frontend?.metrics?.boardReadyMs?.p95,
      baseline.frontend?.metrics?.boardReadyMs?.p95,
    ),
    p99DeltaMs: delta(
      after.frontend?.metrics?.boardReadyMs?.p99,
      baseline.frontend?.metrics?.boardReadyMs?.p99,
    ),
    p95DeltaPercent: deltaPercent(
      after.frontend?.metrics?.boardReadyMs?.p95,
      baseline.frontend?.metrics?.boardReadyMs?.p95,
    ),
  };

  return {
    complete: true,
    backendRows,
    frontend,
    baselineCapturedAt: baseline.capturedAt,
    afterCapturedAt: after.capturedAt,
  };
}

function toEndpointMap(endpoints) {
  const entries = {};

  for (const endpoint of endpoints) {
    if (endpoint && typeof endpoint.id === 'string') {
      entries[endpoint.id] = endpoint;
    }
  }

  return entries;
}

function isCompleteArtifact(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    value.backend &&
    Array.isArray(value.backend.endpoints) &&
    value.frontend &&
    value.frontend.metrics &&
    value.frontend.metrics.boardReadyMs,
  );
}

function renderComparison(comparison) {
  if (!comparison.complete) {
    return [`- ${comparison.reason}`];
  }

  const rows = comparison.backendRows
    .map((row) => {
      return `| ${row.endpoint} | ${formatSigned(row.p50DeltaMs)} | ${formatSigned(row.p95DeltaMs)} | ${formatSigned(row.p99DeltaMs)} | ${formatSigned(row.reqPerSecDelta)} | ${formatSignedPercent(row.p95DeltaPercent)} |`;
    })
    .join('\n');

  return [
    `- Baseline capture: ${comparison.baselineCapturedAt}`,
    `- After capture: ${comparison.afterCapturedAt}`,
    '',
    '| Endpoint | Δ p50 ms | Δ p95 ms | Δ p99 ms | Δ req/s | p95 change |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    rows || '| (no endpoint overlap) | 0 | 0 | 0 | 0 | 0% |',
    '',
    `- Frontend board ready Δ p50: ${formatSigned(comparison.frontend.p50DeltaMs)}ms`,
    `- Frontend board ready Δ p95: ${formatSigned(comparison.frontend.p95DeltaMs)}ms`,
    `- Frontend board ready Δ p99: ${formatSigned(comparison.frontend.p99DeltaMs)}ms`,
    `- Frontend board ready p95 change: ${formatSignedPercent(comparison.frontend.p95DeltaPercent)}`,
  ];
}

function buildResumeBullets(localComparison, deployedComparison) {
  if (!localComparison.complete || !deployedComparison.complete) {
    return [
      '- Resume bullets are generated after all four artifacts exist (baseline/after x local/deployed).',
    ];
  }

  const localFrontend = localComparison.frontend.p95DeltaPercent;
  const deployedFrontend = deployedComparison.frontend.p95DeltaPercent;
  const deployedTaskInbox = findEndpointDelta(deployedComparison.backendRows, 'GET /tasks');
  const deployedWorkspaceTasks = findEndpointDelta(
    deployedComparison.backendRows,
    'GET /workspaces/:workspaceId/tasks',
  );

  const bullets = [
    `- Built a repeatable performance benchmarking workflow (NestJS + Next.js + Playwright + autocannon) that tracks baseline vs after metrics across local and deployed environments.`,
    `- Board page load p95 ${describeLatencyDelta(localFrontend)} (local) and ${describeLatencyDelta(deployedFrontend)} (deployed) using deterministic, script-driven runs.`,
  ];

  if (deployedTaskInbox) {
    bullets.push(
      `- Deployed p95 latency for task inbox endpoint ${describeLatencyDelta(
        deployedTaskInbox.p95DeltaPercent,
      )} while preserving endpoint correctness under concurrent load.`,
    );
  }

  if (deployedWorkspaceTasks) {
    bullets.push(
      `- Deployed p95 latency for workspace task listing ${describeLatencyDelta(
        deployedWorkspaceTasks.p95DeltaPercent,
      )} with quantified before/after evidence.`,
    );
  }

  return bullets;
}

function findEndpointDelta(rows, endpointLabel) {
  return rows.find((row) => row.endpoint === endpointLabel) ?? null;
}

function delta(current, baseline) {
  const left = typeof current === 'number' ? current : 0;
  const right = typeof baseline === 'number' ? baseline : 0;
  return round(left - right);
}

function deltaPercent(current, baseline) {
  const left = typeof current === 'number' ? current : 0;
  const right = typeof baseline === 'number' ? baseline : 0;

  if (right === 0) {
    return 0;
  }

  return round(((left - right) / right) * 100);
}

function formatSigned(value) {
  if (value > 0) {
    return `+${round(value)}`;
  }

  return `${round(value)}`;
}

function formatSignedPercent(value) {
  if (value > 0) {
    return `+${round(value)}%`;
  }

  return `${round(value)}%`;
}

function describeLatencyDelta(percentDelta) {
  if (percentDelta < 0) {
    return `reduced by ${Math.abs(round(percentDelta))}%`;
  }

  if (percentDelta > 0) {
    return `increased by +${Math.abs(round(percentDelta))}% (regression)`;
  }

  return 'showed no meaningful change';
}

async function runFromCli() {
  const result = await generatePerfSummary();
  console.log(`Summary written to ${result.outputPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runFromCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
