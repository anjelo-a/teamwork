import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthMeResponse } from '@teamwork/types';
import type * as ApiClientModule from '@/lib/api/client';
import { ApiError, deleteWorkspace, getAuthMe } from '@/lib/api/client';
import { DeleteWorkspaceDialog } from '@/components/workspaces/delete-workspace-dialog';
import { useAuthSession } from '@/lib/auth/auth-session-provider';

const mockReplace = jest.fn();
const mockRefreshSession = jest.fn<Promise<void>, []>();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

jest.mock('@/lib/auth/auth-session-provider', () => ({
  useAuthSession: jest.fn(),
}));

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof ApiClientModule>('@/lib/api/client');

  return {
    ...actual,
    deleteWorkspace: jest.fn(),
    getAuthMe: jest.fn(),
  };
});

const mockedUseAuthSession = jest.mocked(useAuthSession);
const mockedDeleteWorkspace = jest.mocked(deleteWorkspace);
const mockedGetAuthMe = jest.mocked(getAuthMe);

function createSession(workspaces: AuthMeResponse['workspaces'] = []): ReturnType<typeof useAuthSession> {
  return {
    status: 'authenticated',
    auth: {
      user: {
        id: 'user-1',
        email: 'owner@example.com',
        displayName: 'Owner',
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
      },
      workspaces,
      activeWorkspace: workspaces[0] ?? null,
    },
    accessToken: 'token-123',
    errorMessage: null,
    refreshSession: mockRefreshSession,
    setAccessToken: jest.fn(),
    clearSession: jest.fn(),
  };
}

function renderDialog() {
  return render(
    <DeleteWorkspaceDialog
      open
      workspaceId="workspace-1"
      workspaceName="Product Team"
      onClose={jest.fn()}
    />,
  );
}

function createDeferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

describe('DeleteWorkspaceDialog', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockRefreshSession.mockReset();
    mockRefreshSession.mockResolvedValue();
    mockedDeleteWorkspace.mockReset();
    mockedGetAuthMe.mockReset();
    mockedUseAuthSession.mockReturnValue(createSession());
  });

  it('shows the confirmation copy', () => {
    renderDialog();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Product Team and remove all workspace data?')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This permanently removes the workspace, its members, invitations, share links, and tasks.',
      ),
    ).toBeInTheDocument();
  });

  it('deletes the workspace and redirects to the remaining workspace', async () => {
    const user = userEvent.setup();
    mockedDeleteWorkspace.mockResolvedValue({ success: true });
    mockedGetAuthMe.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'owner@example.com',
        displayName: 'Owner',
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
      },
      workspaces: [
        {
          id: 'workspace-2',
          name: 'Remaining Workspace',
          slug: 'remaining-workspace',
          createdByUserId: 'user-1',
          createdAt: '2026-04-09T00:00:00.000Z',
          updatedAt: '2026-04-09T00:00:00.000Z',
          membership: {
            id: 'membership-2',
            workspaceId: 'workspace-2',
            userId: 'user-1',
            role: 'owner',
            createdAt: '2026-04-09T00:00:00.000Z',
          },
        },
      ],
      activeWorkspace: {
        id: 'workspace-2',
        name: 'Remaining Workspace',
        slug: 'remaining-workspace',
        createdByUserId: 'user-1',
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
        membership: {
          id: 'membership-2',
          workspaceId: 'workspace-2',
          userId: 'user-1',
          role: 'owner',
          createdAt: '2026-04-09T00:00:00.000Z',
        },
      },
    });

    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Delete Workspace' }));

    await waitFor(() => {
      expect(mockedDeleteWorkspace).toHaveBeenCalledWith('workspace-1', 'token-123');
      expect(mockedGetAuthMe).toHaveBeenCalledWith('token-123');
      expect(mockRefreshSession).toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('/workspaces/workspace-2/board');
    });
  });

  it('redirects to the home route when no workspaces remain', async () => {
    const user = userEvent.setup();
    mockedDeleteWorkspace.mockResolvedValue({ success: true });
    mockedGetAuthMe.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'owner@example.com',
        displayName: 'Owner',
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
      },
      workspaces: [],
      activeWorkspace: null,
    });

    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Delete Workspace' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('keeps the dialog open and shows the error when deletion fails', async () => {
    const user = userEvent.setup();
    mockedDeleteWorkspace.mockRejectedValue(
      new ApiError('Only workspace owners can delete this workspace.', 403),
    );

    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Delete Workspace' }));

    expect(
      await screen.findByText('Only workspace owners can delete this workspace.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('disables controls while deletion is pending', async () => {
    const user = userEvent.setup();
    const deferred = createDeferredPromise<{ success: true }>();
    mockedDeleteWorkspace.mockReturnValue(deferred.promise);
    mockedGetAuthMe.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'owner@example.com',
        displayName: 'Owner',
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
      },
      workspaces: [],
      activeWorkspace: null,
    });

    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Delete Workspace' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    });

    deferred.resolve({ success: true });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });
});
