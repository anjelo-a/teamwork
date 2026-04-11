import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserInvitationInboxItem } from '@teamwork/types';
import type * as ApiClientModule from '@/lib/api/client';
import { acceptWorkspaceInvitation } from '@/lib/api/client';
import { InvitationInboxPage } from '@/components/invitations/invitation-inbox-page';

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof ApiClientModule>('@/lib/api/client');

  return {
    ...actual,
    acceptWorkspaceInvitation: jest.fn(),
  };
});

const mockedAcceptWorkspaceInvitation = jest.mocked(acceptWorkspaceInvitation);

const INVITATION_ITEM: UserInvitationInboxItem = {
  invitation: {
    id: 'invitation-1',
    workspaceId: 'workspace-1',
    email: 'member@example.com',
    role: 'member',
    invitedByUserId: 'user-owner',
    expiresAt: '2026-05-10T00:00:00.000Z',
    createdAt: '2026-04-10T00:00:00.000Z',
    acceptedAt: null,
    revokedAt: null,
  },
  workspace: {
    id: 'workspace-1',
    name: 'Product Team',
    slug: 'product-team',
    createdByUserId: 'user-owner',
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  },
};

describe('InvitationInboxPage', () => {
  beforeEach(() => {
    mockedAcceptWorkspaceInvitation.mockReset();
  });

  it('accepts an invitation, removes it from the list, and triggers session refresh', async () => {
    const user = userEvent.setup();
    const refreshSession = jest.fn().mockResolvedValue({});
    mockedAcceptWorkspaceInvitation.mockResolvedValue({
      membership: {
        id: 'membership-1',
        workspaceId: 'workspace-1',
        userId: 'user-member',
        role: 'member',
        createdAt: '2026-04-10T00:00:00.000Z',
        user: {
          id: 'user-member',
          email: 'member@example.com',
          displayName: 'Member',
          createdAt: '2026-04-10T00:00:00.000Z',
          updatedAt: '2026-04-10T00:00:00.000Z',
        },
      },
    });

    render(
      <InvitationInboxPage
        invitations={[INVITATION_ITEM]}
        accessToken="token-123"
        refreshSession={refreshSession}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => {
      expect(mockedAcceptWorkspaceInvitation).toHaveBeenCalledWith('invitation-1', 'token-123');
    });
    await waitFor(() => {
      expect(refreshSession).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Invitation accepted for Product Team')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
  });

  it('shows a session error when access token is unavailable', async () => {
    const user = userEvent.setup();

    render(
      <InvitationInboxPage
        invitations={[INVITATION_ITEM]}
        accessToken={null}
        refreshSession={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(
      await screen.findByText('Your session is unavailable. Refresh the page and try again.'),
    ).toBeInTheDocument();
    expect(mockedAcceptWorkspaceInvitation).not.toHaveBeenCalled();
  });
});
