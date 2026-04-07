# TeamWork API

NestJS API for TeamWork authentication, workspaces, memberships, invitations, share links, and tasks.

## Local Development

Install dependencies:

```bash
pnpm install
```

Set `apps/api/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/teamwork
JWT_SECRET=change-me
APP_URL=http://localhost:3001
INVITE_BASE_URL=http://localhost:3001
PORT=3000
```

Optional settings:

```env
JWT_EXPIRES_IN=15m
INVITE_TTL_DAYS=30
SHARE_LINK_TTL_DAYS=14
CORS_ALLOWED_ORIGINS=http://localhost:3001
```

Run the API:

```bash
pnpm start:dev
```

## Deployment

Recommended:

- deploy `apps/api` to Railway, Render, or Fly.io
- run Prisma migrations against production Postgres during release
- set `APP_URL` and `INVITE_BASE_URL` to the deployed frontend URL
- set `CORS_ALLOWED_ORIGINS` to the frontend origin

## Verification

Before production rollout, verify:

- authentication works from the deployed frontend
- invitations and share links point to the deployed frontend URL
- task and workspace flows succeed against the hosted database
