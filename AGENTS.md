# AGENTS.md

## Project Overview
This repository contains TeamWork, a real-time collaboration platform built with Next.js, TypeScript, Tailwind CSS, a Node.js backend, Socket.IO, and PostgreSQL. The system supports multi-user workspaces, task management, structured notes, and synchronized state across clients.

## Objectives
Maintain a modular, predictable architecture and prioritize correctness, security, and consistency over speed of implementation. All changes must remain scoped, avoid unnecessary refactoring, and preserve real-time integrity across multiple users.

## Development Commands
Install dependencies with `pnpm install`.
Run all workspace apps with `pnpm dev`.
Build production artifacts with `pnpm build`.
Run linting with `pnpm lint`.
Execute tests with `pnpm test`.

## Engineering Standards
All code must use strict TypeScript. Avoid `any` unless justified. Prefer reuse of existing components and utilities. Keep functions small, composable, and clearly named. Follow the established folder structure and naming conventions. Do not introduce new dependencies without a clear technical reason.

## Architecture
Maintain clear separation of concerns. Route handlers and controllers are limited to request handling. Business logic belongs in services. Database access must remain isolated within the data layer. Do not mix UI logic with backend or domain logic. Keep modules isolated by domain, including authentication, workspaces, tasks, and collaboration.

## Frontend Guidelines
Use Tailwind CSS consistently and avoid inline styles unless required. Prevent unnecessary re-renders and maintain responsive, accessible UI. Follow existing server and client component patterns. Data fetching must not be embedded in deeply nested components.

## Backend Guidelines
Controllers must remain thin and delegate logic to services. All inputs must be validated at the boundary. Use consistent error handling patterns and do not break existing API contracts unless explicitly instructed.

## TypeScript Rules
Strict TypeScript must always be preserved. Do not introduce `any` unless explicitly justified. Prefer `unknown` with narrowing. Do not silence errors with `ts-ignore`. Do not hide type problems with broad casting. Handle `null` and `undefined` explicitly. Treat external input as `unknown` until validated. Do not weaken compiler settings to pass builds.

## API Response Rules
Never return raw database entities directly. Explicitly shape response payloads. Do not expose internal flags, hidden relations, or sensitive fields. Keep API contracts stable and predictable.

## Authorization Rules
Authorization must exist in the service layer, not just guards. Every resource access must verify ownership, membership, or role. Guards alone are not sufficient without service-level authorization checks.

## Realtime System
All socket events must validate payloads, verify user identity, and enforce workspace or project access. Client-emitted state must never be trusted. Events must only broadcast within authorized rooms. Avoid duplicate emissions and ensure operations are idempotent where possible.

## Database
Use PostgreSQL with a normalized schema. All database interactions must use parameterized queries or an ORM. Raw string-based SQL construction is not allowed. Schema changes require migrations and must preserve backward compatibility when possible. Ownership must be verified before any read or mutation.

## Data Integrity Rules
Database schema is the source of truth. Schema changes must use migrations. Multi-step business operations must use transactions when needed. Business invariants must never be broken, including: last owner cannot be removed, memberships must remain valid, invitation flows must remain consistent, and task/workspace relations must remain valid.

## Security Requirements
Authentication and authorization must never be bypassed. RBAC must be enforced across both API and WebSocket layers. User identity must always be derived from server-side context. Secrets, tokens, and credentials must never be hardcoded and must only be accessed through environment variables. Sensitive data must never be exposed to the client or logged.

These are implementation requirements and do not replace runtime enforcement, validation, middleware, tests, CI, or access controls.

## Realtime Consistency
The server is the source of truth. Optimistic updates are permitted only when rollback mechanisms are defined. Concurrent updates must be handled to prevent race conditions. Client state must converge consistently across all active users.

## Performance
Avoid unnecessary database queries and redundant socket emissions. Batch or debounce frequent updates where appropriate. Optimize rendering and avoid transmitting large payloads over real-time channels.

## Destructive Changes
Do not delete or overwrite significant portions of the codebase without explicit instruction. Do not modify the database schema without a migration strategy. Do not remove or weaken existing security mechanisms. Do not introduce breaking changes without clear justification.

## Logging
Log only what is necessary for debugging and observability. Sensitive user data must never be logged. Prefer structured logging.

## Planning
For changes that affect multiple modules, data flow, or real-time behavior, consult or create `PLANS.md` before implementation.

## Testing Requirements
All behavior changes must include tests or explicit verification. Do not claim completion without running lint, typecheck, and tests when applicable. Critical flows must be test-covered.

## Domain Constraints
Workspaces, projects, tasks, and memberships must be treated as separate domains with enforced boundaries. REST APIs are used for CRUD operations, while WebSockets are used for real-time synchronization. All collaboration logic must pass through the service layer. RBAC must be consistently enforced across both API and real-time systems.

## Codex Behavior
This repository uses Codex Skills located in `.agents/skills`.

Rules:

* Codex must check applicable skills before writing code
* If a skill applies, it must be followed strictly
* Skills override improvisation
* Skills are mandatory for:

  * TypeScript work
  * backend API work
  * Prisma/schema work
  * frontend architectural work
  * UI/readability work
  * realtime/socket work
  * final review before completion

Failure to follow applicable skills is incorrect execution.

## Completion Checklist
Before completing any task, ensure the code compiles without type errors, linting passes, inputs are validated, authentication and RBAC are enforced, no sensitive data is exposed, and all changes are clearly explained along with any risks or follow-up work.
