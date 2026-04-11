import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  AuthMeResponse,
  PublicWorkspaceInvitationLookup,
  PublicWorkspaceShareLinkLookup,
} from '@teamwork/types';
import type * as ApiClientModule from '@/lib/api/client';
import {
  acceptWorkspaceShareLinkByToken,
  getPublicWorkspaceInvitation,
  getPublicWorkspaceShareLink,
} from '@/lib/api/client';
import { PublicWorkspaceTokenPage } from '@/components/invitations/public-workspace-token-page';
import { useAuthSession } from '@/lib/auth/auth-session-provider';

const pushMock = jest.fn();
const replaceMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof ApiClientModule>('@/lib/api/client');

  return {
    ...actual,
    getPublicWorkspaceShareLink: jest.fn(),
    getPublicWorkspaceInvitation: jest.fn(),
    acceptWorkspaceShareLinkByToken: jest.fn(),
  };
});

jest.mock('@/lib/auth/auth-session-provider', () => ({
  useAuthSession: jest.fn(),
}));

const mockedGetPublicWorkspaceShareLink = jest.mocked(getPublicWorkspaceShareLink);
const mockedGetPublicWorkspaceInvitation = jest.mocked(getPublicWorkspaceInvitation);
const mockedAcceptWorkspaceShareLinkByToken = jest.mocked(acceptWorkspaceShareLinkByToken);
const mockedUseAuthSession = jest.mocked(useAuthSession);

const EMPTY_AUTH: AuthMeResponse = {
  user: {
    id: '',
    email: '',
    displayName: '',
    createdAt: '',
    updatedAt: '',
  },
  workspaces: [],
  activeWorkspace: null,
};

const SHARE_LINK_LOOKUP: PublicWorkspaceShareLinkLookup = {
  workspace: {
    id: 'workspace-2',
    name: 'Product Team',
    slug: 'product-team',
    createdByUserId: 'user-owner',
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  },
  status: 'active',
  shareLink: {
    id: 'share-link-1',
    workspaceId: 'workspace-2',
    role: 'member',
    expiresAt: '2026-05-10T00:00:00.000Z',
    revokedAt: null,
    lastUsedAt: null,
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  },
};

const INVITATION_LOOKUP: PublicWorkspaceInvitationLookup = {
  workspace: {
    id: 'workspace-1',
    name: 'Alpha Team',
    slug: 'alpha-team',
    createdByUserId: 'user-owner',
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  },
  status: 'pending',
  invitation: {
    id: 'invitation-1',
    workspaceId: 'workspace-1',
    role: 'member',
    expiresAt: '2026-05-10T00:00:00.000Z',
    createdAt: '2026-04-10T00:00:00.000Z',
    acceptedAt: null,
    revokedAt: null,
  },
};

describe('PublicWorkspaceTokenPage', () => {
  beforeEach(() => {
    mockedGetPublicWorkspaceShareLink.mockReset();
    mockedGetPublicWorkspaceInvitation.mockReset();
    mockedAcceptWorkspaceShareLinkByToken.mockReset();
    mockedUseAuthSession.mockReset();
    pushMock.mockReset();
    replaceMock.mockReset();
  });

  it('prompts unauthenticated users to sign in or create an account', async () => {
    const user = userEvent.setup();
    mockedGetPublicWorkspaceShareLink.mockResolvedValue(SHARE_LINK_LOOKUP);
    mockedUseAuthSession.mockReturnValue({
      status: 'unauthenticated',
      auth: EMPTY_AUTH,
      accessToken: null,
      errorMessage: null,
      refreshSession: jest.fn(),
      setAccessToken: jest.fn(),
      clearSession: jest.fn(),
    });

    render(<PublicWorkspaceTokenPage token="token-abc" source="share-link" />);

    await screen.findByRole('button', { name: 'Sign In To Join' });
    await user.click(screen.getByRole('button', { name: 'Sign In To Join' }));
    await user.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(pushMock).toHaveBeenNthCalledWith(1, '/auth-required?next=%2Fjoin%2Ftoken-abc');
    expect(pushMock).toHaveBeenNthCalledWith(2, '/sign-up?next=%2Fjoin%2Ftoken-abc');
  });

  it('lets authenticated users open an existing workspace immediately', async () => {
    const user = userEvent.setup();
    mockedGetPublicWorkspaceInvitation.mockResolvedValue(INVITATION_LOOKUP);
    mockedUseAuthSession.mockReturnValue({
      status: 'authenticated',
      auth: {
        user: {
          id: 'user-owner',
          email: 'owner@example.com',
          displayName: 'Owner',
          createdAt: '2026-04-10T00:00:00.000Z',
          updatedAt: '2026-04-10T00:00:00.000Z',
        },
        workspaces: [
          {
            ...INVITATION_LOOKUP.workspace,
            membership: {
              id: 'membership-1',
              workspaceId: 'workspace-1',
              userId: 'user-owner',
              role: 'member',
              createdAt: '2026-04-10T00:00:00.000Z',
            },
          },
        ],
        activeWorkspace: null,
      },
      accessToken: 'token-123',
      errorMessage: null,
      refreshSession: jest.fn(),
      setAccessToken: jest.fn(),
      clearSession: jest.fn(),
    });

    render(<PublicWorkspaceTokenPage token="invite-abc" source="invitation" />);
    await screen.findByRole('button', { name: 'Open Workspace' });
    await user.click(screen.getByRole('button', { name: 'Open Workspace' }));

    expect(pushMock).toHaveBeenCalledWith('/workspaces/workspace-1/board');
  });

  it('accepts an active share link and redirects after session refresh', async () => {
    const user = userEvent.setup();
    const refreshSession = jest.fn().mockResolvedValue({
      status: 'authenticated',
      auth: {
        user: {
          id: 'user-owner',
          email: 'owner@example.com',
          displayName: 'Owner',
          createdAt: '2026-04-10T00:00:00.000Z',
          updatedAt: '2026-04-10T00:00:00.000Z',
        },
        workspaces: [
          {
            ...SHARE_LINK_LOOKUP.workspace,
            membership: {
              id: 'membership-2',
              workspaceId: 'workspace-2',
              userId: 'user-owner',
              role: 'member',
              createdAt: '2026-04-10T00:00:00.000Z',
            },
          },
        ],
        activeWorkspace: null,
      },
      accessToken: 'token-123',
      errorMessage: null,
    });
    mockedGetPublicWorkspaceShareLink.mockResolvedValue(SHARE_LINK_LOOKUP);
    mockedAcceptWorkspaceShareLinkByToken.mockResolvedValue({
      membership: {
        id: 'membership-2',
        workspaceId: 'workspace-2',
        userId: 'user-owner',
        role: 'member',
        createdAt: '2026-04-10T00:00:00.000Z',
        user: {
          id: 'user-owner',
          email: 'owner@example.com',
          displayName: 'Owner',
          createdAt: '2026-04-10T00:00:00.000Z',
          updatedAt: '2026-04-10T00:00:00.000Z',
        },
      },
    });
    mockedUseAuthSession.mockReturnValue({
      status: 'authenticated',
      auth: {
        ...EMPTY_AUTH,
        user: {
          id: 'user-owner',
          email: 'owner@example.com',
          displayName: 'Owner',
          createdAt: '2026-04-10T00:00:00.000Z',
          updatedAt: '2026-04-10T00:00:00.000Z',
        },
      },
      accessToken: 'token-123',
      errorMessage: null,
      refreshSession,
      setAccessToken: jest.fn(),
      clearSession: jest.fn(),
    });

    render(<PublicWorkspaceTokenPage token="share-abc" source="share-link" />);
    await screen.findByRole('button', { name: 'Join Workspace' });
    await user.click(screen.getByRole('button', { name: 'Join Workspace' }));

    await waitFor(() => {
      expect(mockedAcceptWorkspaceShareLinkByToken).toHaveBeenCalledWith('share-abc', 'token-123');
    });
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/workspaces/workspace-2/board');
    });
  });
});
