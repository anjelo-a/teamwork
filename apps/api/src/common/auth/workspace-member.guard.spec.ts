import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import type { WorkspaceMembership } from '@prisma/client';
import { MembershipsService } from '../../memberships/memberships.service';
import { WorkspaceMemberGuard } from './workspace-member.guard';

function makeContext(params: Record<string, string>, userId: string): ExecutionContext {
  const request = { params, user: { id: userId }, workspaceMembership: undefined as WorkspaceMembership | undefined };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('WorkspaceMemberGuard', () => {
  const workspaceId = 'workspace-1';
  const userId = 'user-1';

  const membership = {
    id: 'membership-1',
    workspaceId,
    userId,
    role: 'member',
    createdAt: new Date('2026-03-26T00:00:00.000Z'),
  } as WorkspaceMembership;

  let membershipsService: { requireMembership: jest.Mock };
  let guard: WorkspaceMemberGuard;

  beforeEach(async () => {
    membershipsService = { requireMembership: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceMemberGuard,
        { provide: MembershipsService, useValue: membershipsService },
      ],
    }).compile();

    guard = moduleRef.get(WorkspaceMemberGuard);
  });

  it('returns true and attaches the membership to the request when the user is a member', async () => {
    membershipsService.requireMembership.mockResolvedValueOnce(membership);
    const context = makeContext({ workspaceId }, userId);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(membershipsService.requireMembership).toHaveBeenCalledWith(workspaceId, userId);
    const req = context.switchToHttp().getRequest<{ workspaceMembership: WorkspaceMembership }>();
    expect(req.workspaceMembership).toEqual(membership);
  });

  it('throws NotFoundException when the workspaceId parameter is absent', async () => {
    const context = makeContext({}, userId);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(NotFoundException);
    expect(membershipsService.requireMembership).not.toHaveBeenCalled();
  });

  it('propagates ForbiddenException from requireMembership when the user is not a member', async () => {
    membershipsService.requireMembership.mockRejectedValueOnce(
      new ForbiddenException('You do not belong to this workspace.'),
    );
    const context = makeContext({ workspaceId }, userId);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
