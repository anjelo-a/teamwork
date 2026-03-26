import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import type { UserSummary } from '@teamwork/types';
import { normalizeEmail } from '@teamwork/validation';
import { PrismaService } from '../prisma/prisma.service';

type UserDatabase = Prisma.TransactionClient | PrismaService;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(
    input: { email: string; passwordHash: string; displayName: string },
    db: UserDatabase = this.prisma,
  ): Promise<User> {
    try {
      return await db.user.create({
        data: {
          email: normalizeEmail(input.email),
          passwordHash: input.passwordHash,
          displayName: input.displayName.trim(),
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A user with that email already exists.');
      }

      throw error;
    }
  }

  async findByEmail(email: string, db: UserDatabase = this.prisma) {
    return db.user.findUnique({
      where: {
        email: normalizeEmail(email),
      },
    });
  }

  async findById(id: string, db: UserDatabase = this.prisma) {
    return db.user.findUnique({
      where: {
        id,
      },
    });
  }

  async getByIdOrThrow(id: string, db: UserDatabase = this.prisma) {
    const user = await this.findById(id, db);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  toSummary(
    user: Pick<User, 'id' | 'email' | 'displayName' | 'createdAt' | 'updatedAt'>,
  ): UserSummary {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2002';
  }

  return false;
}
