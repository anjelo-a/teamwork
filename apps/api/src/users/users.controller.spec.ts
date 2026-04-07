import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  const user: RequestUser = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    createdAt: '2026-03-26T00:00:00.000Z',
    updatedAt: '2026-03-26T00:00:00.000Z',
  };

  it('is mounted at /users and protected by jwt auth', () => {
    expect(Reflect.getMetadata(PATH_METADATA, UsersController)).toBe('users');
    expect(Reflect.getMetadata(GUARDS_METADATA, UsersController)).toEqual([JwtAuthGuard]);
  });

  it('getCurrentUser returns the authenticated user wrapped in an object', () => {
    const controller = new UsersController();

    expect(controller.getCurrentUser(user)).toEqual({ user });
  });
});
