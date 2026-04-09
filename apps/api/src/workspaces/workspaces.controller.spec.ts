import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../common/auth/workspace-member.guard';
import { WorkspaceRoleGuard } from '../common/auth/workspace-role.guard';
import { WORKSPACE_ROLES_KEY } from '../common/auth/workspace-roles.decorator';
import { WorkspacesController } from './workspaces.controller';

describe('WorkspacesController authorization metadata', () => {
  const controllerPrototype = WorkspacesController.prototype;

  it('is mounted at /workspaces and protected by jwt auth', () => {
    expect(Reflect.getMetadata(PATH_METADATA, WorkspacesController)).toBe('workspaces');
    expect(Reflect.getMetadata(GUARDS_METADATA, WorkspacesController)).toEqual([JwtAuthGuard]);
  });

  it.each([
    ['getWorkspace'],
    ['listMembers'],
    ['removeMember'],
  ])('keeps %s guarded by workspace membership without owner-only role checks', (methodName) => {
    const handler = controllerPrototype[methodName as keyof WorkspacesController];

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([WorkspaceMemberGuard]);
    expect(Reflect.getMetadata(WORKSPACE_ROLES_KEY, handler)).toBeUndefined();
  });

  it.each([
    ['deleteWorkspace'],
    ['listInvitations'],
    ['getWorkspaceShareLink'],
    ['addMember'],
    ['updateMemberRole'],
    ['updateWorkspaceShareLink'],
    ['regenerateWorkspaceShareLink'],
    ['disableWorkspaceShareLink'],
    ['revokeInvitation'],
  ])('keeps %s restricted to workspace owners', (methodName) => {
    const handler = controllerPrototype[methodName as keyof WorkspacesController];

    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      WorkspaceMemberGuard,
      WorkspaceRoleGuard,
    ]);
    expect(Reflect.getMetadata(WORKSPACE_ROLES_KEY, handler)).toEqual(['owner']);
  });

  it('keeps the invite route mounted at the members path', () => {
    const handler = controllerPrototype.addMember;

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(':workspaceId/members');
  });
});
