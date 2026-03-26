import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type User,
  type Workspace,
  type WorkspaceInvitation,
} from '@prisma/client';
import { normalizeEmail } from '@teamwork/validation';
import type {
  InviteWorkspaceMemberResult,
  WorkspaceInvitationSummary,
  WorkspaceRole,
  WorkspaceSummary,
} from '@teamwork/types';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

type InvitationDatabase = Prisma.TransactionClient | PrismaService;

@Injectable()
export class WorkspaceInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipsService: MembershipsService,
    private readonly usersService: UsersService,
  ) {}

  async inviteMember(
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
    invitedByUserId: string,
  ): Promise<InviteWorkspaceMemberResult> {
    const normalizedEmail = normalizeEmail(email);

    return this.prisma.$transaction(async (tx) => {
      await this.ensureNoActiveInvitation(workspaceId, normalizedEmail, tx);

      const existingUser = await this.usersService.findByEmail(normalizedEmail, tx);

      if (existingUser) {
        const membership = await this.membershipsService.createMembership(
          {
            workspaceId,
            userId: existingUser.id,
            role,
          },
          tx,
        );

        return {
          kind: 'membership',
          membership: this.membershipsService.toDetail(membership, existingUser),
        };
      }

      const invitation = await this.createInvitation(
        {
          workspaceId,
          email: normalizedEmail,
          role,
          invitedByUserId,
        },
        tx,
      );

      return {
        kind: 'invitation',
        invitation: this.toSummary(invitation),
      };
    });
  }

  async listPendingInvitations(workspaceId: string): Promise<WorkspaceInvitationSummary[]> {
    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: {
        workspaceId,
        acceptedAt: null,
        revokedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    return invitations.map((invitation) => this.toSummary(invitation));
  }

  async listPendingInvitationsForEmail(email: string) {
    const normalizedEmail = normalizeEmail(email);
    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: {
        email: normalizedEmail,
        acceptedAt: null,
        revokedAt: null,
      },
      include: {
        workspace: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return invitations.map((invitation) => ({
      invitation: this.toSummary(invitation),
      workspace: this.toWorkspaceSummary(invitation.workspace),
    }));
  }

  async revokeInvitation(workspaceId: string, invitationId: string) {
    const invitation = await this.prisma.workspaceInvitation.findFirst({
      where: {
        id: invitationId,
        workspaceId,
        acceptedAt: null,
        revokedAt: null,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    const revokedInvitation = await this.prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { revokedAt: new Date() },
    });

    return {
      invitation: this.toSummary(revokedInvitation),
    };
  }

  async acceptInvitation(invitationId: string, user: { id: string; email: string }) {
    const normalizedEmail = normalizeEmail(user.email);

    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.workspaceInvitation.findFirst({
        where: {
          id: invitationId,
          acceptedAt: null,
          revokedAt: null,
        },
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found.');
      }

      if (invitation.email !== normalizedEmail) {
        throw new ForbiddenException(
          'You cannot accept an invitation for a different email address.',
        );
      }

      const existingMembership = await tx.workspaceMembership.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId: user.id,
          },
        },
      });

      if (existingMembership) {
        throw new ConflictException(
          'You are already a member of this workspace.',
        );
      }

      const createdMembership = await this.membershipsService.createMembership(
        {
          workspaceId: invitation.workspaceId,
          userId: user.id,
          role: invitation.role,
        },
        tx,
      );

      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      const currentUser = await this.usersService.getByIdOrThrow(user.id, tx);

      return {
        membership: this.membershipsService.toDetail(createdMembership, currentUser),
      };
    });
  }

  toSummary(
    invitation: Pick<
      WorkspaceInvitation,
      | 'id'
      | 'workspaceId'
      | 'email'
      | 'role'
      | 'invitedByUserId'
      | 'createdAt'
      | 'acceptedAt'
      | 'revokedAt'
    >,
  ): WorkspaceInvitationSummary {
    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      email: invitation.email,
      role: invitation.role,
      invitedByUserId: invitation.invitedByUserId,
      createdAt: invitation.createdAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      revokedAt: invitation.revokedAt?.toISOString() ?? null,
    };
  }

  private async createInvitation(
    input: {
      workspaceId: string;
      email: string;
      role: WorkspaceRole;
      invitedByUserId: string;
    },
    db: InvitationDatabase,
  ) {
    try {
      return await db.workspaceInvitation.create({
        data: {
          workspaceId: input.workspaceId,
          email: input.email,
          role: input.role,
          invitedByUserId: input.invitedByUserId,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'There is already a pending invitation for this email.',
        );
      }

      throw error;
    }
  }

  private async ensureNoActiveInvitation(
    workspaceId: string,
    email: string,
    db: InvitationDatabase,
  ) {
    const existingInvitation = await db.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email,
        acceptedAt: null,
        revokedAt: null,
      },
      select: { id: true },
    });

    if (existingInvitation) {
      throw new ConflictException(
        'There is already a pending invitation for this email.',
      );
    }
  }

  private toWorkspaceSummary(
    workspace: Pick<
      Workspace,
      'id' | 'name' | 'slug' | 'createdByUserId' | 'createdAt' | 'updatedAt'
    >,
  ): WorkspaceSummary {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      createdByUserId: workspace.createdByUserId,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
    };
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2002';
  }

  return false;
}
