import { expect, test, type APIRequestContext } from '@playwright/test';

test('@smoke workspace deletion smoke', async ({ page, request }) => {
  test.setTimeout(120000);

  const ownerEmail = createUniqueEmail('workspace-delete');
  const password = 'Passw0rd!';
  const accessToken = await registerUser(request, {
    name: 'Workspace Owner',
    email: ownerEmail,
    password,
  });

  await page.context().clearCookies();
  await page.addInitScript((token: string) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('teamwork.accessToken', token);
  }, accessToken);
  await page.goto('/');

  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/board$/, { timeout: 30000 });
  await page.getByTestId('delete-workspace-trigger').click();
  await expect(page.getByRole('dialog', { name: 'Delete workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Workspace' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByText('No workspaces available')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create workspace' })).toBeVisible();
});

async function registerUser(
  request: APIRequestContext,
  input: {
    name: string;
    email: string;
    password: string;
  },
) {
  const response = await request.post('http://localhost:3000/auth/register', {
    data: {
      displayName: input.name,
      email: input.email,
      password: input.password,
    },
  });

  expect(response.ok()).toBeTruthy();

  const data = (await response.json()) as { accessToken?: string };

  if (typeof data.accessToken !== 'string' || data.accessToken.length === 0) {
    throw new Error('Expected access token from register response.');
  }

  return data.accessToken;
}

function createUniqueEmail(prefix: string): string {
  const suffix = `${String(Date.now())}-${Math.random().toString(16).slice(2, 8)}`;

  return `${prefix}-${suffix}@example.com`;
}
