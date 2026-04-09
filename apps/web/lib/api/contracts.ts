import type {
  AuthPayload,
  AuthMeResponse,
  AuthenticatedWorkspace,
  InviteWorkspaceMemberResult,
  PublicWorkspaceInvitationLookup,
  PublicWorkspaceShareLinkLookup,
  RegisterResponse,
  TaskListResponse,
  TaskResponse,
  UserSummary,
  UserInvitationsResponse,
  WorkspaceInvitationSummary,
  WorkspaceInvitationResponse,
  WorkspaceInvitationsResponse,
  WorkspaceDeleteResponse,
  WorkspaceMemberDetail,
  WorkspaceMemberResponse,
  WorkspaceMemberRemovalResponse,
  WorkspaceMembersResponse,
  WorkspaceMembershipSummary,
  WorkspaceResponse,
  WorkspaceShareLinkResponse,
  WorkspaceSummary,
} from '@teamwork/types';

type UnknownRecord = Record<string, unknown>;

export function parseAuthPayload(value: unknown): AuthPayload {
  const record = readRecord(value);

  return {
    user: parseUserSummary(record['user']),
    workspaces: readArray(record['workspaces'], parseAuthenticatedWorkspace),
    accessToken: readString(record['accessToken']),
  };
}

export function parseAuthMeResponse(value: unknown): AuthMeResponse {
  const record = readRecord(value);

  return {
    user: parseUserSummary(record['user']),
    workspaces: readArray(record['workspaces'], parseAuthenticatedWorkspace),
    activeWorkspace: readNullable(record['activeWorkspace'], parseAuthenticatedWorkspace),
  };
}

export function parseWorkspaceResponse(value: unknown): WorkspaceResponse {
  const record = readRecord(value);

  return {
    workspace: parseWorkspaceDetails(record['workspace']),
  };
}

export function parseWorkspaceMembersResponse(value: unknown): WorkspaceMembersResponse {
  const record = readRecord(value);

  return {
    members: readArray(record['members'], parseWorkspaceMemberDetail),
  };
}

export function parseWorkspaceMemberResponse(value: unknown): WorkspaceMemberResponse {
  const record = readRecord(value);

  return {
    membership: parseWorkspaceMemberDetail(record['membership']),
  };
}

export function parseWorkspaceMemberRemovalResponse(
  value: unknown,
): WorkspaceMemberRemovalResponse {
  const record = readRecord(value);

  if (record['success'] === true) {
    return { success: true };
  }

  throw new Error('Expected workspace member removal response.');
}

export function parseWorkspaceDeleteResponse(value: unknown): WorkspaceDeleteResponse {
  const record = readRecord(value);

  if (record['success'] === true) {
    return { success: true };
  }

  throw new Error('Expected workspace delete response.');
}

export function parseWorkspaceInvitationsResponse(
  value: unknown,
): WorkspaceInvitationsResponse {
  const record = readRecord(value);

  return {
    invitations: readArray(record['invitations'], parseWorkspaceInvitationSummary),
  };
}

export function parseUserInvitationsResponse(value: unknown): UserInvitationsResponse {
  const record = readRecord(value);

  return {
    invitations: readArray(record['invitations'], parseUserInvitationInboxItem),
  };
}

export function parseWorkspaceInvitationResponse(
  value: unknown,
): WorkspaceInvitationResponse {
  const record = readRecord(value);

  return {
    invitation: parseWorkspaceInvitationSummary(record['invitation']),
  };
}

export function parseWorkspaceShareLinkResponse(
  value: unknown,
): WorkspaceShareLinkResponse {
  const record = readRecord(value);

  return {
    shareLink: parseWorkspaceShareLinkSummary(record['shareLink']),
  };
}

export function parseInviteWorkspaceMemberResult(
  value: unknown,
): InviteWorkspaceMemberResult {
  const record = readRecord(value);

  return {
    kind: readInviteResultKind(record['kind']),
    invitation: parseWorkspaceInvitationSummary(record['invitation']),
    token: readString(record['token']),
    inviteUrl: readString(record['inviteUrl']),
  };
}

export function parsePublicWorkspaceInvitationLookup(
  value: unknown,
): PublicWorkspaceInvitationLookup {
  const record = readRecord(value);

  return {
    invitation: parsePublicWorkspaceInvitationSummary(record['invitation']),
    workspace: parseWorkspaceSummary(record['workspace']),
    status: readPublicInvitationStatus(record['status']),
  };
}

export function parsePublicWorkspaceShareLinkLookup(
  value: unknown,
): PublicWorkspaceShareLinkLookup {
  const record = readRecord(value);

  return {
    shareLink: parsePublicWorkspaceShareLinkSummary(record['shareLink']),
    workspace: parseWorkspaceSummary(record['workspace']),
    status: readWorkspaceShareLinkStatus(record['status']),
  };
}

export function parseRegisterResponse(value: unknown): RegisterResponse {
  const record = readRecord(value);

  return {
    ...parseAuthPayload(value),
    workspace: parseWorkspaceSummary(record['workspace']),
    memberships: readArray(record['memberships'], parseWorkspaceMembershipSummary),
  };
}

export function parseTaskListResponse(value: unknown): TaskListResponse {
  const record = readRecord(value);

  return {
    tasks: readArray(record['tasks'], parseTaskSummary),
    limit: readNumber(record['limit']),
    hasMore: readBoolean(record['hasMore']),
  };
}

export function parseTaskResponse(value: unknown): TaskResponse {
  const record = readRecord(value);

  return {
    task: parseTaskSummary(record['task']),
  };
}

function parseWorkspaceDetails(value: unknown): WorkspaceResponse['workspace'] {
  const record = readRecord(value);

  return {
    ...parseAuthenticatedWorkspace(record),
    memberCount: readNumber(record['memberCount']),
    invitationCount: readNumber(record['invitationCount']),
  };
}

function parseAuthenticatedWorkspace(value: unknown): AuthenticatedWorkspace {
  const record = readRecord(value);

  return {
    ...parseWorkspaceSummary(record),
    membership: parseWorkspaceMembershipSummary(record['membership']),
  };
}

function parseWorkspaceSummary(value: unknown): WorkspaceSummary {
  const record = readRecord(value);

  return {
    id: readString(record['id']),
    name: readString(record['name']),
    slug: readString(record['slug']),
    createdByUserId: readString(record['createdByUserId']),
    createdAt: readString(record['createdAt']),
    updatedAt: readString(record['updatedAt']),
  };
}

function parseWorkspaceMembershipSummary(value: unknown): WorkspaceMembershipSummary {
  const record = readRecord(value);

  return {
    id: readString(record['id']),
    workspaceId: readString(record['workspaceId']),
    userId: readString(record['userId']),
    role: readWorkspaceRole(record['role']),
    createdAt: readString(record['createdAt']),
  };
}

function parseWorkspaceMemberDetail(value: unknown): WorkspaceMemberDetail {
  const record = readRecord(value);

  return {
    ...parseWorkspaceMembershipSummary(record),
    user: parseUserSummary(record['user']),
  };
}

function parseWorkspaceInvitationSummary(value: unknown): WorkspaceInvitationSummary {
  const record = readRecord(value);

  return {
    id: readString(record['id']),
    workspaceId: readString(record['workspaceId']),
    email: readString(record['email']),
    role: readWorkspaceRole(record['role']),
    invitedByUserId: readString(record['invitedByUserId']),
    expiresAt: readString(record['expiresAt']),
    createdAt: readString(record['createdAt']),
    acceptedAt: readNullableString(record['acceptedAt']),
    revokedAt: readNullableString(record['revokedAt']),
  };
}

function parsePublicWorkspaceInvitationSummary(
  value: unknown,
): PublicWorkspaceInvitationLookup['invitation'] {
  const record = readRecord(value);

  return {
    id: readString(record['id']),
    workspaceId: readString(record['workspaceId']),
    role: readWorkspaceRole(record['role']),
    expiresAt: readString(record['expiresAt']),
    createdAt: readString(record['createdAt']),
    acceptedAt: readNullableString(record['acceptedAt']),
    revokedAt: readNullableString(record['revokedAt']),
  };
}

function parseWorkspaceShareLinkSummary(
  value: unknown,
): WorkspaceShareLinkResponse['shareLink'] {
  const record = readRecord(value);

  return {
    id: readString(record['id']),
    workspaceId: readString(record['workspaceId']),
    role: readWorkspaceRole(record['role']),
    createdByUserId: readString(record['createdByUserId']),
    expiresAt: readString(record['expiresAt']),
    revokedAt: readNullableString(record['revokedAt']),
    lastUsedAt: readNullableString(record['lastUsedAt']),
    createdAt: readString(record['createdAt']),
    updatedAt: readString(record['updatedAt']),
    status: readWorkspaceShareLinkStatus(record['status']),
    url: readNullableString(record['url']),
  };
}

function parsePublicWorkspaceShareLinkSummary(
  value: unknown,
): PublicWorkspaceShareLinkLookup['shareLink'] {
  const record = readRecord(value);

  return {
    id: readString(record['id']),
    workspaceId: readString(record['workspaceId']),
    role: readWorkspaceRole(record['role']),
    expiresAt: readString(record['expiresAt']),
    revokedAt: readNullableString(record['revokedAt']),
    lastUsedAt: readNullableString(record['lastUsedAt']),
    createdAt: readString(record['createdAt']),
    updatedAt: readString(record['updatedAt']),
  };
}

function parseUserInvitationInboxItem(
  value: unknown,
): UserInvitationsResponse['invitations'][number] {
  const record = readRecord(value);

  return {
    invitation: parseWorkspaceInvitationSummary(record['invitation']),
    workspace: parseWorkspaceSummary(record['workspace']),
  };
}

function parseUserSummary(value: unknown): UserSummary {
  const record = readRecord(value);

  return {
    id: readString(record['id']),
    email: readString(record['email']),
    displayName: readString(record['displayName']),
    createdAt: readString(record['createdAt']),
    updatedAt: readString(record['updatedAt']),
  };
}

function parseTaskSummary(value: unknown): TaskListResponse['tasks'][number] {
  const record = readRecord(value);

  return {
    id: readString(record['id']),
    workspaceId: readString(record['workspaceId']),
    title: readString(record['title']),
    description: readNullableString(record['description']),
    dueDate: readNullableString(record['dueDate']),
    status: readTaskStatus(record['status']),
    createdByUserId: readString(record['createdByUserId']),
    assigneeUserId: readNullableString(record['assigneeUserId']),
    createdAt: readString(record['createdAt']),
    updatedAt: readString(record['updatedAt']),
    createdByUser: parseUserSummary(record['createdByUser']),
    assigneeUser: readNullable(record['assigneeUser'], parseUserSummary),
  };
}

function readRecord(value: unknown): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected object response.');
  }

  return Object.fromEntries(Object.entries(value));
}

function readString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Expected string value.');
  }

  return value;
}

function readNullableString(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  return readString(value);
}

function readNumber(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error('Expected number value.');
  }

  return value;
}

function readWorkspaceShareLinkStatus(
  value: unknown,
): PublicWorkspaceShareLinkLookup['status'] {
  if (value === 'active' || value === 'revoked' || value === 'expired') {
    return value;
  }

  throw new Error('Expected workspace share link status value.');
}

function readBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new Error('Expected boolean value.');
  }

  return value;
}

function readArray<T>(value: unknown, itemParser: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected array value.');
  }

  return value.map((item) => itemParser(item));
}

function readNullable<T>(value: unknown, parser: (input: unknown) => T): T | null {
  if (value === null) {
    return null;
  }

  return parser(value);
}

function readWorkspaceRole(value: unknown): WorkspaceMembershipSummary['role'] {
  if (value === 'owner' || value === 'member') {
    return value;
  }

  throw new Error('Expected workspace role.');
}

function readTaskStatus(value: unknown): TaskListResponse['tasks'][number]['status'] {
  if (value === 'todo' || value === 'in_progress' || value === 'done') {
    return value;
  }

  throw new Error('Expected task status.');
}

function readInviteResultKind(
  value: unknown,
): InviteWorkspaceMemberResult['kind'] {
  if (value === 'invitation') {
    return value;
  }

  throw new Error('Expected invite result kind.');
}

function readPublicInvitationStatus(
  value: unknown,
): PublicWorkspaceInvitationLookup['status'] {
  if (value === 'pending' || value === 'accepted' || value === 'revoked' || value === 'expired') {
    return value;
  }

  throw new Error('Expected public invitation status.');
}
