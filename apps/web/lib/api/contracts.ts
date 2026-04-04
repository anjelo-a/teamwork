import type {
  AuthMeResponse,
  AuthenticatedWorkspace,
  TaskListResponse,
  TaskResponse,
  UserSummary,
  WorkspaceInvitationSummary,
  WorkspaceInvitationsResponse,
  WorkspaceMemberDetail,
  WorkspaceMemberResponse,
  WorkspaceMembersResponse,
  WorkspaceMembershipSummary,
  WorkspaceResponse,
  WorkspaceSummary,
} from '@teamwork/types';

type UnknownRecord = Record<string, unknown>;

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

export function parseWorkspaceInvitationsResponse(
  value: unknown,
): WorkspaceInvitationsResponse {
  const record = readRecord(value);

  return {
    invitations: readArray(record['invitations'], parseWorkspaceInvitationSummary),
  };
}

export function parseTaskListResponse(value: unknown): TaskListResponse {
  const record = readRecord(value);

  return {
    tasks: readArray(record['tasks'], parseTaskSummary),
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
