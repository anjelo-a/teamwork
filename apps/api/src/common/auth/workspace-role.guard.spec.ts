import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import type { WorkspaceMembership } from '@prisma/client';
import type { WorkspaceRole } from '@teamwork/types';
import { WORKSPACE_ROLES_KEY } from './workspace-roles.decorator';
import { WorkspaceRoleGuard } from './workspace-role.guard';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class FakeController {}

function makeContext(
  membership: Partial<WorkspaceMembership> | undefined,
  requiredRoles: WorkspaceRole[] | undefined,
  handlerFn = () => {},
): ExecutionContext {
  const request = { workspaceMembership: membership };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handlerFn,
    getClass: () => FakeController,
  } as unknown as ExecutionContext;
}

describe('WorkspaceRoleGuard', () => {
  let reflector: Reflector;
  let guard: WorkspaceRoleGuard;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [WorkspaceRoleGuard, Reflector],
    }).compile();

    reflector = moduleRef.get(Reflector);
    guard = moduleRef.get(WorkspaceRoleGuard);
  });

  it('returns true when no required roles are configured for the handler', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(undefined);
    const context = makeContext({ role: 'member' } as WorkspaceMembership, undefined);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('returns true when the required roles list is empty', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce([]);
    const context = makeContext({ role: 'member' } as WorkspaceMembership, []);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('returns true when the membership role satisfies the required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(['owner'] as WorkspaceRole[]);
    const context = makeContext({ role: 'owner' } as WorkspaceMembership, ['owner']);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when the membership role is insufficient', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(['owner'] as WorkspaceRole[]);
    const context = makeContext({ role: 'member' } as WorkspaceMembership, ['owner']);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when no membership is present on the request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(['owner'] as WorkspaceRole[]);
    const context = makeContext(undefined, ['owner']);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('reads the roles from the correct metadata key', () => {
    const getAllAndOverrideSpy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(undefined);
    const handlerFn = () => {};
    const context = makeContext(undefined, undefined, handlerFn);

    guard.canActivate(context);

    expect(getAllAndOverrideSpy).toHaveBeenCalledWith(
      WORKSPACE_ROLES_KEY,
      expect.arrayContaining([handlerFn]),
    );
  });
});
