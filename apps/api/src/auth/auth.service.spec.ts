import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { hash } from 'bcrypt';
import { SecurityTelemetryService } from '../common/security/security-telemetry.service';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { AuthSessionsService } from './auth-sessions.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const now = new Date('2026-03-26T00:00:00.000Z');
  const nowIso = now.toISOString();

  const dbUser = {
    id: 'user-1',
    email: 'alice@example.com',
    passwordHash: '$2b$12$hashedpassword',
    displayName: 'Alice',
    createdAt: now,
    updatedAt: now,
  };

  const userSummary = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const workspaceSummary = {
    id: 'workspace-1',
    name: 'Alice\'s Workspace',
    slug: 'alices-workspace',
    createdByUserId: 'user-1',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const membershipSummary = {
    id: 'membership-1',
    workspaceId: 'workspace-1',
    userId: 'user-1',
    role: 'owner',
    createdAt: nowIso,
  };

  const authenticatedWorkspace = { ...workspaceSummary, membership: membershipSummary };

  let prisma: { $transaction: jest.Mock };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let authSessionsService: {
    createSession: jest.Mock;
    rotateSession: jest.Mock;
    revokeSessionById: jest.Mock;
    revokeSessionByRefreshToken: jest.Mock;
    revokeAllSessionsForUser: jest.Mock;
  };
  let usersService: { findByEmail: jest.Mock; createUser: jest.Mock; toSummary: jest.Mock; getByIdOrThrow: jest.Mock };
  let workspacesService: {
    createWorkspace: jest.Mock;
    listForUser: jest.Mock;
    toSummary: jest.Mock;
  };
  let membershipsService: { createMembership: jest.Mock; toSummary: jest.Mock };
  let securityTelemetryService: { record: jest.Mock };
  let service: AuthService;

  beforeEach(async () => {
    const runInTransaction = <T>(callback: (tx: typeof prisma) => Promise<T>) => callback(prisma);

    prisma = { $transaction: jest.fn(runInTransaction) };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    };
    authSessionsService = {
      createSession: jest.fn().mockResolvedValue({
        sessionId: 'session-1',
        refreshToken: 'refresh-token',
      }),
      rotateSession: jest.fn(),
      revokeSessionById: jest.fn(),
      revokeSessionByRefreshToken: jest.fn(),
      revokeAllSessionsForUser: jest.fn(),
    };
    usersService = {
      findByEmail: jest.fn(),
      createUser: jest.fn(),
      toSummary: jest.fn().mockReturnValue(userSummary),
      getByIdOrThrow: jest.fn(),
    };
    workspacesService = {
      createWorkspace: jest.fn(),
      listForUser: jest.fn().mockResolvedValue([authenticatedWorkspace]),
      toSummary: jest.fn().mockReturnValue(workspaceSummary),
    };
    membershipsService = {
      createMembership: jest.fn(),
      toSummary: jest.fn().mockReturnValue(membershipSummary),
    };
    securityTelemetryService = {
      record: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: AuthSessionsService, useValue: authSessionsService },
        { provide: UsersService, useValue: usersService },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: MembershipsService, useValue: membershipsService },
        { provide: SecurityTelemetryService, useValue: securityTelemetryService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    const registerDto = {
      email: 'alice@example.com',
      password: 'password123',
      displayName: 'Alice',
    };

    it('creates a user, workspace, and membership in one transaction then returns auth payload', async () => {
      usersService.findByEmail.mockResolvedValueOnce(null);
      usersService.createUser.mockResolvedValueOnce(dbUser);
      workspacesService.createWorkspace.mockResolvedValueOnce({
        id: 'workspace-1',
        name: "Alice's Workspace",
        slug: 'alices-workspace',
        createdByUserId: 'user-1',
        createdAt: now,
        updatedAt: now,
      });
      membershipsService.createMembership.mockResolvedValueOnce({
        id: 'membership-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'owner',
        createdAt: now,
      });

      const result = await service.register(registerDto);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(usersService.createUser).toHaveBeenCalled();
      expect(workspacesService.createWorkspace).toHaveBeenCalled();
      expect(membershipsService.createMembership).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'owner' }),
        expect.anything(),
      );
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.sessionId).toBe('session-1');
      expect(authSessionsService.createSession).toHaveBeenCalledWith('user-1', {});
      expect(result.user).toEqual(userSummary);
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: userSummary.id,
        sessionId: 'session-1',
        email: userSummary.email,
        displayName: userSummary.displayName,
        createdAt: userSummary.createdAt,
        updatedAt: userSummary.updatedAt,
        type: 'access',
      });
    });

    it('generates a default workspace name from the displayName when workspaceName is omitted', async () => {
      usersService.findByEmail.mockResolvedValueOnce(null);
      usersService.createUser.mockResolvedValueOnce(dbUser);
      workspacesService.createWorkspace.mockResolvedValueOnce({
        id: 'workspace-1',
        name: "Alice's Workspace",
        slug: 'alices-workspace',
        createdByUserId: 'user-1',
        createdAt: now,
        updatedAt: now,
      });
      membershipsService.createMembership.mockResolvedValueOnce({
        id: 'membership-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'owner',
        createdAt: now,
      });

      await service.register(registerDto);

      expect(workspacesService.createWorkspace).toHaveBeenCalled();
      const [callArg] = workspacesService.createWorkspace.mock.calls[0] as [{ name: string }];
      expect(callArg.name).toContain('Alice');
    });

    it('uses the provided workspaceName when given', async () => {
      usersService.findByEmail.mockResolvedValueOnce(null);
      usersService.createUser.mockResolvedValueOnce(dbUser);
      workspacesService.createWorkspace.mockResolvedValueOnce({
        id: 'workspace-1',
        name: 'My Team',
        slug: 'my-team',
        createdByUserId: 'user-1',
        createdAt: now,
        updatedAt: now,
      });
      membershipsService.createMembership.mockResolvedValueOnce({
        id: 'membership-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'owner',
        createdAt: now,
      });

      await service.register({ ...registerDto, workspaceName: 'My Team' });

      expect(workspacesService.createWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Team' }),
        expect.anything(),
      );
    });

    it('throws ConflictException when a user with that email already exists', async () => {
      usersService.findByEmail.mockResolvedValueOnce(dbUser);

      await expect(service.register(registerDto)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('retries the transaction when a slug unique-constraint race occurs', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createUser.mockResolvedValue(dbUser);
      workspacesService.createWorkspace.mockResolvedValue({
        id: 'workspace-1',
        name: "Alice's Workspace",
        slug: 'alices-workspace',
        createdByUserId: 'user-1',
        createdAt: now,
        updatedAt: now,
      });
      membershipsService.createMembership.mockResolvedValue({
        id: 'membership-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'owner',
        createdAt: now,
      });

      const slugError = { code: 'P2002', meta: { target: ['slug'] } };
      prisma.$transaction
        .mockRejectedValueOnce(slugError)
        .mockImplementationOnce(
          async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma),
        );

      const result = await service.register(registerDto);

      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBe('signed-token');
    });

    it('re-throws the error when retries are exhausted', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const slugError = { code: 'P2002', meta: { target: ['slug'] } };
      prisma.$transaction.mockRejectedValue(slugError);

      await expect(service.register(registerDto)).rejects.toEqual(slugError);
      expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    });

    it('does not retry for non-slug unique constraint errors', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const emailError = { code: 'P2002', meta: { target: ['email'] } };
      prisma.$transaction.mockRejectedValueOnce(emailError);

      await expect(service.register(registerDto)).rejects.toEqual(emailError);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    it('returns an auth payload with access token on valid credentials', async () => {
      const passwordHash = await hash('password123', 10);
      usersService.findByEmail.mockResolvedValueOnce({ ...dbUser, passwordHash });

      const result = await service.login({
        email: 'alice@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.sessionId).toBe('session-1');
      expect(result.user).toEqual(userSummary);
      expect(result.workspaces).toEqual([authenticatedWorkspace]);
    });

    it('throws UnauthorizedException when the email is not found', async () => {
      usersService.findByEmail.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      const passwordHash = await hash('correct-password', 10);
      usersService.findByEmail.mockResolvedValueOnce({ ...dbUser, passwordHash });

      await expect(
        service.login({ email: 'alice@example.com', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('normalizes the email before looking up the user', async () => {
      usersService.findByEmail.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'Alice@Example.COM', password: 'pw' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(usersService.findByEmail).toHaveBeenCalledWith('alice@example.com');
    });
  });

  describe('me', () => {
    it('returns the current user, workspaces, and active workspace', async () => {
      usersService.getByIdOrThrow.mockResolvedValueOnce(dbUser);

      const result = await service.me('user-1');

      expect(usersService.getByIdOrThrow).toHaveBeenCalledWith('user-1');
      expect(result.user).toEqual(userSummary);
      expect(result.workspaces).toEqual([authenticatedWorkspace]);
      expect(result.activeWorkspace).toEqual(authenticatedWorkspace);
    });

    it('returns null for activeWorkspace when the user has no workspaces', async () => {
      usersService.getByIdOrThrow.mockResolvedValueOnce(dbUser);
      workspacesService.listForUser.mockResolvedValueOnce([]);

      const result = await service.me('user-1');

      expect(result.activeWorkspace).toBeNull();
    });
  });

  describe('verifyAccessToken', () => {
    it('returns the decoded payload on a valid token', async () => {
      const decoded = {
        sub: 'user-1',
        sessionId: 'session-1',
        email: 'alice@example.com',
        displayName: 'Alice',
        createdAt: nowIso,
        updatedAt: nowIso,
        type: 'access',
      };
      jwtService.verifyAsync.mockResolvedValueOnce(decoded);

      const result = await service.verifyAccessToken('valid-token');

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token');
      expect(result).toEqual(decoded);
    });

    it('re-throws when the token is invalid', async () => {
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('invalid signature'));

      await expect(service.verifyAccessToken('bad-token')).rejects.toThrow('invalid signature');
    });
  });

  describe('session lifecycle', () => {
    it('refreshSession rotates refresh token and signs a new access token', async () => {
      authSessionsService.rotateSession.mockResolvedValueOnce({
        userId: 'user-1',
        sessionId: 'session-2',
        refreshToken: 'next-refresh-token',
      });
      usersService.getByIdOrThrow.mockResolvedValueOnce(dbUser);

      const result = await service.refreshSession('refresh-token');

      expect(authSessionsService.rotateSession).toHaveBeenCalledWith('refresh-token', {});
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        sessionId: 'session-2',
        email: 'alice@example.com',
        displayName: 'Alice',
        createdAt: nowIso,
        updatedAt: nowIso,
        type: 'access',
      });
      expect(result).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'next-refresh-token',
        sessionId: 'session-2',
      });
    });

    it('logout revokes both access and refresh token sessions when present', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        sub: 'user-1',
        sessionId: 'session-1',
        email: 'alice@example.com',
        displayName: 'Alice',
        createdAt: nowIso,
        updatedAt: nowIso,
        type: 'access',
      });

      await service.logout({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      expect(authSessionsService.revokeSessionById).toHaveBeenCalledWith('session-1', 'logout');
      expect(authSessionsService.revokeSessionByRefreshToken).toHaveBeenCalledWith(
        'refresh-token',
        'logout',
      );
    });

    it('logoutAll revokes all active sessions for a user', async () => {
      await service.logoutAll('user-1');

      expect(authSessionsService.revokeAllSessionsForUser).toHaveBeenCalledWith(
        'user-1',
        'logout_all',
      );
    });
  });
});
