import { spawnSync } from 'node:child_process';

const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

if (!shadowDatabaseUrl) {
  console.error('SHADOW_DATABASE_URL is required for prisma migrate diff drift checks.');
  process.exit(1);
}

const result = spawnSync(
  'pnpm',
  [
    'exec',
    'prisma',
    'migrate',
    'diff',
    '--from-migrations',
    'prisma/migrations',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--shadow-database-url',
    shadowDatabaseUrl,
    '--exit-code',
  ],
  {
    stdio: 'inherit',
    env: process.env,
  },
);

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
