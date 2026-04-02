import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { WorkspaceRole as PrismaWorkspaceRole } from '@prisma/client';
import type { UserSummary, WorkspaceMemberDetail } from '@teamwork/types';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { WorkspaceInvitationsService } from './workspace-invitations.service';

describe('WorkspaceInvitationsService', () => {
  const workspaceId = 'workspace-1';
  const invitationId = 'invitation-1';
  type WorkspaceInvitationCreateCall = {
    data: {
      workspaceId: string;
      email: string;
      role: string;
      invitedByUserId: string;
      tokenHash: string;
      expiresAt: Date;
    };
    select: {
      id: true;
      workspaceId: true;
      email: true;
      role: true;
      invitedByUserId: true;
      expiresAt: true;
      createdAt: true;
      acceptedAt: true;
      revokedAt: true;
    };
  };
  const getCreateInvitationArgs = (
    createMock: jest.Mock,
  ): WorkspaceInvitationCreateCall | undefined => {
    const createCalls = createMock.mock.calls as Array<[WorkspaceInvitationCreateCall]>;
    return createCalls[0]?.[0];
  };
  type MembershipRecord = {
    id: string;
    workspaceId: string;
    userId: string;
    role: PrismaWorkspaceRole;
    createdAt: Date;
  };
  type UserRecord = {
    id: string;
    email: string;
    displayName: string;
    createdAt: Date;
    updatedAt: Date;
  };

  let prisma: {
    workspaceInvitation: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    workspaceMembership: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let membershipsService: {
    createMembership: jest.Mock;
    toDetail: jest.Mock;
  };
  let usersService: {
    findByEmail: jest.Mock;
    getByIdOrThrow: jest.Mock;
  };
  let service: WorkspaceInvitationsService;
  let configService: {
    get: jest.Mock;
  };

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
    const toMemberDetail = (
      membership: MembershipRecord,
      user: UserRecord,
    ): WorkspaceMemberDetail => ({
      id: membership.id,
      workspaceId: membership.workspaceId,
      userId: membership.userId,
      role: membership.role,
      createdAt: membership.createdAt.toISOString(),
      user: toUserSummary(user),
    });

    prisma = {
      workspaceInvitation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      workspaceMembership: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(runInTransaction),
    };
    membershipsService = {
      createMembership: jest.fn(),
      toDetail: jest.fn(
        (membership: MembershipRecord, user: UserRecord): WorkspaceMemberDetail =>
          toMemberDetail(membership, user),
      ),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'INVITE_BASE_URL') {
          return 'http://localhost:3000';
        }

        if (key === 'INVITE_TTL_DAYS') {
          return 30;
        }

        if (key === 'APP_URL') {
          return 'http://localhost:3000';
        }

        return undefined;
      }),
    };
    usersService = {
      findByEmail: jest.fn(),
      getByIdOrThrow: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceInvitationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
        { provide: MembershipsService, useValue: membershipsService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = moduleRef.get(WorkspaceInvitationsService);
  });

  it('creates a pending invitation for an existing user who is not yet a member', async () => {
    usersService.findByEmail.mockResolvedValueOnce({
      id: 'user-2',
      email: 'member@example.com',
      displayName: 'Member',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    });
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce(null);
    prisma.workspaceInvitation.create.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'member@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-04-02T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
    });

    const result = await service.inviteMember(
      workspaceId,
      'member@example.com',
      'member',
      'owner-1',
    );

    expect(result.kind).toBe('invitation');
    expect(result.token).toEqual(expect.any(String));
    expect(result.inviteUrl).toBe(`http://localhost:3000/invite/${result.token}`);
    expect(result.invitation).toMatchObject({
      id: invitationId,
      email: 'member@example.com',
      expiresAt: '2026-04-02T00:00:00.000Z',
    });
    expect(membershipsService.createMembership).not.toHaveBeenCalled();
    expect(prisma.workspaceInvitation.create).toHaveBeenCalled();
  });

  it('creates a pending invitation for an unknown email', async () => {
    usersService.findByEmail.mockResolvedValueOnce(null);
    prisma.workspaceInvitation.create.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-04-02T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
    });

    const result = await service.inviteMember(
      workspaceId,
      'invitee@example.com',
      'member',
      'owner-1',
    );

    expect(result.kind).toBe('invitation');
    expect(result.invitation).toMatchObject({
      id: invitationId,
      email: 'invitee@example.com',
      expiresAt: '2026-04-02T00:00:00.000Z',
    });
    expect(typeof result.token).toBe('string');
    expect(result.inviteUrl).toContain('/invite/');

    const createArgs = getCreateInvitationArgs(prisma.workspaceInvitation.create);
    expect(createArgs).toBeDefined();
    expect(createArgs?.data.workspaceId).toBe(workspaceId);
    expect(createArgs?.data.email).toBe('invitee@example.com');
    expect(createArgs?.data.role).toBe('member');
    expect(createArgs?.data.invitedByUserId).toBe('owner-1');
    expect(createArgs?.data.tokenHash).toEqual(expect.any(String));
    expect(createArgs?.data.expiresAt).toBeInstanceOf(Date);
    expect(createArgs?.select).toEqual({
      id: true,
      workspaceId: true,
      email: true,
      role: true,
      invitedByUserId: true,
      expiresAt: true,
      createdAt: true,
      acceptedAt: true,
      revokedAt: true,
    });
  });

  it('rejects inviting a user who is already a workspace member', async () => {
    usersService.findByEmail.mockResolvedValueOnce({
      id: 'user-2',
      email: 'member@example.com',
      displayName: 'Member',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    });
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId,
      userId: 'user-2',
      role: PrismaWorkspaceRole.member,
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
    });

    await expect(
      service.inviteMember(workspaceId, 'member@example.com', 'member', 'owner-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.workspaceInvitation.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate active invitations', async () => {
    prisma.workspaceInvitation.findFirst.mockResolvedValueOnce({
      id: invitationId,
    });

    await expect(
      service.inviteMember(workspaceId, 'invitee@example.com', 'member', 'owner-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('translates invitation unique-index conflicts into a conflict response', async () => {
    usersService.findByEmail.mockResolvedValueOnce(null);
    prisma.workspaceInvitation.findFirst.mockResolvedValueOnce(null);
    prisma.workspaceInvitation.create.mockRejectedValueOnce({ code: 'P2002' });

    await expect(
      service.inviteMember(workspaceId, 'invitee@example.com', 'member', 'owner-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses the configured invite ttl when creating an invitation', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-26T00:00:00.000Z'));
    usersService.findByEmail.mockResolvedValueOnce(null);
    configService.get.mockImplementation((key: string) => {
      if (key === 'INVITE_BASE_URL') {
        return 'https://app.teamwork.test';
      }

      if (key === 'INVITE_TTL_DAYS') {
        return 45;
      }

      return undefined;
    });
    prisma.workspaceInvitation.create.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-05-10T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
    });

    try {
      await service.inviteMember(workspaceId, 'invitee@example.com', 'member', 'owner-1');

      const createArgs = getCreateInvitationArgs(prisma.workspaceInvitation.create);
      expect(createArgs).toBeDefined();
      expect(createArgs?.data.expiresAt).toEqual(new Date('2026-05-10T00:00:00.000Z'));
      expect(createArgs?.select).toEqual({
        id: true,
        workspaceId: true,
        email: true,
        role: true,
        invitedByUserId: true,
        expiresAt: true,
        createdAt: true,
        acceptedAt: true,
        revokedAt: true,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('blocks accepting an invitation for another email', async () => {
    prisma.workspaceInvitation.findFirst.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-04-02T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
    });

    await expect(
      service.acceptInvitation(invitationId, {
        id: 'user-2',
        email: 'different@example.com',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts an invitation by creating a membership and marking it accepted', async () => {
    prisma.workspaceInvitation.findFirst.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.owner,
      invitedByUserId: 'owner-1',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
    });
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce(null);
    membershipsService.createMembership.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId,
      userId: 'user-2',
      role: PrismaWorkspaceRole.owner,
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
    });
    usersService.getByIdOrThrow.mockResolvedValueOnce({
      id: 'user-2',
      email: 'invitee@example.com',
      displayName: 'Invitee',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    });
    prisma.workspaceInvitation.update.mockResolvedValueOnce({});

    const result = await service.acceptInvitation(invitationId, {
      id: 'user-2',
      email: 'invitee@example.com',
    });

    const updateCall: unknown = prisma.workspaceInvitation.update.mock.calls[0];

    expect(updateCall).toBeDefined();

    const [updateArgs] = updateCall as [
      {
        where: { id: string };
        data: { acceptedAt: Date };
      },
    ];

    expect(updateArgs).toMatchObject({
      where: { id: invitationId },
    });
    expect(updateArgs.data.acceptedAt).toBeInstanceOf(Date);
    expect(result.membership.user.email).toBe('invitee@example.com');
  });

  it('lists only pending invitations for an email', async () => {
    prisma.workspaceInvitation.findMany.mockResolvedValueOnce([
      {
        id: invitationId,
        workspaceId,
        email: 'invitee@example.com',
        role: PrismaWorkspaceRole.member,
        invitedByUserId: 'owner-1',
        expiresAt: new Date('2026-04-02T00:00:00.000Z'),
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
        acceptedAt: null,
        revokedAt: null,
        workspace: {
          id: workspaceId,
          name: 'Workspace',
          slug: 'workspace',
          createdByUserId: 'owner-1',
          createdAt: new Date('2026-03-26T00:00:00.000Z'),
          updatedAt: new Date('2026-03-26T00:00:00.000Z'),
        },
      },
    ]);

    const result = await service.listPendingInvitationsForEmail('invitee@example.com');

    expect(prisma.workspaceInvitation.findMany).toHaveBeenCalledWith({
      where: {
        email: 'invitee@example.com',
        acceptedAt: null,
        revokedAt: null,
      },
      select: {
        id: true,
        workspaceId: true,
        email: true,
        role: true,
        invitedByUserId: true,
        expiresAt: true,
        createdAt: true,
        acceptedAt: true,
        revokedAt: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            createdByUserId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toHaveLength(1);
  });
});
