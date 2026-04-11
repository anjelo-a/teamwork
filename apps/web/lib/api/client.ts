import type {
  AuthPayload,
  AuthMeResponse,
  CreateTaskInput,
  InviteWorkspaceMemberResult,
  PublicWorkspaceInvitationLookup,
  PublicWorkspaceShareLinkLookup,
  RegisterResponse,
  WorkspaceBoardDataResponse,
  UserInvitationsResponse,
  TaskDeleteResponse,
  TaskListResponse,
  TaskResponse,
  TaskAssignmentFilter,
  UpdateTaskAssigneeInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  WorkspaceDeleteResponse,
  WorkspaceInvitationResponse,
  WorkspaceMemberResponse,
  WorkspaceMemberRemovalResponse,
  WorkspaceInvitationsResponse,
  WorkspaceMembersResponse,
  WorkspaceResponse,
  WorkspaceShareLinkResponse,
} from '@teamwork/types';
import {
  parseAuthPayload,
  parseAuthMeResponse,
  parseInviteWorkspaceMemberResult,
  parsePublicWorkspaceInvitationLookup,
  parsePublicWorkspaceShareLinkLookup,
  parseRegisterResponse,
  parseUserInvitationsResponse,
  parseWorkspaceDeleteResponse,
  parseWorkspaceBoardDataResponse,
  parseWorkspaceInvitationResponse,
  parseWorkspaceMemberResponse,
  parseWorkspaceMemberRemovalResponse,
  parseWorkspaceShareLinkResponse,
  parseTaskListResponse,
  parseTaskResponse,
  parseWorkspaceInvitationsResponse,
  parseWorkspaceMembersResponse,
  parseWorkspaceResponse,
} from '@/lib/api/contracts';
import { COOKIE_SESSION_MARKER_PREFIX } from '@/lib/auth/session-constants';

interface ApiRequestOptions<T> {
  accessToken?: string | null;
  parser: (value: unknown) => T;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: string;
  retryOnUnauthorized?: boolean;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function getAuthMe(accessToken?: string | null): Promise<AuthMeResponse> {
  return apiRequest('/auth/me', {
    ...(accessToken === undefined ? {} : { accessToken }),
    parser: parseAuthMeResponse,
  });
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthPayload> {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
    parser: parseAuthPayload,
    retryOnUnauthorized: false,
  });
}

export async function register(input: {
  email: string;
  password: string;
  displayName: string;
  workspaceName?: string;
}): Promise<RegisterResponse> {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
    parser: parseRegisterResponse,
    retryOnUnauthorized: false,
  });
}

export async function refreshAuthSession(): Promise<boolean> {
  const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
    cache: 'no-store',
  });

  if (response.ok) {
    return true;
  }

  if (response.status === 401 || response.status === 403) {
    return false;
  }

  throw new ApiError(await readErrorMessage(response), response.status);
}

export async function logoutAuthSession(): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/auth/logout`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok && response.status !== 401 && response.status !== 403) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }
}

export async function createWorkspace(
  accessToken: string,
  input: { name: string },
): Promise<WorkspaceResponse> {
  return apiRequest('/workspaces', {
    accessToken,
    method: 'POST',
    body: JSON.stringify(input),
    parser: parseWorkspaceResponse,
  });
}

export async function deleteWorkspace(
  workspaceId: string,
  accessToken: string,
): Promise<WorkspaceDeleteResponse> {
  return apiRequest(`/workspaces/${workspaceId}`, {
    accessToken,
    method: 'DELETE',
    parser: parseWorkspaceDeleteResponse,
  });
}

export async function getWorkspaceDetails(
  workspaceId: string,
  accessToken: string,
): Promise<WorkspaceResponse> {
  return apiRequest(`/workspaces/${workspaceId}`, {
    accessToken,
    parser: parseWorkspaceResponse,
  });
}

export async function updateWorkspace(
  workspaceId: string,
  accessToken: string,
  input: {
    name: string;
  },
): Promise<WorkspaceResponse> {
  return apiRequest(`/workspaces/${workspaceId}`, {
    accessToken,
    method: 'PATCH',
    body: JSON.stringify(input),
    parser: parseWorkspaceResponse,
  });
}

export async function getWorkspaceBoardData(
  workspaceId: string,
  accessToken: string,
  filters?: {
    assignment?: TaskAssignmentFilter;
    dueBucket?: 'past_due' | 'today' | 'upcoming' | 'no_date';
    referenceDate?: string | null;
    limit?: number;
    cursor?: string;
    includeMembers?: boolean;
  },
): Promise<WorkspaceBoardDataResponse> {
  const searchParams = buildTaskListSearchParams(filters);
  const queryString = searchParams.toString();
  const path = queryString
    ? `/workspaces/${workspaceId}/board-data?${queryString}`
    : `/workspaces/${workspaceId}/board-data`;

  return apiRequest(path, {
    accessToken,
    parser: parseWorkspaceBoardDataResponse,
  });
}

export async function getWorkspaceMembers(
  workspaceId: string,
  accessToken: string,
): Promise<WorkspaceMembersResponse> {
  return apiRequest(`/workspaces/${workspaceId}/members`, {
    accessToken,
    parser: parseWorkspaceMembersResponse,
  });
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  accessToken: string,
  role: 'owner' | 'member',
): Promise<WorkspaceMemberResponse> {
  return apiRequest(`/workspaces/${workspaceId}/members/${userId}`, {
    accessToken,
    method: 'PATCH',
    body: JSON.stringify({ role }),
    parser: parseWorkspaceMemberResponse,
  });
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string,
  accessToken: string,
): Promise<WorkspaceMemberRemovalResponse> {
  return apiRequest(`/workspaces/${workspaceId}/members/${userId}`, {
    accessToken,
    method: 'DELETE',
    parser: parseWorkspaceMemberRemovalResponse,
  });
}

export async function getWorkspaceInvitations(
  workspaceId: string,
  accessToken: string,
): Promise<WorkspaceInvitationsResponse> {
  return apiRequest(`/workspaces/${workspaceId}/invitations`, {
    accessToken,
    parser: parseWorkspaceInvitationsResponse,
  });
}

export async function getWorkspaceShareLink(
  workspaceId: string,
  accessToken: string,
): Promise<WorkspaceShareLinkResponse> {
  return apiRequest(`/workspaces/${workspaceId}/share-link`, {
    accessToken,
    parser: parseWorkspaceShareLinkResponse,
  });
}

export async function updateWorkspaceShareLink(
  workspaceId: string,
  accessToken: string,
  role: 'member',
): Promise<WorkspaceShareLinkResponse> {
  return apiRequest(`/workspaces/${workspaceId}/share-link`, {
    accessToken,
    method: 'PATCH',
    body: JSON.stringify({ role }),
    parser: parseWorkspaceShareLinkResponse,
  });
}

export async function regenerateWorkspaceShareLink(
  workspaceId: string,
  accessToken: string,
): Promise<WorkspaceShareLinkResponse> {
  return apiRequest(`/workspaces/${workspaceId}/share-link/regenerate`, {
    accessToken,
    method: 'POST',
    parser: parseWorkspaceShareLinkResponse,
  });
}

export async function disableWorkspaceShareLink(
  workspaceId: string,
  accessToken: string,
): Promise<WorkspaceShareLinkResponse> {
  return apiRequest(`/workspaces/${workspaceId}/share-link`, {
    accessToken,
    method: 'DELETE',
    parser: parseWorkspaceShareLinkResponse,
  });
}

export async function listMyInvitationInbox(
  accessToken: string,
): Promise<UserInvitationsResponse> {
  return apiRequest('/users/me/invitations', {
    accessToken,
    parser: parseUserInvitationsResponse,
  });
}

export async function inviteWorkspaceMember(
  workspaceId: string,
  accessToken: string,
  input: {
    email: string;
    role?: 'owner' | 'member';
  },
): Promise<InviteWorkspaceMemberResult> {
  return apiRequest(`/workspaces/${workspaceId}/members`, {
    accessToken,
    method: 'POST',
    body: JSON.stringify(input),
    parser: parseInviteWorkspaceMemberResult,
  });
}

export async function revokeWorkspaceInvitation(
  workspaceId: string,
  invitationId: string,
  accessToken: string,
): Promise<WorkspaceInvitationResponse> {
  return apiRequest(`/workspaces/${workspaceId}/invitations/${invitationId}`, {
    accessToken,
    method: 'DELETE',
    parser: parseWorkspaceInvitationResponse,
  });
}

export async function acceptWorkspaceInvitation(
  invitationId: string,
  accessToken: string,
): Promise<WorkspaceMemberResponse> {
  return apiRequest(`/workspaces/invitations/${invitationId}/accept`, {
    accessToken,
    method: 'POST',
    parser: parseWorkspaceMemberResponse,
  });
}

export async function getPublicWorkspaceInvitation(
  token: string,
): Promise<PublicWorkspaceInvitationLookup> {
  return apiRequest(`/workspace-invitations/token/${encodeURIComponent(token)}`, {
    parser: parsePublicWorkspaceInvitationLookup,
  });
}

export async function acceptWorkspaceInvitationByToken(
  token: string,
  accessToken: string,
): Promise<WorkspaceMemberResponse> {
  return apiRequest(`/workspace-invitations/token/${encodeURIComponent(token)}/accept`, {
    accessToken,
    method: 'POST',
    parser: parseWorkspaceMemberResponse,
  });
}

export async function getPublicWorkspaceShareLink(
  token: string,
): Promise<PublicWorkspaceShareLinkLookup> {
  return apiRequest(`/workspace-share-links/token/${encodeURIComponent(token)}`, {
    parser: parsePublicWorkspaceShareLinkLookup,
  });
}

export async function acceptWorkspaceShareLinkByToken(
  token: string,
  accessToken: string,
): Promise<WorkspaceMemberResponse> {
  return apiRequest(`/workspace-share-links/token/${encodeURIComponent(token)}/accept`, {
    accessToken,
    method: 'POST',
    parser: parseWorkspaceMemberResponse,
  });
}

export async function listInboxTasks(accessToken: string): Promise<TaskListResponse> {
  return apiRequest('/tasks', {
    accessToken,
    parser: parseTaskListResponse,
  });
}

export async function listWorkspaceTasks(
  workspaceId: string,
  accessToken: string,
  filters?: {
    assignment?: TaskAssignmentFilter;
    dueBucket?: 'past_due' | 'today' | 'upcoming' | 'no_date';
    referenceDate?: string | null;
    limit?: number;
    cursor?: string;
    includeMembers?: boolean;
  },
): Promise<TaskListResponse> {
  const searchParams = buildTaskListSearchParams(filters);
  const queryString = searchParams.toString();
  const path = queryString
    ? `/workspaces/${workspaceId}/tasks?${queryString}`
    : `/workspaces/${workspaceId}/tasks`;

  return apiRequest(path, {
    accessToken,
    parser: parseTaskListResponse,
  });
}

function buildTaskListSearchParams(filters?: {
  assignment?: TaskAssignmentFilter;
  dueBucket?: 'past_due' | 'today' | 'upcoming' | 'no_date';
  referenceDate?: string | null;
  limit?: number;
  cursor?: string;
  includeMembers?: boolean;
}): URLSearchParams {
  const searchParams = new URLSearchParams();

  if (!filters) {
    return searchParams;
  }

  if (filters.assignment) {
    searchParams.set('assignment', filters.assignment);
  }

  if (filters.dueBucket) {
    searchParams.set('dueBucket', filters.dueBucket);
  }

  if (filters.referenceDate) {
    searchParams.set('referenceDate', filters.referenceDate);
  }

  if (typeof filters.limit === 'number' && Number.isFinite(filters.limit)) {
    searchParams.set('limit', String(filters.limit));
  }

  if (filters.cursor) {
    searchParams.set('cursor', filters.cursor);
  }

  if (typeof filters.includeMembers === 'boolean') {
    searchParams.set('includeMembers', String(filters.includeMembers));
  }

  return searchParams;
}

export async function createWorkspaceTask(
  workspaceId: string,
  accessToken: string,
  input: CreateTaskInput,
): Promise<TaskResponse> {
  return apiRequest(`/workspaces/${workspaceId}/tasks`, {
    accessToken,
    method: 'POST',
    body: JSON.stringify(input),
    parser: parseTaskResponse,
  });
}

export async function getWorkspaceTaskDetails(
  workspaceId: string,
  taskId: string,
  accessToken: string,
): Promise<TaskResponse> {
  return apiRequest(`/workspaces/${workspaceId}/tasks/${taskId}`, {
    accessToken,
    parser: parseTaskResponse,
  });
}

export async function updateWorkspaceTask(
  workspaceId: string,
  taskId: string,
  accessToken: string,
  input: UpdateTaskInput,
): Promise<TaskResponse> {
  return apiRequest(`/workspaces/${workspaceId}/tasks/${taskId}`, {
    accessToken,
    method: 'PATCH',
    body: JSON.stringify(input),
    parser: parseTaskResponse,
  });
}

export async function updateWorkspaceTaskStatus(
  workspaceId: string,
  taskId: string,
  accessToken: string,
  input: UpdateTaskStatusInput,
): Promise<TaskResponse> {
  return apiRequest(`/workspaces/${workspaceId}/tasks/${taskId}/status`, {
    accessToken,
    method: 'PATCH',
    body: JSON.stringify(input),
    parser: parseTaskResponse,
  });
}

export async function updateWorkspaceTaskAssignee(
  workspaceId: string,
  taskId: string,
  accessToken: string,
  input: UpdateTaskAssigneeInput,
): Promise<TaskResponse> {
  return apiRequest(`/workspaces/${workspaceId}/tasks/${taskId}/assignee`, {
    accessToken,
    method: 'PATCH',
    body: JSON.stringify(input),
    parser: parseTaskResponse,
  });
}

export async function deleteWorkspaceTask(
  workspaceId: string,
  taskId: string,
  accessToken: string,
): Promise<TaskDeleteResponse> {
  return apiRequest(`/workspaces/${workspaceId}/tasks/${taskId}`, {
    accessToken,
    method: 'DELETE',
    parser: parseTaskDeleteResponse,
  });
}

async function apiRequest<T>(path: string, options: ApiRequestOptions<T>): Promise<T> {
  const authorizationHeader = shouldSendBearerToken(options.accessToken)
    ? { Authorization: `Bearer ${options.accessToken}` }
    : {};

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...authorizationHeader,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    credentials: 'include',
    body: options.body ?? null,
    cache: 'no-store',
  });

  if (
    response.status === 401 &&
    options.retryOnUnauthorized !== false &&
    !shouldSendBearerToken(options.accessToken) &&
    path !== '/auth/refresh' &&
    path !== '/auth/login' &&
    path !== '/auth/register'
  ) {
    const refreshed = await refreshAuthSession();

    if (refreshed) {
      return apiRequest(path, {
        ...options,
        retryOnUnauthorized: false,
      });
    }
  }

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  const data: unknown = await response.json();
  return options.parser(data);
}

function parseTaskDeleteResponse(value: unknown): TaskDeleteResponse {
  return parseSuccessResponse(value, 'task delete');
}

function parseSuccessResponse(value: unknown, label: string): { success: true } {
  if (isRecord(value) && value['success'] === true) {
    return { success: true };
  }

  throw new Error(`Expected ${label} response.`);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();

    if (isRecord(data) && 'message' in data) {
      const message = data['message'];

      if (typeof message === 'string') {
        return message;
      }

      if (Array.isArray(message) && message.every((entry) => typeof entry === 'string')) {
        const firstMessage = message[0];

        if (firstMessage) {
          return firstMessage;
        }
      }
    }
  } catch {
    return response.statusText || 'Request failed.';
  }

  return response.statusText || 'Request failed.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getApiBaseUrl(): string {
  const configuredBaseUrl = process.env['NEXT_PUBLIC_API_BASE_URL']?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.endsWith('/')
      ? configuredBaseUrl.slice(0, -1)
      : configuredBaseUrl;
  }

  return 'http://localhost:3000';
}

function shouldSendBearerToken(accessToken?: string | null): accessToken is string {
  if (!accessToken || accessToken.trim().length === 0) {
    return false;
  }

  return !accessToken.startsWith(`${COOKIE_SESSION_MARKER_PREFIX}:`);
}
