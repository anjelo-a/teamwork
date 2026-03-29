# TeamWork

TeamWork is a TypeScript monorepo for a workspace collaboration app. The current codebase includes a NestJS API for authentication, workspaces, memberships, invitations, and tasks, plus a Next.js web app and shared packages for domain types and validation utilities.

## Project Overview

This repository is organized around a simple multi-workspace collaboration model:

- users can register and log in with JWT-based authentication
- each user can create and belong to one or more workspaces
- workspace owners can invite members and manage roles
- members can create, assign, update, and delete tasks inside a workspace
- shared packages keep API contracts and normalization rules consistent across apps

At the moment, the backend is the most complete part of the system. The web app is scaffolded and ready to grow into the primary client for the API.

## Tech Stack

### Monorepo and Tooling

- `pnpm` workspaces
- TypeScript
- ESLint
- Prettier

### Frontend

- Next.js 16
- React 19
- Tailwind CSS 4

### Backend

- NestJS 11
- Prisma ORM
- PostgreSQL
- Passport JWT authentication
- `class-validator` and `class-transformer` for request validation
- NestJS Throttler for rate limiting

### Shared Packages

- `@teamwork/types` for shared domain types and response shapes
- `@teamwork/validation` for shared normalization helpers and input constraints

### Testing

- Jest
- Supertest

## Workspace Layout

- `apps/web` - Next.js frontend
- `apps/api` - NestJS API
- `packages/types` - shared TypeScript types
- `packages/validation` - shared validation constants and helpers
- `AGENTS.md` - project guidance for AI-assisted development
- `PLANS.md` - planning template for larger changes

## Backend Domain Areas

The API is currently split into focused modules:

- `auth` - registration, login, and current-user lookup
- `workspaces` - workspace creation and workspace detail views
- `memberships` - member listing, role updates, and removal rules
- `workspace-invitations` - pending invitations, invite acceptance, and revocation
- `tasks` - task CRUD, status updates, and assignee updates
- `prisma` - database access layer
- `common` - guards, decorators, auth helpers, and shared interfaces

## Data Model

The PostgreSQL schema currently centers on these entities:

- `User`
- `Workspace`
- `WorkspaceMembership`
- `WorkspaceInvitation`
- `Task`

Key enums:

- `WorkspaceRole`: `owner`, `member`
- `TaskStatus`: `todo`, `in_progress`, `done`

## Local Development

### Prerequisites

- Node.js
- pnpm
- PostgreSQL

### Install dependencies

```bash
pnpm install
```

### Configure the API

The API reads its environment from `apps/api/.env`. At minimum, set:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/teamwork
JWT_SECRET=change-me
PORT=3001
```

Using `PORT=3001` is recommended so the API does not conflict with the Next.js app on `3000`.

### Start the apps

Run both apps from the repo root:

```bash
pnpm dev
```

Or run them individually:

```bash
pnpm --filter @teamwork/api start:dev
pnpm --filter @teamwork/web dev
```

## Common Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## Security

Do not commit `.env` files or real credentials. Keep secrets local for development and use your deployment platform's secret store in hosted environments.
