import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import type { JwtAccessTokenPayload } from '@teamwork/types';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { readBearerToken, readCookie } from './auth-cookie.util';
import { ACCESS_TOKEN_COOKIE_NAME } from './auth-session.constants';
import { AuthSessionsService } from './auth-sessions.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authSessionsService: AuthSessionsService,
  ) {
    super({
      jwtFromRequest: (request: Request): string | null =>
        readBearerToken(request) ?? readCookie(request, ACCESS_TOKEN_COOKIE_NAME),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'teamwork-dev-secret-change-me',
    });
  }

  async validate(payload: JwtAccessTokenPayload): Promise<RequestUser> {
    if (
      typeof payload.sessionId !== 'string' ||
      payload.sessionId.trim().length === 0 ||
      typeof payload.displayName !== 'string' ||
      payload.displayName.trim().length === 0 ||
      typeof payload.createdAt !== 'string' ||
      payload.createdAt.trim().length === 0 ||
      typeof payload.updatedAt !== 'string' ||
      payload.updatedAt.trim().length === 0
    ) {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    await this.authSessionsService.assertSessionIsActive(payload.sessionId, payload.sub);

    return {
      id: payload.sub,
      email: payload.email,
      displayName: payload.displayName,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
      sessionId: payload.sessionId,
    };
  }
}
