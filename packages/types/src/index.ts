export type ID = string;

export type WorkspaceRole = 'owner' | 'member';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskDueBucket = 'past_due' | 'today' | 'upcoming' | 'no_date';
export type TaskAssignmentFilter = 'everyone' | 'me' | 'others' | 'unassigned';
export type WorkspaceShareLinkStatus = 'active' | 'revoked' | 'expired';

export interface UserSummary {
  id: ID;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMembershipSummary {
  id: ID;
  workspaceId: ID;
  userId: ID;
  role: WorkspaceRole;
  createdAt: string;
}

export interface WorkspaceMemberDetail extends WorkspaceMembershipSummary {
  user: UserSummary;
}

export interface WorkspaceInvitationSummary {
  id: ID;
  workspaceId: ID;
  email: string;
  role: WorkspaceRole;
  invitedByUserId: ID;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface PublicWorkspaceInvitationSummary {
  id: ID;
  workspaceId: ID;
  role: WorkspaceRole;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export type PublicWorkspaceInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface PublicWorkspaceInvitationLookup {
  invitation: PublicWorkspaceInvitationSummary;
  workspace: WorkspaceSummary;
  status: PublicWorkspaceInvitationStatus;
}

export interface WorkspaceShareLinkSummary {
  id: ID;
  workspaceId: ID;
  role: WorkspaceRole;
  createdByUserId: ID;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: WorkspaceShareLinkStatus;
  url: string | null;
}

export interface PublicWorkspaceShareLinkSummary {
  id: ID;
  workspaceId: ID;
  role: WorkspaceRole;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicWorkspaceShareLinkLookup {
  shareLink: PublicWorkspaceShareLinkSummary;
  workspace: WorkspaceSummary;
  status: WorkspaceShareLinkStatus;
}

export interface WorkspaceSummary {
  id: ID;
  name: string;
  slug: string;
  createdByUserId: ID;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedWorkspace extends WorkspaceSummary {
  membership: WorkspaceMembershipSummary;
}

export interface WorkspaceDetails extends AuthenticatedWorkspace {
  memberCount: number;
  invitationCount: number;
}

export interface TaskSummary {
  id: ID;
  workspaceId: ID;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: TaskStatus;
  createdByUserId: ID;
  assigneeUserId: ID | null;
  createdAt: string;
  updatedAt: string;
  createdByUser: TaskActorSummary;
  assigneeUser: TaskActorSummary | null;
}

export type TaskDetails = TaskSummary;

export interface TaskActorSummary {
  id: ID;
  displayName: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  assigneeUserId?: ID | null;
  dueDate?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
}

export interface UpdateTaskStatusInput {
  status: TaskStatus;
}

export interface UpdateTaskAssigneeInput {
  assigneeUserId: ID | null;
}

export interface TaskResponse {
  task: TaskDetails;
}

export interface TaskListResponse {
  tasks: TaskSummary[];
  limit: number;
  hasMore: boolean;
  nextCursor: ID | null;
}

export interface TaskDeleteResponse {
  success: true;
}

export interface WorkspaceDeleteResponse {
  success: true;
}

export interface WorkspaceMemberRemovalResponse {
  success: true;
}

export interface InviteWorkspaceMemberResult {
  kind: 'invitation';
  invitation: WorkspaceInvitationSummary;
  token: string;
  inviteUrl: string;
}

export interface AuthPayload {
  user: UserSummary;
  workspaces: AuthenticatedWorkspace[];
  accessToken: string;
}

export interface RegisterResponse extends AuthPayload {
  workspace: WorkspaceSummary;
  memberships: WorkspaceMembershipSummary[];
}

export interface AuthMeResponse {
  user: UserSummary;
  workspaces: AuthenticatedWorkspace[];
  activeWorkspace: AuthenticatedWorkspace | null;
}

export interface WorkspacesListResponse {
  workspaces: AuthenticatedWorkspace[];
}

export interface WorkspaceResponse {
  workspace: WorkspaceDetails;
}

export interface WorkspaceMembersResponse {
  members: WorkspaceMemberDetail[];
}

export interface WorkspaceMemberResponse {
  membership: WorkspaceMemberDetail;
}

export interface WorkspaceInvitationResponse {
  invitation: WorkspaceInvitationSummary;
}

export interface WorkspaceShareLinkResponse {
  shareLink: WorkspaceShareLinkSummary;
}

export interface UserInvitationInboxItem {
  invitation: WorkspaceInvitationSummary;
  workspace: WorkspaceSummary;
}

export interface WorkspaceInvitationsResponse {
  invitations: WorkspaceInvitationSummary[];
}

export interface UserInvitationsResponse {
  invitations: UserInvitationInboxItem[];
}

export interface JwtAccessTokenPayload {
  sub: ID;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  type: 'access';
}

export interface WorkspaceBoardDataResponse {
  workspace: WorkspaceDetails;
  members: WorkspaceMemberDetail[];
  membersLoaded: boolean;
  tasks: TaskSummary[];
  limit: number;
  hasMore: boolean;
  nextCursor: ID | null;
}
