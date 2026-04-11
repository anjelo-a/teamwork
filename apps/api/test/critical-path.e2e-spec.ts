import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Critical Path API Integration (e2e)', () => {
  let app: INestApplication;
  let httpServer: App;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0, '127.0.0.1');
    httpServer = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  it('covers invite inbox acceptance and workspace board data access', async () => {
    const owner = await registerUser(app, 'owner-critical');
    const workspaceId = owner.workspace.id;

    const createdTaskResponse = await request(httpServer)
      .post(`/workspaces/${workspaceId}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        title: 'Critical path board task',
      })
      .expect(201);
    const createdTaskBody = createdTaskResponse.body as { task: { id: string; title: string } };
    const createdTask = createdTaskBody.task;
    expect(createdTask.title).toBe('Critical path board task');

    const boardDataResponse = await request(httpServer)
      .get(`/workspaces/${workspaceId}/board-data?includeMembers=true`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const boardDataBody = boardDataResponse.body as {
      workspace: { id: string };
      tasks: Array<{ id: string }>;
    };
    expect(boardDataBody.workspace.id).toBe(workspaceId);
    expect(
      boardDataBody.tasks.some((task) => task.id === createdTask.id),
    ).toBe(true);

    const member = await registerUser(app, 'member-critical');

    const inviteResponse = await request(httpServer)
      .post(`/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        email: member.email,
        role: 'member',
      })
      .expect(201);
    const inviteBody = inviteResponse.body as { invitation: { id: string } };
    const invitationId = inviteBody.invitation.id;
    expect(invitationId).toBeTruthy();

    const inboxResponse = await request(httpServer)
      .get('/users/me/invitations')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(200);
    const inboxBody = inboxResponse.body as {
      invitations: Array<{
        invitation: { id: string; workspaceId: string };
      }>;
    };
    const inboxInvitation = (
      inboxBody.invitations
    ).find((item) => item.invitation.workspaceId === workspaceId);
    expect(inboxInvitation?.invitation.id).toBe(invitationId);

    await request(httpServer)
      .post(`/workspaces/invitations/${invitationId}/accept`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(201);

    const membersResponse = await request(httpServer)
      .get(`/workspaces/${workspaceId}/members`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(200);
    const membersBody = membersResponse.body as { members: Array<{ user: { email: string } }> };
    const memberEmails = membersBody.members.map(
      (workspaceMember) => workspaceMember.user.email,
    );
    expect(memberEmails).toEqual(expect.arrayContaining([owner.email, member.email]));
  });

  it('covers workspace share-link lookup and join acceptance by token', async () => {
    const owner = await registerUser(app, 'owner-share-link');
    const workspaceId = owner.workspace.id;

    const regeneratedShareLinkResponse = await request(httpServer)
      .post(`/workspaces/${workspaceId}/share-link/regenerate`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(201);
    const regeneratedShareLinkBody = regeneratedShareLinkResponse.body as {
      shareLink: { url: string | null };
    };
    const shareLinkUrl = regeneratedShareLinkBody.shareLink.url;
    expect(shareLinkUrl).toBeTruthy();

    const tokenFromUrl = shareLinkUrl?.split('/').pop();
    expect(tokenFromUrl).toBeTruthy();
    if (!tokenFromUrl) {
      throw new Error('Expected a share-link token.');
    }

    await request(httpServer).get(`/workspace-share-links/token/${tokenFromUrl}`).expect(200);

    const joiner = await registerUser(app, 'joiner-share-link');

    await request(httpServer)
      .post(`/workspace-share-links/token/${tokenFromUrl}/accept`)
      .set('Authorization', `Bearer ${joiner.accessToken}`)
      .expect(201);

    const workspaceResponse = await request(httpServer)
      .get(`/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${joiner.accessToken}`)
      .expect(200);
    const workspaceBody = workspaceResponse.body as { workspace: { id: string } };
    expect(workspaceBody.workspace.id).toBe(workspaceId);
  });
});

async function registerUser(
  app: INestApplication,
  prefix: string,
): Promise<{
  accessToken: string;
  email: string;
  workspace: { id: string };
}> {
  const email = createUniqueEmail(prefix);
  const response = await request(app.getHttpServer() as App)
    .post('/auth/register')
    .send({
      displayName: `${prefix} user`,
      email,
      password: 'Passw0rd!',
    })
    .expect(201);
  const registerBody = response.body as { accessToken: string; workspace: { id: string } };

  return {
    accessToken: registerBody.accessToken,
    email,
    workspace: {
      id: registerBody.workspace.id,
    },
  };
}

function createUniqueEmail(prefix: string): string {
  const randomSuffix = `${String(Date.now())}-${Math.random().toString(16).slice(2, 8)}`;
  return `${prefix}-${randomSuffix}@example.com`;
}
