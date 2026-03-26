import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, compare } from 'bcrypt';
import { normalizeEmail, normalizeWorkspaceName } from '@teamwork/validation';
import type { AuthPayload, JwtAccessTokenPayload, RegisterResponse } from '@teamwork/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipsService } from '../memberships/memberships.service';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const PASSWORD_SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly workspacesService: WorkspacesService,
    private readonly membershipsService: MembershipsService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const normalizedEmail = normalizeEmail(dto.email);
    const existingUser = await this.usersService.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new ConflictException('A user with that email already exists.');
    }

    const passwordHash = await hash(dto.password, PASSWORD_SALT_ROUNDS);
    const workspaceName = normalizeWorkspaceName(
      dto.workspaceName ?? `${dto.displayName}'s Workspace`,
    );

    const result = await this.prisma.$transaction(async (tx) => {
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
    });

    const accessToken = await this.createAccessToken(result.user.id, result.user.email);
    const workspaces = await this.workspacesService.listForUser(result.user.id);

    return {
      user: this.usersService.toSummary(result.user),
      workspace: this.workspacesService.toSummary(result.workspace),
      memberships: [this.membershipsService.toSummary(result.membership)],
      workspaces,
      accessToken,
    };
  }

  async login(dto: LoginDto): Promise<AuthPayload> {
    const normalizedEmail = normalizeEmail(dto.email);
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatches = await compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const accessToken = await this.createAccessToken(user.id, user.email);
    const workspaces = await this.workspacesService.listForUser(user.id);

    return {
      user: this.usersService.toSummary(user),
      workspaces,
      accessToken,
    };
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

  private async createAccessToken(userId: string, email: string): Promise<string> {
    const payload: JwtAccessTokenPayload = {
      sub: userId,
      email,
      type: 'access',
    };

    return this.jwtService.signAsync(payload);
  }
}
