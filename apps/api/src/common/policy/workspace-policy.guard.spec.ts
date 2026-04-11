import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { WorkspaceMembership } from '@prisma/client';
import { WORKSPACE_POLICY_ACTIONS_KEY } from './workspace-policy.decorator';
import { WorkspacePolicyGuard } from './workspace-policy.guard';
import { WorkspacePolicyService } from './workspace-policy.service';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class FakeController {}

function makeContext(
  membership: Partial<WorkspaceMembership> | undefined,
  handlerFn = () => {},
): ExecutionContext {
  const request = { workspaceMembership: membership };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handlerFn,
    getClass: () => FakeController,
  } as unknown as ExecutionContext;
}

describe('WorkspacePolicyGuard', () => {
  let reflector: Reflector;
  let guard: WorkspacePolicyGuard;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [WorkspacePolicyGuard, WorkspacePolicyService, Reflector],
    }).compile();

    reflector = moduleRef.get(Reflector);
    guard = moduleRef.get(WorkspacePolicyGuard);
  });

  it('returns true when no policy actions are configured', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(undefined);

    expect(guard.canActivate(makeContext({ role: 'member' }))).toBe(true);
  });

  it('allows owner-only actions for owners', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(['workspace.delete', 'workspace.security.view']);

    expect(guard.canActivate(makeContext({ role: 'owner' }))).toBe(true);
  });

  it('rejects owner-only actions for non-owners', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(['workspace.delete', 'workspace.security.view']);

    expect(() => guard.canActivate(makeContext({ role: 'member' }))).toThrow(ForbiddenException);
  });

  it('reads metadata from the workspace policy key', () => {
    const handlerFn = () => {};
    const getAllAndOverrideSpy = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(undefined);

    guard.canActivate(makeContext(undefined, handlerFn));

    expect(getAllAndOverrideSpy).toHaveBeenCalledWith(
      WORKSPACE_POLICY_ACTIONS_KEY,
      expect.arrayContaining([handlerFn]),
    );
  });
});
