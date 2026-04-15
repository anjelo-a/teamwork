# Performance Benchmarks

This directory stores benchmark captures used for resume-ready performance evidence.

## Artifact Files

- `baseline-local.json`
- `baseline-deployed.json`
- `after-local.json`
- `after-deployed.json`
- `summary.md`

## Capture Commands

Start local benchmark servers first (recommended):

```bash
# API (high throttle limit for benchmark traffic)
cd apps/api
THROTTLE_LIMIT=100000 THROTTLE_TTL_MS=60000 PORT=3000 pnpm start:dev

# Web (production mode to avoid dev HMR noise)
cd apps/web
pnpm build
pnpm start -- --port 3001
```

Then run captures from repo root:

```bash
# Baseline local
RUN_LABEL=baseline ENV_LABEL=local API_BASE_URL=http://127.0.0.1:3000 WEB_BASE_URL=http://127.0.0.1:3001 pnpm perf:run

# Baseline deployed
RUN_LABEL=baseline ENV_LABEL=deployed API_BASE_URL=https://api.example.com WEB_BASE_URL=https://app.example.com pnpm perf:run

# After local
RUN_LABEL=after ENV_LABEL=local API_BASE_URL=http://127.0.0.1:3000 WEB_BASE_URL=http://127.0.0.1:3001 pnpm perf:run

# After deployed
RUN_LABEL=after ENV_LABEL=deployed API_BASE_URL=https://api.example.com WEB_BASE_URL=https://app.example.com pnpm perf:run
```

Generate the cross-run report:

```bash
pnpm perf:summary
```

## Configurable Environment Variables

- `API_BASE_URL` (default `http://127.0.0.1:3000`)
- `WEB_BASE_URL` (default `http://127.0.0.1:3001`)
- `BENCH_EMAIL` (default `bench.user@teamwork.local`)
- `BENCH_PASSWORD` (default `TeamworkBench123!`)
- `BENCH_DISPLAY_NAME` (default `Bench User`)
- `BENCH_WORKSPACE_NAME` (default `TeamWork Benchmark Workspace`)
- `BENCH_TASK_COUNT` (default `200`)
- `BENCH_TASK_PREFIX` (default `[bench]`)
- `THROTTLE_LIMIT` (default `500` in dev/test, `20` in production)
- `THROTTLE_TTL_MS` (default `60000`)
- `BACKEND_CONNECTIONS` (default `1`)
- `BACKEND_DURATION_SECONDS` (default `30`)
- `BACKEND_WARMUP_SECONDS` (default `5`)
- `BACKEND_REQUEST_TIMEOUT_SECONDS` (default `60`)
- `FRONTEND_RUNS` (default `10`)
- `FRONTEND_TIMEOUT_MS` (default `90000`)
