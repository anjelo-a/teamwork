import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as ApiClientModule from '@/lib/api/client';
import { ApiError, updateWorkspace } from '@/lib/api/client';
import { type AuthSessionResult, useAuthSession } from '@/lib/auth/auth-session-provider';
import { RenameWorkspaceDialog } from '@/components/workspaces/rename-workspace-dialog';

const mockRefreshSession = jest.fn<Promise<AuthSessionResult>, []>();
const mockedUpdateWorkspace = jest.mocked(updateWorkspace);
const mockedUseAuthSession = jest.mocked(useAuthSession);

jest.mock('@/lib/auth/auth-session-provider', () => ({
  useAuthSession: jest.fn(),
}));

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof ApiClientModule>('@/lib/api/client');

  return {
    ...actual,
    updateWorkspace: jest.fn(),
  };
});

describe('RenameWorkspaceDialog', () => {
  beforeEach(() => {
    mockedUpdateWorkspace.mockReset();
    mockRefreshSession.mockReset();
    mockRefreshSession.mockResolvedValue({
      status: 'authenticated',
      auth: {
        user: {
          id: 'user-1',
          email: 'owner@example.com',
          displayName: 'Owner',
          createdAt: '2026-04-09T00:00:00.000Z',
          updatedAt: '2026-04-09T00:00:00.000Z',
        },
        workspaces: [],
        activeWorkspace: null,
      },
      accessToken: 'token-123',
      errorMessage: null,
    });
    mockedUseAuthSession.mockReturnValue({
      status: 'authenticated',
      auth: {
        user: {
          id: 'user-1',
          email: 'owner@example.com',
          displayName: 'Owner',
          createdAt: '2026-04-09T00:00:00.000Z',
          updatedAt: '2026-04-09T00:00:00.000Z',
        },
        workspaces: [],
        activeWorkspace: null,
      },
      accessToken: 'token-123',
      errorMessage: null,
      refreshSession: mockRefreshSession,
      setAccessToken: jest.fn(),
      clearSession: jest.fn(),
    });
  });

  it('renames a workspace and refreshes session', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    mockedUpdateWorkspace.mockResolvedValue({
      workspace: {
        id: 'workspace-1',
        name: 'Renamed Workspace',
        slug: 'product-team',
        createdByUserId: 'user-1',
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
        memberCount: 1,
        invitationCount: 0,
        membership: {
          id: 'membership-1',
          workspaceId: 'workspace-1',
          userId: 'user-1',
          role: 'owner',
          createdAt: '2026-04-09T00:00:00.000Z',
        },
      },
    });

    render(
      <RenameWorkspaceDialog
        open
        workspaceId="workspace-1"
        workspaceName="Product Team"
        onClose={onClose}
      />,
    );

    const nameInput = screen.getByLabelText('Workspace name');
    await user.clear(nameInput);
    await user.type(nameInput, '  Renamed   Workspace  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockedUpdateWorkspace).toHaveBeenCalledWith('workspace-1', 'token-123', {
        name: 'Renamed Workspace',
      });
    });
    expect(mockRefreshSession).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error message when rename fails', async () => {
    const user = userEvent.setup();
    mockedUpdateWorkspace.mockRejectedValue(
      new ApiError('Only workspace owners can update workspace details.', 403),
    );

    render(
      <RenameWorkspaceDialog
        open
        workspaceId="workspace-1"
        workspaceName="Product Team"
        onClose={jest.fn()}
      />,
    );

    const nameInput = screen.getByLabelText('Workspace name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Workspace');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Only workspace owners can update workspace details.'),
    ).toBeInTheDocument();
  });
});
