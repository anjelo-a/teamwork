import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WorkspaceInvitationSummary, WorkspaceShareLinkSummary } from '@teamwork/types';
import type * as ApiClientModule from '@/lib/api/client';
import {
  ApiError,
  disableWorkspaceShareLink,
  regenerateWorkspaceShareLink,
  revokeWorkspaceInvitation,
} from '@/lib/api/client';
import { InvitationsPage } from '@/components/invitations/invitations-page';

jest.mock('@/components/invitations/invite-member-modal', () => ({
  InviteMemberModal: () => null,
}));

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof ApiClientModule>('@/lib/api/client');

  return {
    ...actual,
    revokeWorkspaceInvitation: jest.fn(),
    regenerateWorkspaceShareLink: jest.fn(),
    disableWorkspaceShareLink: jest.fn(),
  };
});

const mockedRevokeWorkspaceInvitation = jest.mocked(revokeWorkspaceInvitation);
const mockedRegenerateWorkspaceShareLink = jest.mocked(regenerateWorkspaceShareLink);
const mockedDisableWorkspaceShareLink = jest.mocked(disableWorkspaceShareLink);

const BASE_INVITATION: WorkspaceInvitationSummary = {
  id: 'invitation-1',
  workspaceId: 'workspace-1',
  email: 'member@example.com',
  role: 'member',
  invitedByUserId: 'user-owner',
  expiresAt: '2026-05-10T00:00:00.000Z',
  createdAt: '2026-04-10T00:00:00.000Z',
  acceptedAt: null,
  revokedAt: null,
};

const BASE_SHARE_LINK: WorkspaceShareLinkSummary = {
  id: 'share-link-1',
  workspaceId: 'workspace-1',
  role: 'member',
  createdByUserId: 'user-owner',
  expiresAt: '2026-05-10T00:00:00.000Z',
  revokedAt: null,
  lastUsedAt: null,
  createdAt: '2026-04-10T00:00:00.000Z',
  updatedAt: '2026-04-10T00:00:00.000Z',
  status: 'active',
  url: 'http://127.0.0.1:3001/join/token-1',
};

describe('InvitationsPage', () => {
  beforeEach(() => {
    mockedRevokeWorkspaceInvitation.mockReset();
    mockedRegenerateWorkspaceShareLink.mockReset();
    mockedDisableWorkspaceShareLink.mockReset();
  });

  it('allows owners to revoke pending invitations', async () => {
    const user = userEvent.setup();
    mockedRevokeWorkspaceInvitation.mockResolvedValue({ invitation: BASE_INVITATION });

    render(
      <InvitationsPage
        workspaceId="workspace-1"
        invitations={[BASE_INVITATION]}
        workspaceShareLink={BASE_SHARE_LINK}
        currentUserRole="owner"
        accessToken="token-123"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel invitation for member@example.com' }));

    await waitFor(() => {
      expect(mockedRevokeWorkspaceInvitation).toHaveBeenCalledWith(
        'workspace-1',
        'invitation-1',
        'token-123',
      );
    });
    await waitFor(() => {
      expect(screen.queryByText('member@example.com')).not.toBeInTheDocument();
    });
  });

  it('hides owner-only invitation controls for non-owners', () => {
    render(
      <InvitationsPage
        workspaceId="workspace-1"
        invitations={[BASE_INVITATION]}
        workspaceShareLink={BASE_SHARE_LINK}
        currentUserRole="member"
        accessToken="token-123"
      />,
    );

    expect(screen.queryByRole('button', { name: 'Send Invite' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancel invitation for member@example.com' }),
    ).not.toBeInTheDocument();
  });

  it('shows share-link errors from regenerate requests', async () => {
    const user = userEvent.setup();
    mockedRegenerateWorkspaceShareLink.mockRejectedValue(
      new ApiError('Workspace share link could not be regenerated right now.', 500),
    );

    render(
      <InvitationsPage
        workspaceId="workspace-1"
        invitations={[BASE_INVITATION]}
        workspaceShareLink={BASE_SHARE_LINK}
        currentUserRole="owner"
        accessToken="token-123"
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Regenerate' }));

    expect(
      await screen.findByText('Workspace share link could not be regenerated right now.'),
    ).toBeInTheDocument();
  });
});
