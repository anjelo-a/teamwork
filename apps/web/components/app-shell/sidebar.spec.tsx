import { render, screen } from '@testing-library/react';
import type { AuthenticatedWorkspace, AuthMeResponse } from '@teamwork/types';
import { SidebarNavigation } from '@/components/app-shell/sidebar';
import { useAuthSession } from '@/lib/auth/auth-session-provider';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock('@/lib/auth/auth-session-provider', () => ({
  useAuthSession: jest.fn(),
}));

jest.mock('@/components/workspaces/create-workspace-modal', () => ({
  CreateWorkspaceModal: () => null,
}));

jest.mock('@/components/workspaces/delete-workspace-dialog', () => ({
  DeleteWorkspaceDialog: () => null,
}));

jest.mock('@/components/workspaces/rename-workspace-dialog', () => ({
  RenameWorkspaceDialog: () => null,
}));

const mockedUseAuthSession = jest.mocked(useAuthSession);

function buildWorkspace(role: 'owner' | 'member'): AuthenticatedWorkspace {
  return {
    id: 'workspace-1',
    name: 'Product Team',
    slug: 'product-team',
    createdByUserId: 'user-1',
    createdAt: '2026-04-09T00:00:00.000Z',
    updatedAt: '2026-04-09T00:00:00.000Z',
    membership: {
      id: 'membership-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role,
      createdAt: '2026-04-09T00:00:00.000Z',
    },
  };
}

function buildSession(workspace: AuthenticatedWorkspace): ReturnType<typeof useAuthSession> {
  const auth: AuthMeResponse = {
    user: {
      id: 'user-1',
      email: 'owner@example.com',
      displayName: 'Owner',
      createdAt: '2026-04-09T00:00:00.000Z',
      updatedAt: '2026-04-09T00:00:00.000Z',
    },
    workspaces: [workspace],
    activeWorkspace: workspace,
  };

  return {
    status: 'authenticated',
    auth,
    accessToken: 'token-123',
    errorMessage: null,
    refreshSession: jest.fn(),
    setAccessToken: jest.fn(),
    clearSession: jest.fn(),
  };
}

describe('SidebarNavigation workspace deletion affordance', () => {
  it('shows the delete action for workspace owners', () => {
    const workspace = buildWorkspace('owner');
    mockedUseAuthSession.mockReturnValue(buildSession(workspace));

    render(
      <SidebarNavigation currentPath="/workspaces/workspace-1/board" currentWorkspace={workspace} />,
    );

    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('hides the delete action for non-owners', () => {
    const workspace = buildWorkspace('member');
    mockedUseAuthSession.mockReturnValue(buildSession(workspace));

    render(
      <SidebarNavigation currentPath="/workspaces/workspace-1/board" currentWorkspace={workspace} />,
    );

    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});
