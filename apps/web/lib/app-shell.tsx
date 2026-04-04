import type { ReactNode } from 'react';
import type { AuthenticatedWorkspace } from '@teamwork/types';
import {
  BoardIcon,
  CalendarIcon,
  InboxIcon,
  InvitationsIcon,
  MembersIcon,
} from '@/components/app-shell/icons';

export interface SidebarNavigationItem {
  key: 'board' | 'members' | 'invitations' | 'inbox' | 'calendar';
  label: string;
  description: string;
  href: string;
  icon: ReactNode;
}

export interface ShellHeaderAction {
  label: string;
  href?: string;
  onAction?: () => void;
}

interface ShellRouteDefinition {
  key: SidebarNavigationItem['key'];
  title: string;
  subtitle: string;
  eyebrow: string;
  action?: ShellHeaderAction;
}

export interface ShellRouteContext {
  definition: ShellRouteDefinition;
  currentWorkspace: AuthenticatedWorkspace | null;
}

export function getWorkspaceBoardHref(workspaceId: string): string {
  return `/workspaces/${workspaceId}/board`;
}

export function getWorkspaceMembersHref(workspaceId: string): string {
  return `/workspaces/${workspaceId}/members`;
}

export function getWorkspaceInvitationsHref(workspaceId: string): string {
  return `/workspaces/${workspaceId}/invitations`;
}

export function getWorkspaceCalendarHref(workspaceId: string): string {
  return `/workspaces/${workspaceId}/calendar`;
}

export function getSidebarNavigationItems(
  workspaceId: string | null,
): SidebarNavigationItem[] {
  const resolvedWorkspaceId = workspaceId ?? '';

  return [
    {
      key: 'board',
      label: 'Board',
      description: 'Workspace planning',
      href: getWorkspaceBoardHref(resolvedWorkspaceId),
      icon: <BoardIcon />,
    },
    {
      key: 'members',
      label: 'Members',
      description: 'People and roles',
      href: getWorkspaceMembersHref(resolvedWorkspaceId),
      icon: <MembersIcon />,
    },
    {
      key: 'invitations',
      label: 'Invitations',
      description: 'Owner access',
      href: getWorkspaceInvitationsHref(resolvedWorkspaceId),
      icon: <InvitationsIcon />,
    },
    {
      key: 'inbox',
      label: 'Inbox',
      description: 'Cross-workspace tasks',
      href: '/inbox',
      icon: <InboxIcon />,
    },
    {
      key: 'calendar',
      label: 'Calendar',
      description: 'Timeline view',
      href: getWorkspaceCalendarHref(resolvedWorkspaceId),
      icon: <CalendarIcon />,
    },
  ];
}

export function matchesShellHref(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function deriveShellRouteContext(
  pathname: string,
  workspaces: AuthenticatedWorkspace[],
): ShellRouteContext {
  if (pathname === '/inbox') {
    return {
      definition: {
        key: 'inbox',
        title: 'Inbox',
        subtitle: 'Authenticated task visibility across every workspace you can access.',
        eyebrow: 'Global tasks',
      },
      currentWorkspace: workspaces[0] ?? null,
    };
  }

  const matchedWorkspaceId = readWorkspaceIdFromPath(pathname);
  const currentWorkspace =
    workspaces.find((workspace) => workspace.id === matchedWorkspaceId) ?? workspaces[0] ?? null;
  const workspaceName = currentWorkspace?.name ?? 'Workspace';

  if (pathname.endsWith('/members')) {
    return {
      definition: {
        key: 'members',
        title: 'Members',
        subtitle: `${workspaceName} membership and role surfaces can plug into this shell next.`,
        eyebrow: 'Workspace access',
      },
      currentWorkspace,
    };
  }

  if (pathname.endsWith('/invitations')) {
    return {
      definition: {
        key: 'invitations',
        title: 'Invitations',
        subtitle: `${workspaceName} invitation flows use the real owner-protected backend route.`,
        eyebrow: 'Owner workflow',
      },
      currentWorkspace,
    };
  }

  if (pathname.endsWith('/calendar')) {
    return {
      definition: {
        key: 'calendar',
        title: 'Calendar',
        subtitle: `${workspaceName} is ready for date-based collaboration views.`,
        eyebrow: 'Workspace planning',
      },
      currentWorkspace,
    };
  }

  return {
    definition: {
      key: 'board',
      title: 'Board',
      subtitle: `${workspaceName} board activity, filters, and task progress in one view.`,
      eyebrow: 'Workspace board',
      action: {
        label: 'Create Task',
      },
    },
    currentWorkspace,
  };
}

function readWorkspaceIdFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);

  if (segments[0] !== 'workspaces') {
    return null;
  }

  return segments[1] ?? null;
}
