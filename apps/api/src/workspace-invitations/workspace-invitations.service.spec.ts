import {
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { WorkspaceRole as PrismaWorkspaceRole } from '@prisma/client';
import { WorkspaceInvitationsService } from './workspace-invitations.service';

describe('WorkspaceInvitationsService', () => {
  const workspaceId = 'workspace-1';
  const invitationId = 'invitation-1';

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

  beforeEach(() => {
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
      $transaction: jest.fn(async (callback) => callback(prisma)),
    };
    membershipsService = {
      createMembership: jest.fn(),
      toDetail: jest.fn((membership, user) => ({ ...membership, user })),
    };
    usersService = {
      findByEmail: jest.fn(),
      getByIdOrThrow: jest.fn(),
    };

    service = new WorkspaceInvitationsService(
      prisma as never,
      membershipsService as never,
      usersService as never,
    );
  });

  it('creates a membership immediately for an existing user', async () => {
    usersService.findByEmail.mockResolvedValueOnce({
      id: 'user-2',
      email: 'member@example.com',
      displayName: 'Member',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    });
    membershipsService.createMembership.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId,
      userId: 'user-2',
      role: PrismaWorkspaceRole.member,
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
    });

    const result = await service.inviteMember(
      workspaceId,
      'member@example.com',
      'member',
      'owner-1',
    );

    expect(result.kind).toBe('membership');
    expect(membershipsService.createMembership).toHaveBeenCalled();
    expect(prisma.workspaceInvitation.create).not.toHaveBeenCalled();
  });

  it('creates a pending invitation for an unknown email', async () => {
    usersService.findByEmail.mockResolvedValueOnce(null);
    prisma.workspaceInvitation.create.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
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

    expect(result).toMatchObject({
      kind: 'invitation',
      invitation: {
        id: invitationId,
        email: 'invitee@example.com',
      },
    });
  });

  it('rejects duplicate active invitations', async () => {
    prisma.workspaceInvitation.findFirst.mockResolvedValueOnce({ id: invitationId });

    await expect(
      service.inviteMember(
        workspaceId,
        'invitee@example.com',
        'member',
        'owner-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks accepting an invitation for another email', async () => {
    prisma.workspaceInvitation.findFirst.mockResolvedValueOnce({
      id: invitationId,
      workspaceId,
      email: 'invitee@example.com',
      role: PrismaWorkspaceRole.member,
      invitedByUserId: 'owner-1',
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

    expect(prisma.workspaceInvitation.update).toHaveBeenCalledWith({
      where: { id: invitationId },
      data: { acceptedAt: expect.any(Date) },
    });
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

    const result = await service.listPendingInvitationsForEmail(
      'invitee@example.com',
    );

    expect(prisma.workspaceInvitation.findMany).toHaveBeenCalledWith({
      where: {
        email: 'invitee@example.com',
        acceptedAt: null,
        revokedAt: null,
      },
      include: {
        workspace: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toHaveLength(1);
  });
});
