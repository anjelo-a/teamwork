import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { WorkspaceRole } from '@teamwork/types';

export type WorkspacePolicyAction =
  | 'workspace.settings.update'
  | 'workspace.delete'
  | 'workspace.invitations.manage'
  | 'workspace.members.manage'
  | 'workspace.ownership.transfer'
  | 'workspace.security.view';

interface WorkspaceMembershipLike {
  userId: string;
  role: WorkspaceRole;
}

const OWNER_ONLY_ACTION_MESSAGES: Record<WorkspacePolicyAction, string> = {
  'workspace.settings.update': 'Only workspace owners can update workspace details.',
  'workspace.delete': 'Only workspace owners can delete this workspace.',
  'workspace.invitations.manage': 'Only workspace owners can manage workspace invitations.',
  'workspace.members.manage': 'Only workspace owners can manage workspace members.',
  'workspace.ownership.transfer': 'Only workspace owners can transfer workspace ownership.',
  'workspace.security.view': 'Only workspace owners can view workspace security dashboards.',
};

@Injectable()
export class WorkspacePolicyService {
  assertHasAnyRole(input: {
    membership: Pick<WorkspaceMembershipLike, 'role'> | null | undefined;
    allowedRoles: WorkspaceRole[];
    failureMessage?: string;
  }): void {
    const role = input.membership?.role;

    if (role && input.allowedRoles.includes(role)) {
      return;
    }

    throw new ForbiddenException(
      input.failureMessage ?? 'You do not have permission to perform this action in the workspace.',
    );
  }

  assertCanPerformAction(
    action: WorkspacePolicyAction,
    membership: Pick<WorkspaceMembershipLike, 'role'> | null | undefined,
  ): void {
    this.assertHasAnyRole({
      membership,
      allowedRoles: ['owner'],
      failureMessage: OWNER_ONLY_ACTION_MESSAGES[action],
    });
  }

  assertCanRemoveMember(input: {
    actingUserId: string;
    targetUserId: string;
    actingMembership: WorkspaceMembershipLike;
  }): void {
    if (input.actingUserId === input.targetUserId) {
      return;
    }

    this.assertCanPerformAction('workspace.members.manage', input.actingMembership);
  }

  assertCanTransferOwnership(input: {
    actingUserId: string;
    nextOwnerUserId: string;
    actingMembership: WorkspaceMembershipLike;
    nextOwnerMembership: WorkspaceMembershipLike;
  }): void {
    this.assertCanPerformAction('workspace.ownership.transfer', input.actingMembership);

    if (input.actingUserId === input.nextOwnerUserId) {
      throw new BadRequestException('Choose a different member to transfer ownership.');
    }

    if (input.nextOwnerMembership.role === 'owner') {
      throw new BadRequestException('Selected member is already an owner.');
    }
  }
}
