import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  WorkspaceMemberDetail,
  WorkspaceSecurityDashboard,
  WorkspaceShareLinkSummary,
} from '@teamwork/types';
import type * as ApiClientModule from '@/lib/api/client';
import {
  disableWorkspaceShareLink,
  revokeAllWorkspaceInvitations,
  transferWorkspaceOwnership,
} from '@/lib/api/client';
import { WorkspaceSettingsPage } from '@/components/workspaces/workspace-settings-page';

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof ApiClientModule>('@/lib/api/client');

  return {
    ...actual,
    transferWorkspaceOwnership: jest.fn(),
    revokeAllWorkspaceInvitations: jest.fn(),
    disableWorkspaceShareLink: jest.fn(),
  };
});

const mockedTransferWorkspaceOwnership = jest.mocked(transferWorkspaceOwnership);
const mockedRevokeAllWorkspaceInvitations = jest.mocked(revokeAllWorkspaceInvitations);
const mockedDisableWorkspaceShareLink = jest.mocked(disableWorkspaceShareLink);

const MEMBERS: WorkspaceMemberDetail[] = [
  {
    id: 'membership-owner',
    workspaceId: 'workspace-1',
    userId: 'user-owner',
    role: 'owner',
    createdAt: '2026-04-11T00:00:00.000Z',
    user: {
      id: 'user-owner',
      email: 'owner@example.com',
      displayName: 'Owner User',
      createdAt: '2026-04-11T00:00:00.000Z',
      updatedAt: '2026-04-11T00:00:00.000Z',
    },
  },
  {
    id: 'membership-member',
    workspaceId: 'workspace-1',
    userId: 'user-member',
    role: 'member',
    createdAt: '2026-04-11T00:00:00.000Z',
    user: {
      id: 'user-member',
      email: 'member@example.com',
      displayName: 'Member User',
      createdAt: '2026-04-11T00:00:00.000Z',
      updatedAt: '2026-04-11T00:00:00.000Z',
    },
  },
];

const DASHBOARD: WorkspaceSecurityDashboard = {
  workspaceId: 'workspace-1',
  generatedAt: '2026-04-11T10:00:00.000Z',
  windowMinutes: 60,
  counters: {
    authFailures: 2,
    invitationFailures: 1,
    destructiveActions: 3,
    destructiveFailures: 0,
    authorizationFailures: 1,
  },
  alerts: [],
  recentEvents: [
    {
      id: 'event-1',
      category: 'auth',
      eventName: 'auth.login',
      outcome: 'failure',
      severity: 'warning',
      workspaceId: null,
      actorUserId: null,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      createdAt: '2026-04-11T10:00:00.000Z',
      details: {},
    },
  ],
};

const SHARE_LINK: WorkspaceShareLinkSummary = {
  id: 'share-link-1',
  workspaceId: 'workspace-1',
  role: 'member',
  createdByUserId: 'user-owner',
  expiresAt: '2026-04-30T00:00:00.000Z',
  revokedAt: null,
  lastUsedAt: null,
  createdAt: '2026-04-11T00:00:00.000Z',
  updatedAt: '2026-04-11T00:00:00.000Z',
  status: 'active',
  url: 'http://localhost:3000/join/token',
};

function renderSettingsPage() {
  return render(
    <WorkspaceSettingsPage
      workspaceId="workspace-1"
      currentUserId="user-owner"
      members={MEMBERS}
      pendingInvitationCount={3}
      shareLink={SHARE_LINK}
      dashboard={DASHBOARD}
      accessToken="token-123"
      onOwnershipTransferred={jest.fn().mockResolvedValue(undefined)}
    />, 
  );
}

describe('WorkspaceSettingsPage', () => {
  beforeEach(() => {
    mockedTransferWorkspaceOwnership.mockReset();
    mockedRevokeAllWorkspaceInvitations.mockReset();
    mockedDisableWorkspaceShareLink.mockReset();
  });

  it('transfers ownership through the new admin control', async () => {
    const user = userEvent.setup();
    const ownerMember = MEMBERS[0];
    const memberUser = MEMBERS[1];

    if (!ownerMember || !memberUser) {
      throw new Error('Expected fixture members to include owner and member.');
    }

    mockedTransferWorkspaceOwnership.mockResolvedValue({
      previousOwnerMembership: {
        ...ownerMember,
        role: 'member',
      },
      nextOwnerMembership: {
        ...memberUser,
        role: 'owner',
      },
    });

    renderSettingsPage();

    await user.selectOptions(screen.getByLabelText('Next owner'), 'user-member');
    await user.click(screen.getByRole('button', { name: 'Transfer Ownership' }));

    await waitFor(() => {
      expect(mockedTransferWorkspaceOwnership).toHaveBeenCalledWith(
        'workspace-1',
        'token-123',
        'user-member',
      );
    });

    expect(await screen.findByText('Ownership transferred to Member User.')).toBeInTheDocument();
  });

  it('runs governance bulk invitation revoke action', async () => {
    const user = userEvent.setup();
    mockedRevokeAllWorkspaceInvitations.mockResolvedValue({ revokedCount: 2 });

    renderSettingsPage();

    await user.click(screen.getByRole('button', { name: 'Revoke All Invitations' }));

    await waitFor(() => {
      expect(mockedRevokeAllWorkspaceInvitations).toHaveBeenCalledWith(
        'workspace-1',
        'token-123',
      );
    });

    expect(await screen.findByText('Revoked 2 pending invitation(s).')).toBeInTheDocument();
  });
});
