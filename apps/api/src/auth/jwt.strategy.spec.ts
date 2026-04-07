import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtAccessTokenPayload } from '@teamwork/types';
import { UsersService } from '../users/users.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const now = '2026-03-26T00:00:00.000Z';

  const dbUser = {
    id: 'user-1',
    email: 'alice@example.com',
    passwordHash: 'hash',
    displayName: 'Alice',
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };

  const userSummary = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    createdAt: now,
    updatedAt: now,
  };

  const payload: JwtAccessTokenPayload = {
    sub: 'user-1',
    email: 'alice@example.com',
    type: 'access',
  };

  let usersService: { findById: jest.Mock; toSummary: jest.Mock };
  let strategy: JwtStrategy;

  beforeEach(async () => {
    usersService = {
      findById: jest.fn(),
      toSummary: jest.fn().mockReturnValue(userSummary),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    strategy = moduleRef.get(JwtStrategy);
  });

  it('returns a user summary when the token subject matches an existing user', async () => {
    usersService.findById.mockResolvedValueOnce(dbUser);

    const result = await strategy.validate(payload);

    expect(usersService.findById).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(userSummary);
  });

  it('throws UnauthorizedException when no user is found for the token subject', async () => {
    usersService.findById.mockResolvedValueOnce(null);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
