import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

test('@smoke member management smoke', async ({ browser, page, request }) => {
  test.setTimeout(120000);

  const ownerEmail = createUniqueEmail('owner');
  const memberEmail = createUniqueEmail('member');
  const pendingInviteEmail = createUniqueEmail('pending-invite');
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

  const memberAccessToken = await loginUser(request, {
    email: memberEmail,
    password,
  });

  const invitationId = await readInvitationId(memberAccessToken, workspaceId);
  await acceptInvitation(invitationId, memberAccessToken);

  await page.goto(`/workspaces/${workspaceId}/invitations`);
  await page.getByRole('button', { name: 'Send Invite' }).click();
  await page.getByPlaceholder('member@example.com').fill(pendingInviteEmail);
  await page.getByRole('button', { name: 'Invite Member' }).click();
  await expect(page.getByText(`Invitation created for ${pendingInviteEmail}`)).toBeVisible();

  await page.goto(`/workspaces/${workspaceId}/settings`);
  await page.getByRole('button', { name: 'Revoke All Invitations' }).click();
  await expect(page.getByText('Revoked 1 pending invitation(s).')).toBeVisible();

  await page
    .getByLabel('Next owner')
    .selectOption(`${memberName} (${memberEmail})`);
  await page.getByRole('button', { name: 'Transfer Ownership' }).click();
  await expect(page.getByText(`Ownership transferred to ${memberName}.`)).toBeVisible();

  await page.goto(`/workspaces/${workspaceId}/invitations`);
  await expect(page.getByText('Owner access required')).toBeVisible();

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

async function loginUser(
  request: APIRequestContext,
  input: {
    email: string;
    password: string;
  },
): Promise<string> {
  const response = await request.post('http://localhost:3000/auth/login', {
    data: {
      email: input.email,
      password: input.password,
    },
  });

  expect(response.ok()).toBeTruthy();

  const data = (await response.json()) as { accessToken?: string };

  if (typeof data.accessToken !== 'string' || data.accessToken.length === 0) {
    throw new Error('Expected access token from login response.');
  }

  return data.accessToken;
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
