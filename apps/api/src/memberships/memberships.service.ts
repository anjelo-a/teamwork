import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  Prisma,
  WorkspaceRole as PrismaWorkspaceRole,
  type User,
  type WorkspaceMembership,
} from '@prisma/client';
import type {
  WorkspaceMemberDetail,
  WorkspaceMembershipSummary,
  WorkspaceRole,
} from '@teamwork/types';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

type MembershipDatabase = Prisma.TransactionClient | PrismaService;

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async createMembership(
    input: {
      workspaceId: string;
      userId: string;
      role: WorkspaceRole;
    },
    db: MembershipDatabase = this.prisma,
  ) {
    try {
      return await db.workspaceMembership.create({
        data: {
          workspaceId: input.workspaceId,
          userId: input.userId,
          role: toPrismaRole(input.role),
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('The user is already a member of this workspace.');
      }

      throw error;
    }
  }

  async requireMembership(
    workspaceId: string,
    userId: string,
    db: MembershipDatabase = this.prisma,
  ) {
    const membership = await db.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not belong to this workspace.');
    }

    return membership;
  }

  async listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberDetail[]> {
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });

    return memberships.map((membership) => this.toDetail(membership, membership.user));
  }

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMemberDetail> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.requireMembership(workspaceId, userId, tx);

      if (membership.role === PrismaWorkspaceRole.owner && role !== 'owner') {
        await this.ensureWorkspaceHasAnotherOwner(workspaceId, userId, tx);
      }

      const updatedMembership = await tx.workspaceMembership.update({
        where: { id: membership.id },
        data: { role: toPrismaRole(role) },
        include: { user: true },
      });

      return this.toDetail(updatedMembership, updatedMembership.user);
    });
  }

  async removeMember(workspaceId: string, userId: string, actingUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.requireMembership(workspaceId, userId, tx);

      if (actingUserId !== userId) {
        const actingMembership = await this.requireMembership(workspaceId, actingUserId, tx);

        if (actingMembership.role !== PrismaWorkspaceRole.owner) {
          throw new ForbiddenException('You do not have permission to remove this member.');
        }
      }

      if (membership.role === PrismaWorkspaceRole.owner) {
        await this.ensureWorkspaceHasAnotherOwner(workspaceId, userId, tx);
      }

      await tx.workspaceMembership.delete({
        where: { id: membership.id },
      });

      return { success: true };
    });
  }

  toSummary(
    membership: Pick<WorkspaceMembership, 'id' | 'workspaceId' | 'userId' | 'role' | 'createdAt'>,
  ): WorkspaceMembershipSummary {
    return {
      id: membership.id,
      workspaceId: membership.workspaceId,
      userId: membership.userId,
      role: membership.role,
      createdAt: membership.createdAt.toISOString(),
    };
  }

  toDetail(
    membership: Pick<WorkspaceMembership, 'id' | 'workspaceId' | 'userId' | 'role' | 'createdAt'>,
    user: Pick<User, 'id' | 'email' | 'displayName' | 'createdAt' | 'updatedAt'>,
  ): WorkspaceMemberDetail {
    return {
      ...this.toSummary(membership),
      user: this.usersService.toSummary(user),
    };
  }

  async ensureWorkspaceHasAnotherOwner(
    workspaceId: string,
    excludedUserId: string,
    db: MembershipDatabase = this.prisma,
  ) {
    const ownerCount = await db.workspaceMembership.count({
      where: {
        workspaceId,
        role: PrismaWorkspaceRole.owner,
        userId: { not: excludedUserId },
      },
    });

    if (ownerCount === 0) {
      throw new BadRequestException('Workspace must keep at least one owner.');
    }
  }
}

function toPrismaRole(role: WorkspaceRole): PrismaWorkspaceRole {
  return role === 'owner' ? PrismaWorkspaceRole.owner : PrismaWorkspaceRole.member;
}

function isUniqueConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2002';
  }

  return false;
}
