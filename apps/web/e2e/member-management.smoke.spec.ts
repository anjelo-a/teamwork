import { expect, test, type Page } from '@playwright/test';

test('@smoke member management smoke', async ({ browser, page }) => {
  test.setTimeout(120000);

  const ownerEmail = createUniqueEmail('owner');
  const memberEmail = createUniqueEmail('member');
  const password = 'Passw0rd!';
  const ownerName = 'Owner Smoke';
  const memberName = 'Member Smoke';
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();

  await page.goto('/sign-up');
  await completeSignUp(page, {
    name: ownerName,
    email: ownerEmail,
    password,
  });

  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/board$/);

  const workspaceUrl = new URL(page.url());
  const workspaceId = workspaceUrl.pathname.split('/')[2];

  if (!workspaceId) {
    throw new Error('Expected workspace id in board URL.');
  }

  await memberPage.goto('/sign-up');
  await completeSignUp(memberPage, {
    name: memberName,
    email: memberEmail,
    password,
  });
  await expect(memberPage).toHaveURL(/\/workspaces\/[^/]+\/board$/);

  await page.goto(`/workspaces/${workspaceId}/invitations`);
  await page.getByRole('button', { name: 'Send Invite' }).click();
  await page.getByPlaceholder('member@example.com').fill(memberEmail);
  await page.getByRole('button', { name: 'Invite Member' }).click();
  await expect(page.getByText(`Invitation created for ${memberEmail}`)).toBeVisible();

  await expect
    .poll(
      () => memberPage.evaluate(() => window.localStorage.getItem('teamwork.accessToken')),
      { timeout: 10000 },
    )
    .not.toBeNull();

  const memberAccessToken = await memberPage.evaluate(() =>
    window.localStorage.getItem('teamwork.accessToken'),
  );

  if (!memberAccessToken) {
    throw new Error('Expected member access token after sign-up.');
  }

  const invitationId = await readInvitationId(memberAccessToken, workspaceId);
  await acceptInvitation(invitationId, memberAccessToken);

  await page.goto(`/workspaces/${workspaceId}/members`);

  const memberRow = page.locator('[data-testid^="member-row-"]').filter({ hasText: memberEmail });
  await expect(memberRow).toContainText(memberEmail);
  await memberRow.getByRole('button', { name: 'Remove' }).click();
  await page.getByRole('button', { name: 'Remove Member' }).click();

  await expect(page.locator('[data-testid^="member-row-"]').filter({ hasText: memberEmail })).toHaveCount(0);

  await memberContext.close();
});

async function completeSignUp(
  page: Page,
  input: {
    name: string;
    email: string;
    password: string;
  },
) {
  const nameField = page.getByPlaceholder('Your full name');

  await expect(nameField).toBeVisible({ timeout: 30000 });
  await nameField.fill(input.name);
  await page.getByPlaceholder('you@example.com').fill(input.email);
  await page.getByPlaceholder('Create a password').fill(input.password);
  await page.getByPlaceholder('Confirm your password').fill(input.password);
  await page.getByRole('button', { name: 'Create account' }).click();
}

function createUniqueEmail(prefix: string): string {
  const suffix = `${String(Date.now())}-${Math.random().toString(16).slice(2, 8)}`;

  return `${prefix}-${suffix}@example.com`;
}

async function readInvitationId(accessToken: string, workspaceId: string): Promise<string> {
  const response = await fetch('http://localhost:3000/users/me/invitations', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Expected invitation inbox response, received ${String(response.status)}.`);
  }

  const data = (await response.json()) as {
    invitations?: Array<{
      invitation?: { id?: string };
      workspace?: { id?: string };
    }>;
  };
  const invitation = data.invitations?.find(
    (item) => item.workspace?.id === workspaceId && typeof item.invitation?.id === 'string',
  );

  if (!invitation?.invitation?.id) {
    throw new Error(`Expected invitation for workspace ${workspaceId}.`);
  }

  return invitation.invitation.id;
}

async function acceptInvitation(invitationId: string, accessToken: string): Promise<void> {
  const response = await fetch(
    `http://localhost:3000/workspaces/invitations/${invitationId}/accept`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Expected invitation accept response, received ${String(response.status)}.`);
  }
}
