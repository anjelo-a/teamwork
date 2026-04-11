# Phase 5 Policy/Architecture Maturity

Date: 2026-04-11

## Scope

This phase hardens post-MVP authorization architecture and owner-admin controls by:

- centralizing workspace authorization policy checks
- completing owner-facing governance workflows
- shipping live security telemetry dashboards and alert thresholds

## Implemented Changes

### 1. Centralized policy layer for workspace authorization

- Added `WorkspacePolicyService` (`apps/api/src/common/policy/workspace-policy.service.ts`) as the shared source of truth for workspace authorization decisions.
- Added `WorkspacePolicyGuard` + `@WorkspacePolicy(...)` metadata to apply policy actions at controller boundaries.
- Updated workspace admin endpoints to use policy actions instead of role checks embedded in each handler.
- Updated service-layer checks to call policy methods for:
  - owner-only workspace updates/deletes
  - cross-member removal authorization
  - ownership transfer constraints

### 2. Owner admin surfaces and workflows

- Added owner ownership-transfer API flow:
  - `POST /workspaces/:workspaceId/ownership/transfer`
- Added bulk invitation governance API flow:
  - `POST /workspaces/:workspaceId/invitations/revoke-all`
- Added owner security dashboard API flow:
  - `GET /workspaces/:workspaceId/security-dashboard`
- Added web owner settings page:
  - `/workspaces/[workspaceId]/settings`
  - ownership transfer controls
  - governance actions (revoke all invitations, disable share link)
  - live security telemetry counters, alerts, and recent events table
- Added sidebar route for owner administration entrypoint.

### 3. Auth/invitation/destructive telemetry and alerting

- Added centralized `SecurityTelemetryService` with:
  - structured event ingestion
  - in-memory recent event retention for live dashboarding
  - alert threshold evaluation per window
- Telemetry now records auth events (`register`, `login`, `refresh`, `logout`, `logout-all`).
- Invitation misuse telemetry now flows through centralized service for lookup/accept failure/success events.
- Destructive/admin telemetry added for:
  - workspace delete
  - ownership transfer
  - member removal
  - invitation revoke + revoke-all
  - share-link disable
  - task delete
- Dashboard currently evaluates actionable thresholds for:
  - elevated auth failures
  - invitation misuse spikes
  - repeated destructive-action failures

## Verification Evidence

Executed checks:

- `pnpm --filter @teamwork/api typecheck`
- `pnpm --filter @teamwork/web typecheck`
- `pnpm --filter @teamwork/api test -- common/auth/workspace-role.guard.spec.ts common/policy/workspace-policy.guard.spec.ts workspaces/workspaces.controller.spec.ts workspaces/workspaces.service.spec.ts memberships/memberships.service.spec.ts auth/auth.service.spec.ts workspace-invitations/workspace-invitations.service.spec.ts tasks/tasks.service.spec.ts workspaces/workspaces.dto.spec.ts`
- `pnpm --filter @teamwork/web test -- components/workspaces/workspace-settings-page.spec.tsx components/app-shell/sidebar.spec.tsx components/members/members-page.spec.tsx`

Result:

- API typecheck: pass
- Web typecheck: pass
- Targeted API policy/telemetry/admin tests: pass (146 tests)
- Targeted web settings/sidebar/members tests: pass (10 tests)

## Exit Criteria Status

- [x] Policy rules centralized in a dedicated authorization layer
- [x] Owner admin surfaces complete for ownership/governance workflows
- [x] Actionable telemetry dashboard and alerting logic live for auth, invitation misuse, and destructive actions
