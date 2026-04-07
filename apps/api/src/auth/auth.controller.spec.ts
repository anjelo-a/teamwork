import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const user: RequestUser = {
    id: 'user-1',
    email: 'alice@example.com',
    displayName: 'Alice',
    createdAt: '2026-03-26T00:00:00.000Z',
    updatedAt: '2026-03-26T00:00:00.000Z',
  };

  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    me: jest.Mock;
  };

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      me: jest.fn(),
    };

    controller = new AuthController(authService as never);
  });

  it('is mounted at /auth', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AuthController)).toBe('auth');
  });

  describe('register', () => {
    it('is public', () => {
      expect(
        Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.register),
      ).toBe(true);
    });

    it('is a POST endpoint', () => {
      expect(
        Reflect.getMetadata(METHOD_METADATA, AuthController.prototype.register),
      ).toBe(RequestMethod.POST);
    });

    it('delegates to authService.register and returns the result', async () => {
      const dto = { email: 'alice@example.com', password: 'password1', displayName: 'Alice' };
      const response = { accessToken: 'token', user: { id: 'user-1' } };
      authService.register.mockResolvedValueOnce(response);

      await expect(controller.register(dto as never)).resolves.toEqual(response);
      expect(authService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('is public', () => {
      expect(
        Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.login),
      ).toBe(true);
    });

    it('is a POST endpoint', () => {
      expect(
        Reflect.getMetadata(METHOD_METADATA, AuthController.prototype.login),
      ).toBe(RequestMethod.POST);
    });

    it('delegates to authService.login and returns the result', async () => {
      const dto = { email: 'alice@example.com', password: 'password1' };
      const response = { accessToken: 'token', user: { id: 'user-1' }, workspaces: [] };
      authService.login.mockResolvedValueOnce(response);

      await expect(controller.login(dto as never)).resolves.toEqual(response);
      expect(authService.login).toHaveBeenCalledWith(dto);
    });
  });

  describe('me', () => {
    it('is protected by JwtAuthGuard', () => {
      expect(
        Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.me),
      ).toEqual([JwtAuthGuard]);
    });

    it('is a GET endpoint', () => {
      expect(
        Reflect.getMetadata(METHOD_METADATA, AuthController.prototype.me),
      ).toBe(RequestMethod.GET);
    });

    it('delegates to authService.me with the current user id and returns the result', async () => {
      const response = { user: { id: 'user-1' }, workspaces: [], activeWorkspace: null };
      authService.me.mockResolvedValueOnce(response);

      await expect(controller.me(user)).resolves.toEqual(response);
      expect(authService.me).toHaveBeenCalledWith('user-1');
    });
  });
});
