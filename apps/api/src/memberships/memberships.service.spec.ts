import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { WorkspaceRole as PrismaWorkspaceRole } from '@prisma/client';
import { MembershipsService } from './memberships.service';

describe('MembershipsService', () => {
  const workspaceId = 'workspace-1';
  const actingUserId = 'user-1';
  const targetUserId = 'user-2';

  let prisma: {
    workspaceMembership: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let usersService: {
    toSummary: jest.Mock;
  };
  let service: MembershipsService;

  beforeEach(() => {
    prisma = {
      workspaceMembership: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(prisma)),
    };
    usersService = {
      toSummary: jest.fn((user) => user),
    };

    service = new MembershipsService(
      prisma as never,
      usersService as never,
    );
  });

  it('updates a member role when another owner remains', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId,
      userId: targetUserId,
      role: PrismaWorkspaceRole.owner,
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
    });
    prisma.workspaceMembership.count.mockResolvedValueOnce(1);
    prisma.workspaceMembership.update.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId,
      userId: targetUserId,
      role: PrismaWorkspaceRole.member,
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      user: {
        id: targetUserId,
        email: 'member@example.com',
        displayName: 'Member',
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
        updatedAt: new Date('2026-03-26T00:00:00.000Z'),
      },
    });

    const result = await service.updateMemberRole(
      workspaceId,
      targetUserId,
      'member',
    );

    expect(result.role).toBe('member');
    expect(prisma.workspaceMembership.count).toHaveBeenCalledWith({
      where: {
        workspaceId,
        role: PrismaWorkspaceRole.owner,
        userId: { not: targetUserId },
      },
    });
  });

  it('blocks downgrading the last owner', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId,
      userId: actingUserId,
      role: PrismaWorkspaceRole.owner,
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
    });
    prisma.workspaceMembership.count.mockResolvedValueOnce(0);

    await expect(
      service.updateMemberRole(workspaceId, actingUserId, 'member'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows a member to remove themselves', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId,
      userId: actingUserId,
      role: PrismaWorkspaceRole.member,
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
    });
    prisma.workspaceMembership.delete.mockResolvedValueOnce({});

    await expect(
      service.removeMember(workspaceId, actingUserId, actingUserId),
    ).resolves.toEqual({ success: true });
  });

  it('blocks a non-owner from removing someone else', async () => {
    prisma.workspaceMembership.findUnique
      .mockResolvedValueOnce({
        id: 'membership-target',
        workspaceId,
        userId: targetUserId,
        role: PrismaWorkspaceRole.member,
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'membership-acting',
        workspaceId,
        userId: actingUserId,
        role: PrismaWorkspaceRole.member,
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
      });

    await expect(
      service.removeMember(workspaceId, targetUserId, actingUserId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks removing the last owner', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId,
      userId: actingUserId,
      role: PrismaWorkspaceRole.owner,
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
    });
    prisma.workspaceMembership.count.mockResolvedValueOnce(0);

    await expect(
      service.removeMember(workspaceId, actingUserId, actingUserId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
