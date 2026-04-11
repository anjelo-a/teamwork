# Release Runbook

This runbook is the release gate for TeamWork deployments.

## Objective

Fail fast before deployment if any of these regress:

- lint
- typecheck
- production build
- Prisma migration integrity (apply + status + drift)

## One-Click Reproducible Gate

From the repository root:

```bash
pnpm release:gate
```

`pnpm release:gate` runs:

1. `pnpm --filter @teamwork/api prisma:release:check`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm build:prod`

## Required Environment Variables

`prisma:release:check` requires both:

- `DATABASE_URL`
- `SHADOW_DATABASE_URL`

Recommended shape:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/teamwork?schema=public
SHADOW_DATABASE_URL=postgresql://<user>:<password>@<host>:5432/teamwork_shadow?schema=public
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

## CI Gate

GitHub Actions workflow: `.github/workflows/ci.yml`

It enforces deterministic release checks by:

1. Installing with `pnpm install --frozen-lockfile`
2. Provisioning CI Postgres databases (`teamwork_ci`, `teamwork_ci_shadow`)
3. Running `pnpm release:gate`

Any failure blocks merges/deploy readiness.

## Deployment Sequence

1. Run `pnpm release:gate` locally (or in a release candidate branch CI run).
2. Deploy API.
3. Deploy web app with `NEXT_PUBLIC_API_BASE_URL` pointing to API.
4. Smoke test critical flows:
   - sign-up/sign-in/sign-out
   - workspace creation
   - invitations and share-link joins
   - task create/update/delete

## Validation Log

Validated once end-to-end on **April 11, 2026** using an isolated temporary Postgres instance on port `55432`:

- `pnpm release:gate` completed successfully
- Prisma checks passed:
  - `prisma validate`
  - `prisma generate`
  - `prisma migrate deploy`
  - `prisma migrate status`
  - `prisma migrate diff --exit-code` (no drift)
- Root checks passed:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm build:prod`
