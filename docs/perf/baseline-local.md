# baseline / local Benchmark Snapshot

Captured at: 2026-04-09T14:47:05.217Z
API: http://127.0.0.1:3100
Web: http://127.0.0.1:3101

## Backend Endpoints

| Endpoint | p50 latency (ms) | p95 latency (ms) | p99 latency (ms) | req/s | error count |
| --- | ---: | ---: | ---: | ---: | ---: |
| GET /tasks | 24 | 36 | 40 | 792.74 | 0 |
| GET /workspaces/:workspaceId/tasks | 27 | 47 | 56 | 677.77 | 0 |
| PATCH /workspaces/:workspaceId/tasks/:taskId/status | 10 | 25.33 | 32 | 1748.27 | 0 |

## Frontend Board

- Successful runs: 10/10
- Board ready p50: 118.74ms
- Board ready p95: 191.08ms
- Board ready p99: 226.65ms
