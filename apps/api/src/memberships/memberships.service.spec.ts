import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, WorkspaceRole as PrismaWorkspaceRole } from '@prisma/client';
import type { UserSummary } from '@teamwork/types';
import { WorkspacePolicyService } from '../common/policy/workspace-policy.service';
import { SecurityTelemetryService } from '../common/security/security-telemetry.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MembershipsService } from './memberships.service';

describe('MembershipsService', () => {
  const workspaceId = 'workspace-1';
  const actingUserId = 'user-1';
  const targetUserId = 'user-2';
  type UserRecord = {
    id: string;
    email: string;
    displayName: string;
    createdAt: Date;
    updatedAt: Date;
  };

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
  let securityTelemetryService: {
    record: jest.Mock;
  };
  let service: MembershipsService;

  beforeEach(async () => {
    const runInTransaction = <T>(callback: (tx: typeof prisma) => Promise<T>): Promise<T> =>
      callback(prisma);
    const toUserSummary = (user: UserRecord): UserSummary => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });

    prisma = {
      workspaceMembership: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(runInTransaction),
    };
    usersService = {
      toSummary: jest.fn((user: UserRecord): UserSummary => toUserSummary(user)),
    };
    securityTelemetryService = {
      record: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MembershipsService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
        WorkspacePolicyService,
        { provide: SecurityTelemetryService, useValue: securityTelemetryService },
      ],
    }).compile();

    service = moduleRef.get(MembershipsService);
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

    const result = await service.updateMemberRole(workspaceId, targetUserId, 'member');

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

  it('retries role changes after a serializable transaction conflict', async () => {
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

    prisma.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
      );

    const result = await service.updateMemberRole(workspaceId, targetUserId, 'member');

    expect(result.role).toBe('member');
    expect(prisma.$transaction).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
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

    await expect(service.removeMember(workspaceId, actingUserId, actingUserId)).resolves.toEqual({
      success: true,
    });
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
