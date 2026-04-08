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
  icon?: 'create';
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

export function getInvitationInboxHref(): string {
  return '/invitation-inbox';
}

export function getWorkspaceScopedHref(pathname: string, workspaceId: string): string {
  if (pathname.endsWith('/members')) {
    return getWorkspaceMembersHref(workspaceId);
  }

  if (pathname.endsWith('/invitations')) {
    return getWorkspaceInvitationsHref(workspaceId);
  }

  if (pathname.endsWith('/calendar')) {
    return getWorkspaceCalendarHref(workspaceId);
  }

  return getWorkspaceBoardHref(workspaceId);
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
      description: 'Received invitations',
      href: getInvitationInboxHref(),
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
  if (pathname === '/invitation-inbox') {
    return {
      definition: {
        key: 'inbox',
        title: 'Invitation Inbox',
        subtitle: 'Workspace invitations you have received.',
        eyebrow: 'Received invitations',
      },
      currentWorkspace: workspaces[0] ?? null,
    };
  }

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
        subtitle: `Manage ${workspaceName} workspace members and their roles.`,
        eyebrow: 'Workspace members',
      },
      currentWorkspace,
    };
  }

  if (pathname.endsWith('/invitations')) {
    return {
      definition: {
        key: 'invitations',
        title: 'Invitations',
        subtitle: `Invite new members to ${workspaceName} and manage pending invites.`,
        eyebrow: 'Workspace invitations',
      },
      currentWorkspace,
    };
  }

  if (pathname.endsWith('/calendar')) {
    return {
      definition: {
        key: 'calendar',
        title: 'Calendar',
        subtitle: `Track ${workspaceName} due dates across month, week, and day views.`,
        eyebrow: 'Workspace calendar',
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
        icon: 'create',
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
