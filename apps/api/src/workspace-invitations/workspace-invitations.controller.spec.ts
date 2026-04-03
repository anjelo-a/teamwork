import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { WorkspaceInvitationsController } from './workspace-invitations.controller';

describe('WorkspaceInvitationsController', () => {
  const user: RequestUser = {
    id: 'user-1',
    email: 'invitee@example.com',
    displayName: 'Invitee',
    createdAt: '2026-03-26T00:00:00.000Z',
    updatedAt: '2026-03-26T00:00:00.000Z',
  };

  let controller: WorkspaceInvitationsController;
  let workspaceInvitationsService: {
    getInvitationByToken: jest.Mock;
    listPendingInvitationsForEmail: jest.Mock;
    acceptInvitation: jest.Mock;
    acceptInvitationByToken: jest.Mock;
  };

  beforeEach(() => {
    workspaceInvitationsService = {
      getInvitationByToken: jest.fn(),
      listPendingInvitationsForEmail: jest.fn(),
      acceptInvitation: jest.fn(),
      acceptInvitationByToken: jest.fn(),
    };

    controller = new WorkspaceInvitationsController(workspaceInvitationsService as never);
  });

  it('is mounted at the app root and protected by jwt auth', () => {
    expect(Reflect.getMetadata(PATH_METADATA, WorkspaceInvitationsController)).toBe('/');
    expect(Reflect.getMetadata(GUARDS_METADATA, WorkspaceInvitationsController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  it('accepts an invitation by token through the service', async () => {
    workspaceInvitationsService.acceptInvitationByToken.mockResolvedValueOnce({
      membership: { id: 'membership-1' },
    });

    await expect(controller.acceptInvitationByToken(user, 'plain-token')).resolves.toEqual({
      membership: { id: 'membership-1' },
    });
    expect(workspaceInvitationsService.acceptInvitationByToken).toHaveBeenCalledWith(
      'plain-token',
      user,
    );
  });
});
