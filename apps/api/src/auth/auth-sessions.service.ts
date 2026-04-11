import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
  ROTATED_SESSION_REUSE_REASON,
} from './auth-session.constants';

interface SessionClientMetadata {
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface CreateSessionResult {
  sessionId: string;
  refreshToken: string;
}

@Injectable()
export class AuthSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createSession(
    userId: string,
    metadata: SessionClientMetadata = {},
  ): Promise<CreateSessionResult> {
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);
    const session = await this.authSessionStore.create({
      data: {
        userId,
        refreshTokenHash,
        expiresAt: this.createRefreshTokenExpiry(),
        ipAddressHash: hashNullableValue(metadata.ipAddress),
        userAgentHash: hashNullableValue(metadata.userAgent),
      },
      select: {
        id: true,
      },
    });

    return {
      sessionId: session.id,
      refreshToken,
    };
  }

  async rotateSession(
    refreshToken: string,
    metadata: SessionClientMetadata = {},
  ): Promise<{ userId: string; sessionId: string; refreshToken: string }> {
    const refreshTokenHash = hashToken(refreshToken);
    const now = new Date();
    const existingSession = await this.authSessionStore.findUnique({
      where: { refreshTokenHash },
      select: {
        id: true,
        userId: true,
        revokedAt: true,
        expiresAt: true,
        replacedBySessionId: true,
      },
    });

    if (!existingSession) {
      throw new UnauthorizedException('Session refresh failed.');
    }

    if (existingSession.revokedAt || existingSession.expiresAt.getTime() <= now.getTime()) {
      if (existingSession.replacedBySessionId) {
        await this.revokeAllSessionsForUser(existingSession.userId, ROTATED_SESSION_REUSE_REASON);
      }

      throw new UnauthorizedException('Session refresh failed.');
    }

    const newSession = await this.createSession(existingSession.userId, metadata);

    await this.prisma.$transaction([
      this.authSessionStore.update({
        where: { id: existingSession.id },
        data: {
          revokedAt: now,
          revokeReason: 'rotated',
          replacedBySessionId: newSession.sessionId,
          lastUsedAt: now,
        },
      }),
      this.authSessionStore.update({
        where: { id: newSession.sessionId },
        data: {
          lastUsedAt: now,
        },
      }),
    ]);

    return {
      userId: existingSession.userId,
      sessionId: newSession.sessionId,
      refreshToken: newSession.refreshToken,
    };
  }

  async revokeSessionById(sessionId: string, reason: string): Promise<void> {
    await this.authSessionStore.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
  }

  async revokeSessionByRefreshToken(refreshToken: string, reason: string): Promise<void> {
    await this.authSessionStore.updateMany({
      where: {
        refreshTokenHash: hashToken(refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
  }

  async revokeAllSessionsForUser(userId: string, reason: string): Promise<void> {
    await this.authSessionStore.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
  }

  async assertSessionIsActive(sessionId: string, userId: string): Promise<void> {
    const session = await this.authSessionStore.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Session is no longer active.');
    }
  }

  private createRefreshTokenExpiry(): Date {
    const ttlSeconds =
      this.configService.get<number>('REFRESH_TOKEN_TTL_SECONDS') ??
      DEFAULT_REFRESH_TOKEN_TTL_SECONDS;

    return new Date(Date.now() + ttlSeconds * 1000);
  }

  private get authSessionStore() {
    return this.prisma.authSession;
  }
}

function generateRefreshToken(): string {
  return randomBytes(48).toString('hex');
}

function hashToken(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function hashNullableValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return null;
  }

  return hashToken(normalizedValue);
}
