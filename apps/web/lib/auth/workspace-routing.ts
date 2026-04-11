import type { AuthMeResponse, AuthenticatedWorkspace } from '@teamwork/types';
import { getWorkspaceBoardHref } from '@/lib/app-shell';

interface WorkspaceScope {
  workspaces: AuthMeResponse['workspaces'];
  activeWorkspace: AuthMeResponse['activeWorkspace'];
}

export function selectWorkspaceForRedirect(
  auth: WorkspaceScope,
  preferredWorkspaceId?: string,
): AuthenticatedWorkspace | null {
  if (preferredWorkspaceId) {
    const preferredWorkspace =
      auth.workspaces.find((workspace) => workspace.id === preferredWorkspaceId) ?? null;

    if (preferredWorkspace) {
      return preferredWorkspace;
    }
  }

  return auth.activeWorkspace ?? auth.workspaces[0] ?? null;
}

export function resolveWorkspaceBoardRedirect(
  auth: WorkspaceScope,
  preferredWorkspaceId?: string,
): string | null {
  const destinationWorkspace = selectWorkspaceForRedirect(auth, preferredWorkspaceId);

  if (!destinationWorkspace) {
    return null;
  }

  return getWorkspaceBoardHref(destinationWorkspace.id);
}
