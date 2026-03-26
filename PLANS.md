# PLANS.md

## Feature: Authentication and Workspace Access Control

## Overview

This feature establishes the authentication and authorization foundation for TeamWork. It includes user registration, login, JWT-based authentication, and workspace-level role-based access control (RBAC). The system is designed to support multi-user collaboration with a clear separation between identity, workspace ownership, and membership roles.

## Scope

Included:

* User registration and login
* Password hashing and verification
* JWT-based authentication (access token only for phase 1)
* Workspace creation during registration
* Workspace membership system with roles (owner, member)
* Protected API routes with authentication and authorization guards
* Foundation for Socket.IO authentication reuse

Excluded:

* Refresh tokens (future phase)
* Social login providers
* Fine-grained permissions beyond workspace-level RBAC
* Rich collaborative editing logic

## Architecture Impact

Backend modules to be introduced:

* database
* users
* workspaces
* memberships
* auth
* common/auth (guards, decorators, RBAC helpers)

Responsibilities:

* users: user creation, lookup, email normalization, public profile shape
* workspaces: workspace creation and retrieval
* memberships: workspace membership management and role checks
* auth: registration, login, password verification, JWT issuance
* common/auth: JwtAuthGuard, WorkspaceMemberGuard, WorkspaceRoleGuard, decorators

This structure ensures separation of concerns and prepares the system for future real-time collaboration features.

## Data Flow

### Registration

1. Client submits registration form to `POST /auth/register`
2. Server normalizes email (lowercase, trimmed)
3. Server validates uniqueness of email
4. Server hashes password using bcrypt
5. Server starts database transaction
6. Server creates user
7. Server creates default workspace
8. Server creates owner membership
9. Server commits transaction
10. Server issues JWT and returns auth payload

### Login

1. Client submits credentials to `POST /auth/login`
2. Server normalizes email
3. Server retrieves user by email
4. Server compares password with stored hash
5. Server returns access token and workspace list

### Protected Requests

1. Client sends request with `Authorization: Bearer <token>`
2. JwtAuthGuard verifies token and attaches user
3. WorkspaceMemberGuard verifies membership using database
4. WorkspaceRoleGuard enforces role where required
5. Controller executes

### Future Socket Flow

* Client connects with token in handshake auth
* Server verifies JWT using same auth service
* Server validates workspace membership before allowing room join

## API / Event Design

### Auth Endpoints

* POST `/auth/register`

  * request: { email, password, displayName, workspaceName? }
  * response: { user, workspace, memberships, accessToken }

* POST `/auth/login`

  * request: { email, password }
  * response: { user, workspaces, accessToken }

* GET `/auth/me`

  * protected
  * response: { user, workspaces, activeWorkspace? }

### User / Workspace Endpoints

* GET `/users/me`
* GET `/workspaces`
* POST `/workspaces`
* GET `/workspaces/:workspaceId`
* GET `/workspaces/:workspaceId/members`
* POST `/workspaces/:workspaceId/members`
* PATCH `/workspaces/:workspaceId/members/:userId`
* DELETE `/workspaces/:workspaceId/members/:userId`

All workspace routes require authentication and membership validation.

## Database Impact

### Tables

users

* id (uuid, pk)
* email (unique, lowercase)
* password_hash
* display_name
* created_at, updated_at

workspaces

* id (uuid, pk)
* name
* slug (unique)
* created_by_user_id (fk → users.id)
* created_at, updated_at

workspace_memberships

* id (uuid, pk)
* workspace_id (fk → workspaces.id)
* user_id (fk → users.id)
* role (enum: owner | member)
* created_at
* unique (workspace_id, user_id)

### Constraints and Rules

* email must be unique and normalized
* passwords must never be stored in plaintext
* one user can belong to multiple workspaces
* one workspace can have multiple users
* registration must be atomic (transactional)
* indexes required on:

  * users.email
  * workspaces.slug
  * (workspace_id, user_id)

## Implementation Steps

1. Add database layer (Prisma recommended)
2. Define schema for users, workspaces, memberships
3. Create shared types and validation schemas
4. Implement users service
5. Implement workspaces service
6. Implement memberships service
7. Implement auth module (register, login, JWT)
8. Add bcrypt password hashing
9. Add JWT strategy and guards
10. Add RBAC guards (membership and role)
11. Protect workspace routes
12. Add `/auth/me` endpoint
13. Prepare auth reuse for Socket.IO

## Edge Cases

* duplicate email registration with different casing
* concurrent registration race conditions
* login attempts must not reveal account existence
* removal or downgrade of last workspace owner must be blocked
* token issued before failed transaction must be avoided
* users with zero workspaces must have defined handling
* membership must always be validated from DB

## Risks

* race conditions in concurrent operations
* inconsistent email normalization
* stale authorization if roles were stored in JWT
* insecure token storage on client
* missing validation on API or socket events

## Validation Steps

* successful registration creates user, workspace, and membership
* login works with correct credentials and fails generically otherwise
* protected routes reject unauthenticated requests
* membership validation prevents unauthorized access
* role checks correctly enforce owner-only actions

## Security Requirements

* bcrypt with appropriate cost (10–12)
* strict input validation (DTO or schema-based)
* global validation pipe enabled in NestJS
* generic error messages for authentication
* JWT expiration (e.g., 15 minutes)
* no sensitive data exposure (passwords, tokens)
* rate limiting on auth endpoints
* no trust in client-provided roles or workspace IDs
* token must be verified on every request and socket event

## Success Criteria

* users can register and login successfully
* each user has at least one workspace after registration
* workspace membership is correctly enforced
* unauthorized access is consistently blocked
* system supports multiple users across multiple workspaces
* authentication integrates cleanly with future realtime features

## Skill-Aware Execution

All implementation must follow applicable skills from `.agents/skills`.

Before coding:

1. Identify relevant skills
2. Apply their constraints
3. Then implement

Before reporting completion:

1. Apply the `self-review` skill
2. Verify work against `AGENTS.md`, `PLANS.md`, and task requirements
3. Only then report completion

Skipping skill alignment is incorrect execution.
