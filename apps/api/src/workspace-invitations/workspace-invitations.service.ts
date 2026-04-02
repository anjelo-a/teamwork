import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma, type WorkspaceInvitation } from '@prisma/client';
import { normalizeEmail } from '@teamwork/validation';
import type {
  InviteWorkspaceMemberResult,
  WorkspaceInvitationSummary,
  WorkspaceRole,
  WorkspaceSummary,
} from '@teamwork/types';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { isPrismaErrorCode } from '../common/utils/prisma-error.util';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

const invitationSummarySelect = {
  id: true,
  workspaceId: true,
  email: true,
  role: true,
  invitedByUserId: true,
  expiresAt: true,
  createdAt: true,
  acceptedAt: true,
  revokedAt: true,
} satisfies Prisma.WorkspaceInvitationSelect;

const workspaceSummarySelect = {
  id: true,
  name: true,
  slug: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WorkspaceSelect;
const invitationWithWorkspaceSelect = {
  ...invitationSummarySelect,
  workspace: {
    select: workspaceSummarySelect,
  },
} satisfies Prisma.WorkspaceInvitationSelect;

type InvitationSummaryRecord = Prisma.WorkspaceInvitationGetPayload<{
  select: typeof invitationSummarySelect;
}>;
type WorkspaceSummaryRecord = Prisma.WorkspaceGetPayload<{
  select: typeof workspaceSummarySelect;
}>;

interface WorkspaceInvitationRepository {
  findMany<T extends Prisma.WorkspaceInvitationFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceInvitationFindManyArgs>,
  ): Promise<Array<Prisma.WorkspaceInvitationGetPayload<T>>>;
  findFirst<T extends Prisma.WorkspaceInvitationFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceInvitationFindFirstArgs>,
  ): Promise<Prisma.WorkspaceInvitationGetPayload<T> | null>;
  create<T extends Prisma.WorkspaceInvitationCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceInvitationCreateArgs>,
  ): Promise<Prisma.WorkspaceInvitationGetPayload<T>>;
  update<T extends Prisma.WorkspaceInvitationUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceInvitationUpdateArgs>,
  ): Promise<Prisma.WorkspaceInvitationGetPayload<T>>;
}

interface WorkspaceMembershipRepository {
  findUnique<T extends Prisma.WorkspaceMembershipFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceMembershipFindUniqueArgs>,
  ): Promise<Prisma.WorkspaceMembershipGetPayload<T> | null>;
}

interface InvitationDatabase {
  workspaceInvitation: WorkspaceInvitationRepository;
  workspaceMembership: WorkspaceMembershipRepository;
}

function toInvitationDatabase(db: Prisma.TransactionClient | PrismaService): InvitationDatabase {
  return {
    workspaceInvitation: db.workspaceInvitation,
    workspaceMembership: db.workspaceMembership,
  };
}

@Injectable()
export class WorkspaceInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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
      const db = toInvitationDatabase(tx);

      await this.ensureNoActiveInvitation(workspaceId, normalizedEmail, db);
      await this.ensureNotAlreadyMember(workspaceId, normalizedEmail, tx);
      const token = createInvitationToken();
      const invitation = await this.createInvitation(
        {
          workspaceId,
          email: normalizedEmail,
          token,
          role,
          invitedByUserId,
        },
        db,
      );

      return {
        kind: 'invitation',
        invitation: this.toSummary(invitation),
        token,
        inviteUrl: this.buildInviteUrl(token),
      };
    });
  }

  async listPendingInvitations(workspaceId: string): Promise<WorkspaceInvitationSummary[]> {
    const invitations = await toInvitationDatabase(this.prisma).workspaceInvitation.findMany({
      where: {
        workspaceId,
        acceptedAt: null,
        revokedAt: null,
      },
      select: invitationSummarySelect,
      orderBy: { createdAt: 'asc' },
    });

    return invitations.map((invitation) => this.toSummary(invitation));
  }

  async listPendingInvitationsForEmail(email: string): Promise<
    Array<{
      invitation: WorkspaceInvitationSummary;
      workspace: WorkspaceSummary;
    }>
  > {
    const normalizedEmail = normalizeEmail(email);
    const invitations = await toInvitationDatabase(this.prisma).workspaceInvitation.findMany({
      where: {
        email: normalizedEmail,
        acceptedAt: null,
        revokedAt: null,
      },
      select: invitationWithWorkspaceSelect,
      orderBy: { createdAt: 'asc' },
    });

    return invitations.map((invitation) => ({
      invitation: this.toSummary(invitation),
      workspace: this.toWorkspaceSummary(invitation.workspace),
    }));
  }

  async revokeInvitation(
    workspaceId: string,
    invitationId: string,
  ): Promise<{ invitation: WorkspaceInvitationSummary }> {
    const invitationStore = toInvitationDatabase(this.prisma).workspaceInvitation;
    const invitation = await invitationStore.findFirst({
      where: {
        id: invitationId,
        workspaceId,
        acceptedAt: null,
        revokedAt: null,
      },
      select: invitationSummarySelect,
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    const revokedInvitation = await invitationStore.update({
      where: { id: invitation.id },
      data: { revokedAt: new Date() },
      select: invitationSummarySelect,
    });

    return {
      invitation: this.toSummary(revokedInvitation),
    };
  }

  async acceptInvitation(
    invitationId: string,
    user: Pick<RequestUser, 'id' | 'email'>,
  ): Promise<{ membership: ReturnType<MembershipsService['toDetail']> }> {
    const normalizedEmail = normalizeEmail(user.email);

    return this.prisma.$transaction(async (tx) => {
      const db = toInvitationDatabase(tx);
      const invitation = await db.workspaceInvitation.findFirst({
        where: {
          id: invitationId,
          acceptedAt: null,
          revokedAt: null,
        },
        select: invitationSummarySelect,
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found.');
      }

      if (invitation.email !== normalizedEmail) {
        throw new ForbiddenException(
          'You cannot accept an invitation for a different email address.',
        );
      }

      const existingMembership = await db.workspaceMembership.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId: user.id,
          },
        },
      });

      if (existingMembership) {
        throw new ConflictException('You are already a member of this workspace.');
      }

      const createdMembership = await this.membershipsService.createMembership(
        {
          workspaceId: invitation.workspaceId,
          userId: user.id,
          role: invitation.role,
        },
        tx,
      );

      await db.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
        select: invitationSummarySelect,
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
      | 'expiresAt'
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
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      revokedAt: invitation.revokedAt?.toISOString() ?? null,
    };
  }

  private async createInvitation(
    input: {
      workspaceId: string;
      email: string;
      token: string;
      role: WorkspaceRole;
      invitedByUserId: string;
    },
    db: InvitationDatabase,
  ): Promise<InvitationSummaryRecord> {
    const expiresAt = this.createInvitationExpiresAt();

    try {
      return await db.workspaceInvitation.create({
        data: {
          workspaceId: input.workspaceId,
          email: input.email,
          tokenHash: createInvitationTokenHash(input.token),
          expiresAt,
          role: input.role,
          invitedByUserId: input.invitedByUserId,
        },
        select: invitationSummarySelect,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('There is already a pending invitation for this email.');
      }

      throw error;
    }
  }

  private async ensureNotAlreadyMember(
    workspaceId: string,
    email: string,
    db: Prisma.TransactionClient | PrismaService,
  ): Promise<void> {
    const existingUser = await this.usersService.findByEmail(email, db);

    if (!existingUser) {
      return;
    }

    const membership = await toInvitationDatabase(db).workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: existingUser.id,
        },
      },
    });

    if (membership) {
      throw new ConflictException('The user is already a member of this workspace.');
    }
  }

  private async ensureNoActiveInvitation(
    workspaceId: string,
    email: string,
    db: InvitationDatabase,
  ): Promise<void> {
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
      throw new ConflictException('There is already a pending invitation for this email.');
    }
  }

  private toWorkspaceSummary(workspace: WorkspaceSummaryRecord): WorkspaceSummary {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      createdByUserId: workspace.createdByUserId,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
    };
  }

  private buildInviteUrl(token: string): string {
    const inviteBaseUrl =
      this.configService.get<string>('INVITE_BASE_URL') ??
      this.configService.get<string>('APP_URL') ??
      'http://localhost:3000';

    return new URL(`/invite/${encodeURIComponent(token)}`, inviteBaseUrl).toString();
  }

  private createInvitationExpiresAt(from = new Date()): Date {
    const inviteTtlDays = this.configService.get<number>('INVITE_TTL_DAYS') ?? 30;
    const expiresAt = new Date(from);
    expiresAt.setDate(expiresAt.getDate() + inviteTtlDays);
    return expiresAt;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return isPrismaErrorCode(error, 'P2002');
}

function createInvitationToken(): string {
  return randomBytes(32).toString('hex');
}

function createInvitationTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
