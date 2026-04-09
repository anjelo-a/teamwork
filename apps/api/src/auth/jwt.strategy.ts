import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtAccessTokenPayload, UserSummary } from '@teamwork/types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'teamwork-dev-secret-change-me',
    });
  }

  async validate(payload: JwtAccessTokenPayload): Promise<UserSummary> {
    if (
      typeof payload.displayName !== 'string' ||
      payload.displayName.trim().length === 0 ||
      typeof payload.createdAt !== 'string' ||
      payload.createdAt.trim().length === 0 ||
      typeof payload.updatedAt !== 'string' ||
      payload.updatedAt.trim().length === 0
    ) {
      throw new UnauthorizedException('Invalid authentication token.');
    }

    return {
      id: payload.sub,
      email: payload.email,
      displayName: payload.displayName,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    };
  }
}
