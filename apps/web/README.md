# TeamWork Web

Next.js frontend for the TeamWork workspace collaboration app.

## Local Development

Set `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

Run the app:

```bash
pnpm dev
```

The web app runs on `http://localhost:3001` by default.

## Deployment

Recommended:

- deploy `apps/web` to Vercel
- set `NEXT_PUBLIC_API_BASE_URL` to the hosted API origin
- point the API's `APP_URL` and `INVITE_BASE_URL` back to the deployed Vercel URL

## Verification

Before production rollout, verify:

- sign-in and sign-up flows
- workspace board loads
- invitation inbox and join flows work
- task CRUD works against the hosted API
