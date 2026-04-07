import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { WorkspaceRole as PrismaWorkspaceRole } from '@prisma/client';
import { createHash } from 'node:crypto';
import type { UserSummary, WorkspaceMemberDetail } from '@teamwork/types';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { WorkspaceInvitationsService } from './workspace-invitations.service';

describe('WorkspaceInvitationsService', () => {
  const suiteNow = new Date('2026-03-26T00:00:00.000Z');
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
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
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
    jest.useFakeTimers().setSystemTime(suiteNow);

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
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a pending invitation for an existing user', async () => {
    usersService.findByEmail.mockResolvedValueOnce({
      id: 'user-2',
      email: 'member@example.com',
      displayName: 'Member',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    });
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
    expect(prisma.workspaceMembership.findUnique).not.toHaveBeenCalled();
  });

  it('invitation creation stores tokenHash and expiresAt', async () => {
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
    expect(createArgs?.data.tokenHash).toBe(
      createHash('sha256').update(result.token).digest('hex'),
    );
    expect(createArgs?.data.expiresAt).toBeInstanceOf(Date);
    expect(createArgs?.data.expiresAt).toEqual(new Date('2026-04-25T00:00:00.000Z'));
    expect(createArgs?.data.expiresAt.getTime()).toBeGreaterThan(suiteNow.getTime());
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

  it('existing users no longer get auto-added directly', async () => {
    usersService.findByEmail.mockResolvedValueOnce({
      id: 'user-2',
      email: 'member@example.com',
      displayName: 'Member',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    });
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
    expect(result.invitation.email).toBe('member@example.com');
    expect(prisma.workspaceInvitation.create).toHaveBeenCalled();
    expect(prisma.workspaceMembership.findUnique).not.toHaveBeenCalled();
  });

  it('duplicate pending invite is rejected', async () => {
    prisma.workspaceInvitation.findFirst.mockResolvedValueOnce({
      id: invitationId,
    });

    await expect(
      service.inviteMember(workspaceId, 'invitee@example.com', 'member', 'owner-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('revokes expired pending invites before checking for a duplicate', async () => {
    prisma.workspaceInvitation.findFirst.mockResolvedValueOnce(null);
    prisma.workspaceInvitation.create.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-04-25T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
    });

    await service.inviteMember(workspaceId, 'invitee@example.com', 'member', 'owner-1');

    expect(prisma.workspaceInvitation.updateMany).toHaveBeenCalledWith({
      where: {
        workspaceId,
        email: 'invitee@example.com',
        acceptedAt: null,
        revokedAt: null,
        expiresAt: {
          lte: new Date('2026-03-26T00:00:00.000Z'),
        },
      },
      data: {
        revokedAt: new Date('2026-03-26T00:00:00.000Z'),
      },
    });
  });

  it('normalizes the email before checking for existing active invites and storing it', async () => {
    prisma.workspaceInvitation.findFirst.mockResolvedValueOnce(null);
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
      ' Invitee@Example.com ',
      'member',
      'owner-1',
    );

    expect(prisma.workspaceInvitation.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId,
        email: 'invitee@example.com',
        acceptedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: new Date('2026-03-26T00:00:00.000Z'),
        },
      },
      select: { id: true },
    });

    const createArgs = getCreateInvitationArgs(prisma.workspaceInvitation.create);
    expect(createArgs?.data.email).toBe('invitee@example.com');
    expect(result.invitation.email).toBe('invitee@example.com');
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
      expect(createArgs?.data.expiresAt.getTime() - Date.now()).toBe(
        45 * 24 * 60 * 60 * 1000,
      );
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

  it('returns expiresAt in pending workspace invitation summaries', async () => {
    prisma.workspaceInvitation.findMany.mockResolvedValueOnce([
      {
        id: invitationId,
        workspaceId,
        email: 'invitee@example.com',
        role: PrismaWorkspaceRole.member,
        invitedByUserId: 'owner-1',
        expiresAt: new Date('2026-04-10T00:00:00.000Z'),
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
        acceptedAt: null,
        revokedAt: null,
      },
    ]);

    await expect(service.listPendingInvitations(workspaceId)).resolves.toEqual([
      {
        id: invitationId,
        workspaceId,
        email: 'invitee@example.com',
        role: 'member',
        invitedByUserId: 'owner-1',
        expiresAt: '2026-04-10T00:00:00.000Z',
        createdAt: '2026-03-26T00:00:00.000Z',
        acceptedAt: null,
        revokedAt: null,
      },
    ]);

    expect(prisma.workspaceInvitation.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: new Date('2026-03-26T00:00:00.000Z'),
        },
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
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('returns expiresAt in revoked invitation summaries', async () => {
    prisma.workspaceInvitation.findFirst.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-04-10T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
    });
    prisma.workspaceInvitation.update.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-04-10T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: new Date('2026-03-27T00:00:00.000Z'),
    });

    await expect(service.revokeInvitation(workspaceId, invitationId)).resolves.toEqual({
      invitation: {
        id: invitationId,
        workspaceId,
        email: 'invitee@example.com',
        role: 'member',
        invitedByUserId: 'owner-1',
        expiresAt: '2026-04-10T00:00:00.000Z',
        createdAt: '2026-03-26T00:00:00.000Z',
        acceptedAt: null,
        revokedAt: '2026-03-27T00:00:00.000Z',
      },
    });
  });

  it('blocks accepting an invitation for another email', async () => {
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-04-10T00:00:00.000Z'),
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

  it('rejects accepting an invitation that does not exist', async () => {
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.acceptInvitation(invitationId, {
        id: 'user-2',
        email: 'invitee@example.com',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects accepting an invitation that has already been accepted', async () => {
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-04-10T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: new Date('2026-04-01T00:00:00.000Z'),
      revokedAt: null,
    });

    await expect(
      service.acceptInvitation(invitationId, {
        id: 'user-2',
        email: 'invitee@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects accepting a revoked invitation', async () => {
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-04-10T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: new Date('2026-04-01T00:00:00.000Z'),
    });

    await expect(
      service.acceptInvitation(invitationId, {
        id: 'user-2',
        email: 'invitee@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects accepting an expired invitation', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-03T00:00:00.000Z'));
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce({
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

    try {
      await expect(
        service.acceptInvitation(invitationId, {
          id: 'user-2',
          email: 'invitee@example.com',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects accepting an invitation when the user is already a member', async () => {
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-04-10T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
    });
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId,
      userId: 'user-2',
      role: PrismaWorkspaceRole.member,
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
    });

    await expect(
      service.acceptInvitation(invitationId, {
        id: 'user-2',
        email: 'invitee@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(membershipsService.createMembership).not.toHaveBeenCalled();
    expect(prisma.workspaceInvitation.update).not.toHaveBeenCalled();
  });

  it('accepts an invitation by creating a membership and marking it accepted', async () => {
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.owner,
      expiresAt: new Date('2026-04-10T00:00:00.000Z'),
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

  it('keeps the legacy invitation-id accept flow on the same internal lookup path', async () => {
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      expiresAt: new Date('2026-04-10T00:00:00.000Z'),
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
      role: PrismaWorkspaceRole.member,
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

    await service.acceptInvitation(invitationId, {
      id: 'user-2',
      email: 'invitee@example.com',
    });

    expect(prisma.workspaceInvitation.findUnique).toHaveBeenCalledWith({
      where: { id: invitationId },
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
      },
    });
  });

  it('accept-by-token creates membership and marks invitation accepted', async () => {
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-04-10T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
    });
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce(null);
    membershipsService.createMembership.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId,
      userId: 'user-2',
      role: PrismaWorkspaceRole.member,
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

    const result = await service.acceptInvitationByToken('plain-token', {
      id: 'user-2',
      email: 'invitee@example.com',
    });

    const findUniqueCalls = prisma.workspaceInvitation.findUnique.mock.calls as Array<
      [
        {
          where: { tokenHash: string };
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
        },
      ]
    >;
    const findUniqueArgs = findUniqueCalls[0]?.[0];

    expect(findUniqueArgs).toBeDefined();
    expect(typeof findUniqueArgs?.where.tokenHash).toBe('string');
    expect(findUniqueArgs?.select).toEqual({
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
    expect(result.membership.user.email).toBe('invitee@example.com');
  });

  it('unknown tokens are rejected correctly during acceptance', async () => {
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.acceptInvitationByToken('missing-token', {
        id: 'user-2',
        email: 'invitee@example.com',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
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
        expiresAt: {
          gt: new Date('2026-03-26T00:00:00.000Z'),
        },
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
    expect(result[0]).toEqual({
      invitation: {
        id: invitationId,
        workspaceId,
        email: 'invitee@example.com',
        role: 'member',
        invitedByUserId: 'owner-1',
        expiresAt: '2026-04-02T00:00:00.000Z',
        createdAt: '2026-03-26T00:00:00.000Z',
        acceptedAt: null,
        revokedAt: null,
      },
      workspace: {
        id: workspaceId,
        name: 'Workspace',
        slug: 'workspace',
        createdByUserId: 'owner-1',
        createdAt: '2026-03-26T00:00:00.000Z',
        updatedAt: '2026-03-26T00:00:00.000Z',
      },
    });
  });

  it('token lookup returns safe metadata', async () => {
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      role: PrismaWorkspaceRole.member,
      expiresAt: new Date('2026-04-10T00:00:00.000Z'),
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
    });

    const result = await service.getInvitationByToken('plain-token');

    const findUniqueCalls = prisma.workspaceInvitation.findUnique.mock.calls as Array<
      [
        {
          where: { tokenHash: string };
          select: {
            id: true;
            workspaceId: true;
            role: true;
            expiresAt: true;
            createdAt: true;
            acceptedAt: true;
            revokedAt: true;
            workspace: {
              select: {
                id: true;
                name: true;
                slug: true;
                createdByUserId: true;
                createdAt: true;
                updatedAt: true;
              };
            };
          };
        },
      ]
    >;
    const findUniqueArgs = findUniqueCalls[0]?.[0];

    expect(findUniqueArgs).toBeDefined();
    expect(typeof findUniqueArgs?.where.tokenHash).toBe('string');
    expect(findUniqueArgs?.select).toEqual({
      id: true,
      workspaceId: true,
      role: true,
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
    });
    expect(result).toEqual({
      invitation: {
        id: invitationId,
        workspaceId,
        role: 'member',
        expiresAt: '2026-04-10T00:00:00.000Z',
        createdAt: '2026-03-26T00:00:00.000Z',
        acceptedAt: null,
        revokedAt: null,
      },
      workspace: {
        id: workspaceId,
        name: 'Workspace',
        slug: 'workspace',
        createdByUserId: 'owner-1',
        createdAt: '2026-03-26T00:00:00.000Z',
        updatedAt: '2026-03-26T00:00:00.000Z',
      },
      status: 'pending',
    });
  });

  it('unknown tokens are rejected correctly during lookup', async () => {
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce(null);

    await expect(service.getInvitationByToken('missing-token')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lookup derives accepted, revoked, and expired statuses and rejects unknown tokens', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-03T00:00:00.000Z'));
    prisma.workspaceInvitation.findUnique
      .mockResolvedValueOnce({
        id: invitationId,
        workspaceId,
        email: 'invitee@example.com',
        role: PrismaWorkspaceRole.member,
        invitedByUserId: 'owner-1',
        expiresAt: new Date('2026-04-10T00:00:00.000Z'),
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
        acceptedAt: new Date('2026-04-01T00:00:00.000Z'),
        revokedAt: null,
        workspace: {
          id: workspaceId,
          name: 'Workspace',
          slug: 'workspace',
          createdByUserId: 'owner-1',
          createdAt: new Date('2026-03-26T00:00:00.000Z'),
          updatedAt: new Date('2026-03-26T00:00:00.000Z'),
        },
      })
      .mockResolvedValueOnce({
        id: invitationId,
        workspaceId,
        email: 'invitee@example.com',
        role: PrismaWorkspaceRole.member,
        invitedByUserId: 'owner-1',
        expiresAt: new Date('2026-04-10T00:00:00.000Z'),
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
        acceptedAt: null,
        revokedAt: new Date('2026-04-02T00:00:00.000Z'),
        workspace: {
          id: workspaceId,
          name: 'Workspace',
          slug: 'workspace',
          createdByUserId: 'owner-1',
          createdAt: new Date('2026-03-26T00:00:00.000Z'),
          updatedAt: new Date('2026-03-26T00:00:00.000Z'),
        },
      })
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce(null);

    try {
      await expect(service.getInvitationByToken('accepted-token')).resolves.toMatchObject({
        status: 'accepted',
      });
      await expect(service.getInvitationByToken('revoked-token')).resolves.toMatchObject({
        status: 'revoked',
      });
      await expect(service.getInvitationByToken('expired-token')).resolves.toMatchObject({
        status: 'expired',
      });
      await expect(service.getInvitationByToken('unknown-token')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('accepted tokens are rejected correctly during acceptance', async () => {
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-04-10T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: new Date('2026-04-01T00:00:00.000Z'),
      revokedAt: null,
    });

    await expect(
      service.acceptInvitationByToken('accepted-token', {
        id: 'user-2',
        email: 'invitee@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('revoked tokens are rejected correctly during acceptance', async () => {
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-04-10T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: new Date('2026-04-01T00:00:00.000Z'),
    });

    await expect(
      service.acceptInvitationByToken('revoked-token', {
        id: 'user-2',
        email: 'invitee@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('expired tokens are rejected correctly during acceptance', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-03T00:00:00.000Z'));
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce({
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

    try {
      await expect(
        service.acceptInvitationByToken('expired-token', {
          id: 'user-2',
          email: 'invitee@example.com',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    } finally {
      jest.useRealTimers();
    }
  });

  it('wrong-email acceptance is rejected', async () => {
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-04-10T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
    });

    await expect(
      service.acceptInvitationByToken('plain-token', {
        id: 'user-2',
        email: 'different@example.com',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('already-member acceptance is rejected', async () => {
    prisma.workspaceInvitation.findUnique.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
      expiresAt: new Date('2026-04-10T00:00:00.000Z'),
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
    });
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId,
      userId: 'user-2',
      role: PrismaWorkspaceRole.member,
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
    });

    await expect(
      service.acceptInvitationByToken('plain-token', {
        id: 'user-2',
        email: 'invitee@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(membershipsService.createMembership).not.toHaveBeenCalled();
    expect(prisma.workspaceInvitation.update).not.toHaveBeenCalled();
  });
});
