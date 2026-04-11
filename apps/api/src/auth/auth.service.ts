import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcrypt';
import { normalizeEmail, normalizeWorkspaceName } from '@teamwork/validation';
import type {
  AuthPayload,
  JwtAccessTokenPayload,
  RegisterResponse,
  UserSummary,
} from '@teamwork/types';
import { isPrismaUniqueConstraintForField } from '../common/utils/prisma-error.util';
import { SecurityTelemetryService } from '../common/security/security-telemetry.service';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipsService } from '../memberships/memberships.service';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { AuthSessionsService } from './auth-sessions.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const PASSWORD_SALT_ROUNDS = 12;
const MAX_WORKSPACE_CREATE_RETRIES = 3;

interface SessionClientMetadata {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuthSessionResult extends AuthPayload {
  refreshToken: string;
  sessionId: string;
}

export interface RefreshedSessionResult {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly authSessionsService: AuthSessionsService,
    private readonly usersService: UsersService,
    private readonly workspacesService: WorkspacesService,
    private readonly membershipsService: MembershipsService,
    private readonly securityTelemetryService: SecurityTelemetryService,
  ) {}

  async register(
    dto: RegisterDto,
    metadata: SessionClientMetadata = {},
  ): Promise<RegisterResponse & AuthSessionResult> {
    const normalizedEmail = normalizeEmail(dto.email);
    const existingUser = await this.usersService.findByEmail(normalizedEmail);

    if (existingUser) {
      this.securityTelemetryService.record({
        category: 'auth',
        eventName: 'auth.register',
        outcome: 'failure',
        ipAddress: metadata.ipAddress ?? null,
        userAgent: metadata.userAgent ?? null,
        details: {
          reason: 'email_conflict',
        },
      });
      throw new ConflictException('A user with that email already exists.');
    }

    const passwordHash = await hash(dto.password, PASSWORD_SALT_ROUNDS);
    const workspaceName = normalizeWorkspaceName(
      dto.workspaceName ?? `${dto.displayName}'s Workspace`,
    );

    const result = await this.runRegisterTransaction(async () =>
      this.prisma.$transaction(async (tx) => {
        const user = await this.usersService.createUser(
          {
            email: normalizedEmail,
            passwordHash,
            displayName: dto.displayName,
          },
          tx,
        );

        const workspace = await this.workspacesService.createWorkspace(
          {
            name: workspaceName,
            createdByUserId: user.id,
          },
          tx,
        );

        const membership = await this.membershipsService.createMembership(
          {
            workspaceId: workspace.id,
            userId: user.id,
            role: 'owner',
          },
          tx,
        );

        return { user, workspace, membership };
      }),
    );

    const userSummary = this.usersService.toSummary(result.user);
    const session = await this.authSessionsService.createSession(result.user.id, metadata);
    const accessToken = await this.createAccessToken(userSummary, session.sessionId);
    const workspaces = await this.workspacesService.listForUser(result.user.id);

    const payload = {
      user: userSummary,
      workspace: this.workspacesService.toSummary(result.workspace),
      memberships: [this.membershipsService.toSummary(result.membership)],
      workspaces,
      accessToken,
      refreshToken: session.refreshToken,
      sessionId: session.sessionId,
    };

    this.securityTelemetryService.record({
      category: 'auth',
      eventName: 'auth.register',
      outcome: 'success',
      actorUserId: result.user.id,
      ipAddress: metadata.ipAddress ?? null,
      userAgent: metadata.userAgent ?? null,
    });

    return payload;
  }

  async login(
    dto: LoginDto,
    metadata: SessionClientMetadata = {},
  ): Promise<AuthSessionResult> {
    const normalizedEmail = normalizeEmail(dto.email);
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      this.securityTelemetryService.record({
        category: 'auth',
        eventName: 'auth.login',
        outcome: 'failure',
        ipAddress: metadata.ipAddress ?? null,
        userAgent: metadata.userAgent ?? null,
        details: {
          reason: 'invalid_credentials',
        },
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      this.securityTelemetryService.record({
        category: 'auth',
        eventName: 'auth.login',
        outcome: 'failure',
        actorUserId: user.id,
        ipAddress: metadata.ipAddress ?? null,
        userAgent: metadata.userAgent ?? null,
        details: {
          reason: 'invalid_credentials',
        },
      });
      throw new UnauthorizedException('Invalid email or password.');
    }

    const userSummary = this.usersService.toSummary(user);
    const session = await this.authSessionsService.createSession(user.id, metadata);
    const accessToken = await this.createAccessToken(userSummary, session.sessionId);
    const workspaces = await this.workspacesService.listForUser(user.id);

    const payload = {
      user: userSummary,
      workspaces,
      accessToken,
      refreshToken: session.refreshToken,
      sessionId: session.sessionId,
    };

    this.securityTelemetryService.record({
      category: 'auth',
      eventName: 'auth.login',
      outcome: 'success',
      actorUserId: user.id,
      ipAddress: metadata.ipAddress ?? null,
      userAgent: metadata.userAgent ?? null,
    });

    return payload;
  }

  async me(userId: string) {
    const user = await this.usersService.getByIdOrThrow(userId);
    const workspaces = await this.workspacesService.listForUser(user.id);

    return {
      user: this.usersService.toSummary(user),
      workspaces,
      activeWorkspace: workspaces[0] ?? null,
    };
  }

  async verifyAccessToken(token: string): Promise<JwtAccessTokenPayload> {
    return this.jwtService.verifyAsync<JwtAccessTokenPayload>(token);
  }

  async refreshSession(
    refreshToken: string,
    metadata: SessionClientMetadata = {},
  ): Promise<RefreshedSessionResult> {
    try {
      const rotatedSession = await this.authSessionsService.rotateSession(refreshToken, metadata);
      const user = await this.usersService.getByIdOrThrow(rotatedSession.userId);
      const userSummary = this.usersService.toSummary(user);
      const accessToken = await this.createAccessToken(userSummary, rotatedSession.sessionId);

      this.securityTelemetryService.record({
        category: 'auth',
        eventName: 'auth.refresh',
        outcome: 'success',
        actorUserId: rotatedSession.userId,
        ipAddress: metadata.ipAddress ?? null,
        userAgent: metadata.userAgent ?? null,
      });

      return {
        accessToken,
        refreshToken: rotatedSession.refreshToken,
        sessionId: rotatedSession.sessionId,
      };
    } catch (error) {
      this.securityTelemetryService.record({
        category: 'auth',
        eventName: 'auth.refresh',
        outcome: 'failure',
        ipAddress: metadata.ipAddress ?? null,
        userAgent: metadata.userAgent ?? null,
        details: {
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
      });
      throw error;
    }
  }

  async logout(input: { accessToken?: string | null; refreshToken?: string | null }): Promise<void> {
    let actorUserId: string | null = null;

    if (input.accessToken) {
      try {
        const payload = await this.verifyAccessToken(input.accessToken);
        actorUserId = payload.sub;
        await this.authSessionsService.revokeSessionById(payload.sessionId, 'logout');
      } catch {
        // Ignore malformed/expired access tokens during logout cleanup.
      }
    }

    if (input.refreshToken) {
      await this.authSessionsService.revokeSessionByRefreshToken(input.refreshToken, 'logout');
    }

    this.securityTelemetryService.record({
      category: 'auth',
      eventName: 'auth.logout',
      outcome: 'success',
      actorUserId,
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.authSessionsService.revokeAllSessionsForUser(userId, 'logout_all');
    this.securityTelemetryService.record({
      category: 'auth',
      eventName: 'auth.logout_all',
      outcome: 'success',
      actorUserId: userId,
    });
  }

  private async createAccessToken(user: UserSummary, sessionId: string): Promise<string> {
    const payload: JwtAccessTokenPayload = {
      sub: user.id,
      sessionId,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      type: 'access',
    };

    return this.jwtService.signAsync(payload);
  }

  private async runRegisterTransaction<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (
          !isPrismaUniqueConstraintForField(error, 'slug') ||
          attempt >= MAX_WORKSPACE_CREATE_RETRIES - 1
        ) {
          throw error;
        }
      }
    }
  }
}
