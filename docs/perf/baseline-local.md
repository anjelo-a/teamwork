# baseline / local Benchmark Snapshot

Captured at: 2026-04-09T13:54:05.841Z
API: http://127.0.0.1:3100
Web: http://127.0.0.1:3101

## Backend Endpoints

| Endpoint | p50 latency (ms) | p95 latency (ms) | p99 latency (ms) | req/s | error count |
| --- | ---: | ---: | ---: | ---: | ---: |
| GET /tasks | 25 | 39.33 | 55 | 735.7 | 0 |
| GET /workspaces/:workspaceId/tasks | 29 | 54.67 | 74 | 603.57 | 0 |
| PATCH /workspaces/:workspaceId/tasks/:taskId/status | 10 | 26.33 | 33 | 1709.27 | 0 |

## Frontend Board

- Successful runs: 10/10
- Board ready p50: 102.47ms
- Board ready p95: 195.22ms
- Board ready p99: 233.52ms
