import { defineConfig } from '@playwright/test';

const isCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  fullyParallel: false,
  ...(isCI ? { workers: 1 } : {}),
  retries: isCI ? 1 : 0,
  reporter: isCI
    ? [['list'], ['junit', { outputFile: 'test-results/playwright/junit.xml' }]]
    : 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --dir ../api start:dev',
      url: 'http://localhost:3000/',
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: 'NEXT_PUBLIC_API_BASE_URL=http://localhost:3000 pnpm dev',
      url: 'http://localhost:3001',
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
