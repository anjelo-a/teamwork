# TeamWork Codebase Reviewer Study Guide

This document is a deep review map of the TeamWork repository (`apps/api`, `apps/web`, `packages/types`, `packages/validation`, Prisma schema). It focuses on concrete concepts present in the current codebase and points to exact source locations.

---

## 1. OOP Principles

### Encapsulation
Definition: Bundling data and behavior together while restricting direct external mutation.

Where it appears:
- `apps/api/src/auth/auth-sessions.service.ts` (`AuthSessionsService` private helpers/state access)
- `apps/api/src/tasks/tasks.service.ts` (`TasksService` private normalization/cache methods)

Snippet:
```ts
// apps/api/src/auth/auth-sessions.service.ts
@Injectable()
export class AuthSessionsService {
  ...
  private createRefreshTokenExpiry(): Date {
    const ttlSeconds =
      this.configService.get<number>('REFRESH_TOKEN_TTL_SECONDS') ??
      DEFAULT_REFRESH_TOKEN_TTL_SECONDS;

    return new Date(Date.now() + ttlSeconds * 1000);
  }

  private get authSessionStore() {
    return this.prisma.authSession;
  }
}
```

```ts
// apps/api/src/tasks/tasks.service.ts
@Injectable()
export class TasksService {
  ...
  private async listTasks(input: ListTasksForUserInput): Promise<TaskListResponse> {
    const cacheVersion = await this.readTaskListCacheVersion(input.workspaceId);
    ...
  }
}
```

### Inheritance
Definition: One class extends another to reuse behavior.

Where it appears:
- `apps/api/src/common/auth/jwt-auth.guard.ts`
- `apps/api/src/auth/jwt.strategy.ts`
- `apps/api/src/workspaces/dto/workspace-board-filters.dto.ts`

Snippet:
```ts
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  override canActivate(context: ExecutionContext) {
    ...
    return super.canActivate(context);
  }
}
```

```ts
export class JwtStrategy extends PassportStrategy(Strategy) {
  async validate(payload: JwtAccessTokenPayload): Promise<RequestUser> {
    ...
  }
}
```

```ts
export class WorkspaceBoardFiltersDto extends ListTaskFiltersDto {
  @IsOptional()
  @IsBoolean()
  @Transform(normalizeOptionalBooleanValue)
  includeMembers?: boolean;
}
```

### Polymorphism
Definition: Same interface/method contract with different concrete behavior at runtime.

Where it appears:
- Transaction-aware database abstraction functions accepting either `PrismaService` or `Prisma.TransactionClient`:
  - `toTaskDatabase` in `apps/api/src/tasks/tasks.service.ts`
  - `toWorkspaceDatabase` in `apps/api/src/workspaces/workspaces.service.ts`
  - `toInvitationDatabase` in `apps/api/src/workspace-invitations/workspace-invitations.service.ts`

Snippet:
```ts
function toTaskDatabase(db: Prisma.TransactionClient | PrismaService): TaskDatabase {
  return {
    task: db.task,
    workspaceMembership: db.workspaceMembership,
  };
}
```

### Abstraction
Definition: Exposing essential operations while hiding storage/framework details.

Where it appears:
- Repository-style interfaces in services:
  - `TaskRepository`, `WorkspaceRepository`, `WorkspaceInvitationRepository`
- Guard and decorator abstractions in NestJS.

Snippet:
```ts
interface TaskRepository {
  create<T extends Prisma.TaskCreateArgs>(...): Promise<Prisma.TaskGetPayload<T>>;
  findMany<T extends Prisma.TaskFindManyArgs>(...): Promise<Array<Prisma.TaskGetPayload<T>>>;
  ...
}
```

---

## 2. Data Structures & Algorithms

### Arrays
Definition: Ordered contiguous collection.

Where:
- Across frontend filtering and mapping (`apps/web/lib/board.ts`, `apps/web/lib/task-list.ts`).

Snippet:
```ts
return BOARD_COLUMNS.map((column) => ({
  ...column,
  tasks: tasks.filter((task) => task.status === column.status),
}));
```

### Maps
Definition: Key-value collection with fast lookup.

Where:
- `apps/web/lib/hooks/use-authenticated-api-resource.ts`

Snippet:
```ts
const cacheRef = useRef(new Map<string, { expiresAt: number; data: T }>());
const inflightRequestRef = useRef(new Map<string, Promise<T>>());
```

### Sets
Definition: Unique-value collection.

Where:
- `apps/web/lib/task-list.ts`
- `apps/api/src/main.ts`

Snippet:
```ts
const removedTaskIds = new Set(overlay.removedTaskIds);
let mergedTasks = baseTasks.filter((task) => !removedTaskIds.has(task.id));
```

### Objects/Records (hash maps)
Definition: Key-indexed structure.

Where:
- `JsonObject = Record<string, unknown>` in `tasks.service.ts`
- telemetry details `Record<string, unknown>`.

### Searching
Definition: Finding element(s) by predicate or key.

Where:
- Linear search via `find`, `findIndex`, `filter`.

Snippet:
```ts
const existingIndex = tasks.findIndex((task) => task.id === nextTask.id);
const activeOption = assigneeOptions.find((option) => { ... });
```

### Sorting
Definition: Ordering elements by comparator.

Where:
- `apps/web/lib/board.ts`
- `apps/api/src/common/security/security-telemetry.service.ts`

Snippet:
```ts
.sort((left, right) => left.label.localeCompare(right.label));
```

```ts
.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
```

### Pagination (cursor-based)
Definition: Fetch `limit + 1`, derive `hasMore` and `nextCursor`.

Where:
- `apps/api/src/tasks/tasks.service.ts`

Snippet:
```ts
take: limit + 1,
...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),

const hasMore = taskRecords.length > limit;
const visibleTasks = hasMore ? taskRecords.slice(0, limit) : taskRecords;
const nextCursor = hasMore && lastVisibleTask ? lastVisibleTask.id : null;
```

### Retry loops
Definition: bounded retry for transient failures.

Where:
- `memberships.service.ts` (`P2034` retry)
- `auth.service.ts` (workspace slug conflict retry)

Snippet:
```ts
for (let attempt = 0; ; attempt += 1) {
  try {
    return await this.prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  } catch (error) {
    if (!isRetryableTransactionError(error) || attempt >= MAX_SERIALIZABLE_RETRIES - 1) {
      throw error;
    }
  }
}
```

### Pattern matching / state derivation
Definition: branching over discriminated/union states.

Where:
- `filterBoardTasks` in `apps/web/lib/board.ts`
- invitation/public token status derivation in invitation service.

### Algorithms not substantially present
- No explicit tree traversal, graph traversal, recursion, or dynamic programming implementations were found in application code.

---

## 3. TypeScript & Language Fundamentals

### Literal unions
Where:
- `packages/types/src/index.ts`

Snippet:
```ts
export type WorkspaceRole = 'owner' | 'member';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
```

### Interfaces and structural typing
Where:
- Shared contracts in `packages/types/src/index.ts`
- repository interfaces in service files.

### Generics
Where:
- Prisma repository methods across service files.

Snippet:
```ts
create<T extends Prisma.TaskCreateArgs>(
  args: Prisma.SelectSubset<T, Prisma.TaskCreateArgs>,
): Promise<Prisma.TaskGetPayload<T>>;
```

### Utility types
Where:
- `NonNullable`, `Parameters`, `Pick`, `Record`, `Partial`.

Snippet:
```ts
type WorkspaceMembershipCountArgs = NonNullable<
  Parameters<PrismaService['workspaceMembership']['count']>[0]
>;
```

### Type guards
Where:
- `apps/api/src/common/utils/prisma-error.util.ts`
- `apps/api/src/main.ts` (`isNonEmptyOrigin`)

Snippet:
```ts
function isPrismaErrorLike(error: unknown): error is PrismaErrorLike {
  return typeof error === 'object' && error !== null;
}
```

### Decorators
Where:
- NestJS class/method/param decorators in controllers/modules/services.
- custom `@CurrentUser`, `@Public`, `@WorkspacePolicy`.

Snippet:
```ts
@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController { ... }
```

### `satisfies` operator
Where:
- Prisma `select` objects in services.

Snippet:
```ts
const taskDetailsSelect = { ... } satisfies Prisma.TaskSelect;
```

### `as const`
Where:
- `apps/web/lib/board.ts`

Snippet:
```ts
export const BOARD_COLUMNS: readonly BoardColumnDefinition[] = [ ... ] as const;
```

### Discriminated unions
Where:
- `BoardAssigneeFilter` in `apps/web/lib/board.ts`
- `AcceptInvitationLookup` in invitation service.

### `unknown` for boundary parsing
Where:
- frontend API parsing (`apps/web/lib/api/client.ts`, `server-bootstrap.ts`)

Snippet:
```ts
const data: unknown = await response.json();
```

### Enums
Where:
- Prisma schema enums (`WorkspaceRole`, `TaskStatus`) in `apps/api/prisma/schema.prisma`.
- TS `enum` keyword is not used; union types are preferred.

---

## 4. Full Stack Concepts

### REST API design and HTTP methods
Where:
- `workspaces.controller.ts`, `tasks.controller.ts`, `auth.controller.ts`.

Example mapping:
- `GET /workspaces`
- `POST /workspaces`
- `PATCH /workspaces/:workspaceId`
- `DELETE /workspaces/:workspaceId`
- `GET/POST/PATCH/DELETE` task routes.

### Middleware/pipeline patterns
Where:
- Global validation and CORS setup in `apps/api/src/main.ts`.

Snippet:
```ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
```

### Authentication
Where:
- JWT strategy and auth guard (`jwt.strategy.ts`, `jwt-auth.guard.ts`)
- session rotation (`auth-sessions.service.ts`)

### Authorization (RBAC + policy)
Where:
- guard layer: `WorkspaceMemberGuard`, `WorkspacePolicyGuard`, `WorkspaceRoleGuard`
- service layer checks: `MembershipsService.requireMembership`, `WorkspacePolicyService.assert...`

### DTO validation and normalization at boundaries
Where:
- `CreateTaskDto`, `WorkspaceBoardFiltersDto`, auth/workspace/task DTOs.

### ORM and DB interactions
Where:
- Prisma throughout `apps/api/src/*service.ts`
- schema models, relations, indices in `apps/api/prisma/schema.prisma`.

### Transactions and consistency
Where:
- `prisma.$transaction` in auth, workspace, invitation, membership services.

### Environment config
Where:
- `apps/api/src/config/env.validation.ts`
- `ConfigModule.forRoot({ validate: validateEnvironment })` in `app.module.ts`.

---

## 5. Design Patterns

### MVC (NestJS adaptation)
- Controllers: request mapping (`*controller.ts`)
- Services: business logic (`*service.ts`)
- Model/Data: Prisma schema + Prisma client

### Dependency Injection
Where:
- Constructors in `@Injectable()` services/controllers.

Snippet:
```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly membershipsService: MembershipsService,
) {}
```

### Repository pattern (lightweight, interface-based)
Where:
- Service-local repository interfaces over Prisma models.

### Strategy pattern
Where:
- `JwtStrategy extends PassportStrategy(Strategy)` for auth mechanism.

### Decorator pattern
Where:
- Nest decorators + custom decorators (`@CurrentUser`, `@Public`, `@WorkspacePolicy`).

### Guard pattern
Where:
- `CanActivate` guards for precondition/authorization checks.

### Adapter pattern
Where:
- `toTaskDatabase` / `toWorkspaceDatabase` / `toInvitationDatabase` adapting `PrismaService` or transaction client into narrower domain DB interfaces.

### Observer/event-like pattern
Where:
- Security telemetry records events then dashboard computes alerts (`SecurityTelemetryService`).

### Singleton-like service lifetimes
Where:
- Nest DI service singletons per module scope (e.g., `PrismaService`, `SecurityTelemetryService`).

---

## 6. Async & Concurrency

### Promises and async/await
Where:
- ubiquitous across services/hooks/API client.

### Parallelization with `Promise.all`
Where:
- `WorkspacesService.getWorkspaceForUser` and `getWorkspaceBoardDataForUser`.

Snippet:
```ts
const [memberCount, invitationCount] = await Promise.all([
  db.workspaceMembership.count({ where: { workspaceId } }),
  db.workspaceInvitation.count({ where: { workspaceId, acceptedAt: null, revokedAt: null } }),
]);
```

### Concurrency control
Where:
- Serializable transactions + retry (`memberships.service.ts`).

### Session-rotation race/security handling
Where:
- `AuthSessionsService.rotateSession` revokes reused rotated chains.

### Event loop/microtask usage
Where:
- `queueMicrotask` in `useAuthenticatedApiResource` to safely publish cached/initial results.

### In-flight de-duplication
Where:
- `inflightRequestRef: Map<string, Promise<T>>` in `useAuthenticatedApiResource`.

### Error handling patterns
Where:
- try/catch translating DB/runtime errors into domain HTTP exceptions.
- Non-fatal cache failures in `TasksService`.

Snippet:
```ts
try {
  await redis.set(cacheKey, JSON.stringify(result), 'EX', 60);
} catch {
  // Treat Redis write failures as non-fatal so fresh task data still returns.
}
```

### Real-time/socket note
- Current scanned code does not include active Socket.IO gateway/event code under `apps/api/src` or `apps/web`; real-time behavior appears to be currently delivered via API + client-side overlay state patterns.

---

## 7. General CS Fundamentals

### Scope and closures
Where:
- callback functions capturing outer scope (CORS origin callback, React hooks effects, parser callbacks).

Snippet:
```ts
app.enableCors({
  origin: (origin, callback) => {
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed by CORS: ${normalizedOrigin}`), false);
  },
});
```

### References vs values
Where:
- Array/object copy patterns used to avoid mutating previous state (`[...overlay.removedTaskIds, task.id]`, object spread in reducers/state updates).

### Memory and retention considerations
Where:
- bounded telemetry buffer:

```ts
if (this.events.length > this.maxEvents) {
  this.events.splice(0, this.events.length - this.maxEvents);
}
```

### Hoisting
- Function declarations are hoisted in many utility files (`readString`, `readUrl`, etc.).
- `const`/`let` bindings are block-scoped (TDZ semantics used throughout).

### Big-O highlights in current operations
- `filter`, `map`, `find`, `findIndex`: `O(n)`
- sort comparators: `O(n log n)`
- building Set then membership checks: `O(n)` build + near `O(1)` lookup each.
- retry loops: bounded by constants (`MAX_SERIALIZABLE_RETRIES`, `MAX_WORKSPACE_CREATE_RETRIES`) so practical worst-case is constant-factor overhead.

### Data normalization and parsing
Where:
- input sanitization in `packages/validation/src/index.ts`
- env parsing and validation in `env.validation.ts`
- DTO transforms in API boundary classes.

---

## Cross-Section Highlights

1. Strong service-layer authorization: guards + policy service + membership checks are consistently combined.
2. Type-safe contracts are shared end-to-end via `@teamwork/types` and runtime parsers in web API client.
3. Transactional integrity patterns are explicit for sensitive membership/auth/invitation flows.
4. Algorithmic complexity is mostly linear/sort-scale and appropriate for CRUD + list APIs.
5. The architecture follows clear controller/service/data separation with reusable domain utilities.
