import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../common/auth/workspace-member.guard';
import { WORKSPACE_POLICY_ACTIONS_KEY } from '../common/policy/workspace-policy.decorator';
import { WorkspacePolicyGuard } from '../common/policy/workspace-policy.guard';
import { WorkspacesController } from './workspaces.controller';

describe('WorkspacesController authorization metadata', () => {
  const controllerPrototype = WorkspacesController.prototype;

  it('is mounted at /workspaces and protected by jwt auth', () => {
    expect(Reflect.getMetadata(PATH_METADATA, WorkspacesController)).toBe('workspaces');
    expect(Reflect.getMetadata(GUARDS_METADATA, WorkspacesController)).toEqual([JwtAuthGuard]);
  });

  it.each([
    ['getWorkspace'],
    ['getWorkspaceBoardData'],
    ['listMembers'],
    ['removeMember'],
  ])('keeps %s guarded by workspace membership without owner-only role checks', (methodName) => {
    const handler = controllerPrototype[methodName as keyof WorkspacesController];

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([WorkspaceMemberGuard]);
    expect(Reflect.getMetadata(WORKSPACE_POLICY_ACTIONS_KEY, handler)).toBeUndefined();
  });

  it.each([
    ['updateWorkspace', ['workspace.settings.update']],
    ['deleteWorkspace', ['workspace.delete']],
    ['listInvitations', ['workspace.invitations.manage']],
    ['getWorkspaceShareLink', ['workspace.invitations.manage']],
    ['addMember', ['workspace.invitations.manage']],
    ['updateMemberRole', ['workspace.members.manage']],
    ['updateWorkspaceShareLink', ['workspace.invitations.manage']],
    ['regenerateWorkspaceShareLink', ['workspace.invitations.manage']],
    ['disableWorkspaceShareLink', ['workspace.invitations.manage']],
    ['transferWorkspaceOwnership', ['workspace.ownership.transfer']],
    ['revokeAllInvitations', ['workspace.invitations.manage']],
    ['getWorkspaceSecurityDashboard', ['workspace.security.view']],
    ['revokeInvitation', ['workspace.invitations.manage']],
  ])('keeps %s restricted to workspace owners', (methodName, actions) => {
    const handler = controllerPrototype[methodName as keyof WorkspacesController];

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      WorkspaceMemberGuard,
      WorkspacePolicyGuard,
    ]);
    expect(Reflect.getMetadata(WORKSPACE_POLICY_ACTIONS_KEY, handler)).toEqual(actions);
  });

  it('keeps the invite route mounted at the members path', () => {
    const handler = controllerPrototype.addMember;

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(':workspaceId/members');
  });
});
