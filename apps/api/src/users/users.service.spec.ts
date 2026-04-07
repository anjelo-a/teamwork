import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const now = new Date('2026-03-26T00:00:00.000Z');

  const dbUser = {
    id: 'user-1',
    email: 'alice@example.com',
    passwordHash: 'hash',
    displayName: 'Alice',
    createdAt: now,
    updatedAt: now,
  };

  let prisma: {
    user: {
      create: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let service: UsersService;

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('createUser', () => {
    it('creates a user with a trimmed display name', async () => {
      prisma.user.create.mockResolvedValueOnce(dbUser);

      const result = await service.createUser({
        email: 'alice@example.com',
        passwordHash: 'hash',
        displayName: '  Alice  ',
      });

      expect(prisma.user.create).toHaveBeenCalled();
      const [callArg] = prisma.user.create.mock.calls[0] as [{ data: { displayName: string } }];
      expect(callArg.data.displayName).toBe('Alice');
      expect(result.id).toBe('user-1');
    });

    it('normalizes the email before persisting', async () => {
      prisma.user.create.mockResolvedValueOnce(dbUser);

      await service.createUser({
        email: 'Alice@Example.COM',
        passwordHash: 'hash',
        displayName: 'Alice',
      });

      expect(prisma.user.create).toHaveBeenCalled();
      const [callArg] = prisma.user.create.mock.calls[0] as [{ data: { email: string } }];
      expect(callArg.data.email).toBe('alice@example.com');
    });

    it('throws ConflictException when the email is already taken', async () => {
      prisma.user.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: '0.0.0',
        }),
      );

      await expect(
        service.createUser({ email: 'alice@example.com', passwordHash: 'hash', displayName: 'Alice' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('re-throws unknown errors from the database', async () => {
      const dbError = new Error('connection refused');
      prisma.user.create.mockRejectedValueOnce(dbError);

      await expect(
        service.createUser({ email: 'alice@example.com', passwordHash: 'hash', displayName: 'Alice' }),
      ).rejects.toThrow('connection refused');
    });
  });

  describe('findByEmail', () => {
    it('returns the user when found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(dbUser);

      const result = await service.findByEmail('alice@example.com');

      expect(result).toEqual(dbUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'alice@example.com' } }),
      );
    });

    it('normalizes the email before querying', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await service.findByEmail('Alice@Example.COM');

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'alice@example.com' } }),
      );
    });

    it('returns null when not found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const result = await service.findByEmail('nobody@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns the user when found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(dbUser);

      const result = await service.findById('user-1');

      expect(result).toEqual(dbUser);
    });

    it('returns null when not found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      const result = await service.findById('unknown-id');

      expect(result).toBeNull();
    });
  });

  describe('getByIdOrThrow', () => {
    it('returns the user when found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(dbUser);

      const result = await service.getByIdOrThrow('user-1');

      expect(result).toEqual(dbUser);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.getByIdOrThrow('unknown-id')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('toSummary', () => {
    it('serializes dates to ISO strings and excludes passwordHash', () => {
      const summary = service.toSummary(dbUser);

      expect(summary).toEqual({
        id: 'user-1',
        email: 'alice@example.com',
        displayName: 'Alice',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      expect(summary).not.toHaveProperty('passwordHash');
    });
  });
});
