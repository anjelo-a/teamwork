import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskStatus as PrismaTaskStatus } from '@prisma/client';
import { normalizeTaskDescription, normalizeTaskTitle } from '@teamwork/validation';
import type {
  TaskActorSummary,
  TaskDetails,
  TaskListResponse,
  TaskStatus,
  TaskSummary,
} from '@teamwork/types';
import { redis } from '../common/redis';
import { SecurityTelemetryService } from '../common/security/security-telemetry.service';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { serializeTaskDueDate, tryParseTaskDueDate } from './task-due-date.util';
import type {
  TaskAssignmentFilter,
  TaskDueBucket,
  TaskListFilters,
} from './dto/list-task-filters.dto';

const userSummarySelect = {
  id: true,
  displayName: true,
} satisfies Prisma.UserSelect;

const DEFAULT_TASK_LIST_RESULTS = 50;
const MAX_TASK_LIST_RESULTS = 100;

const taskDetailsSelect = {
  id: true,
  workspaceId: true,
  title: true,
  description: true,
  dueDate: true,
  status: true,
  createdByUserId: true,
  assigneeUserId: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: {
    select: userSummarySelect,
  },
  assigneeUser: {
    select: userSummarySelect,
  },
} satisfies Prisma.TaskSelect;

const taskListSelect = {
  id: true,
  workspaceId: true,
  title: true,
  description: true,
  dueDate: true,
  status: true,
  createdByUserId: true,
  assigneeUserId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TaskSelect;

type TaskRecord = Prisma.TaskGetPayload<{
  select: typeof taskDetailsSelect;
}>;

type TaskListRecord = Prisma.TaskGetPayload<{
  select: typeof taskListSelect;
}>;

type JsonObject = Record<string, unknown>;

interface ListTasksForWorkspaceInput extends TaskListFilters {
  workspaceId: string;
  currentUserId: string;
  includeDescription?: boolean;
}

interface ListTasksForUserInput extends TaskListFilters {
  currentUserId: string;
  includeDescription?: boolean;
}

interface TaskRepository {
  create<T extends Prisma.TaskCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.TaskCreateArgs>,
  ): Promise<Prisma.TaskGetPayload<T>>;
  findMany<T extends Prisma.TaskFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.TaskFindManyArgs>,
  ): Promise<Array<Prisma.TaskGetPayload<T>>>;
  findFirst<T extends Prisma.TaskFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.TaskFindFirstArgs>,
  ): Promise<Prisma.TaskGetPayload<T> | null>;
  update<T extends Prisma.TaskUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.TaskUpdateArgs>,
  ): Promise<Prisma.TaskGetPayload<T>>;
  delete<T extends Prisma.TaskDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.TaskDeleteArgs>,
  ): Promise<Prisma.TaskGetPayload<T>>;
}

interface WorkspaceMembershipRepository {
  findUnique<T extends Prisma.WorkspaceMembershipFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceMembershipFindUniqueArgs>,
  ): Promise<Prisma.WorkspaceMembershipGetPayload<T> | null>;
}

interface TaskDatabase {
  task: TaskRepository;
  workspaceMembership: WorkspaceMembershipRepository;
}

function toTaskDatabase(db: Prisma.TransactionClient | PrismaService): TaskDatabase {
  return {
    task: db.task,
    workspaceMembership: db.workspaceMembership,
  };
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipsService: MembershipsService,
    private readonly securityTelemetryService: SecurityTelemetryService,
  ) {}

  async createTask(
    workspaceId: string,
    input: {
      title: string;
      description?: string | null;
      assigneeUserId?: string | null;
      dueDate?: string | null;
    },
    currentUserId: string,
  ): Promise<TaskDetails> {
    const db = toTaskDatabase(this.prisma);
    await this.membershipsService.requireMembership(workspaceId, currentUserId);

    const assigneeUserId = input.assigneeUserId ?? null;
    const dueDate = this.parseDueDateInput(input.dueDate);
    await this.ensureAssigneeBelongsToWorkspace(workspaceId, assigneeUserId, db);

    const task = await db.task.create({
      data: {
        workspaceId,
        title: normalizeTaskTitle(input.title),
        description: this.normalizeDescription(input.description),
        dueDate,
        createdByUserId: currentUserId,
        assigneeUserId,
      },
      select: taskDetailsSelect,
    });

    await this.invalidateTaskListCaches();

    return this.toDetails(task);
  }

  async listTasksForWorkspace(input: ListTasksForWorkspaceInput): Promise<TaskListResponse> {
    return this.listTasks(input);
  }

  async listTasksForUser(
    currentUserId: string,
    filters: TaskListFilters,
  ): Promise<TaskListResponse> {
    if (filters.workspaceId) {
      await this.membershipsService.requireMembership(filters.workspaceId, currentUserId);
    }

    return this.listTasks({
      currentUserId,
      includeDescription: true,
      ...filters,
    });
  }

  private async listTasks(input: ListTasksForUserInput): Promise<TaskListResponse> {
    const cacheKey = this.buildTaskListCacheKey(input);

    const cached = await redis.get(cacheKey);
    if (typeof cached === 'string') {
      try {
        const parsed = JSON.parse(cached) as unknown;

        if (isTaskListResponse(parsed)) {
          return parsed;
        }
      } catch {
        // Treat malformed cache entries as misses and continue to the database query.
      }
    }

    const limit = this.resolveTaskListLimit(input.limit);
    const taskRecords = await toTaskDatabase(this.prisma).task.findMany({
      where: this.buildTaskListWhere(input),
      select: taskListSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(input.cursor
        ? {
            cursor: { id: input.cursor },
            skip: 1,
          }
        : {}),
    });

    const hasMore = taskRecords.length > limit;
    const visibleTasks = hasMore ? taskRecords.slice(0, limit) : taskRecords;
    const usersById = await this.loadTaskListUsers(visibleTasks);
    const lastVisibleTask = visibleTasks.at(-1);
    const nextCursor = hasMore && lastVisibleTask ? lastVisibleTask.id : null;

    const summaries = visibleTasks.map((task) => this.toSummaryFromListRecord(task, usersById));
    const serializedTasks =
      input.includeDescription === false
        ? summaries.map((task) => ({
            ...task,
            description: null,
          }))
        : summaries;

    const result = {
      tasks: serializedTasks,
      limit,
      hasMore,
      nextCursor,
    };

    await redis.set(cacheKey, JSON.stringify(result), 'EX', 60);

    return result;
  }

  async getTaskForWorkspace(
    workspaceId: string,
    taskId: string,
    currentUserId: string,
  ): Promise<TaskDetails> {
    await this.membershipsService.requireMembership(workspaceId, currentUserId);
    const task = await this.findTaskOrThrow(workspaceId, taskId);
    return this.toDetails(task);
  }

  async updateTask(
    workspaceId: string,
    taskId: string,
    input: {
      title?: string;
      description?: string | null;
      dueDate?: string | null;
    },
    currentUserId: string,
  ): Promise<TaskDetails> {
    await this.membershipsService.requireMembership(workspaceId, currentUserId);
    await this.findTaskOrThrow(workspaceId, taskId);

    const data: Prisma.TaskUpdateInput = {};

    if (input.title !== undefined) {
      data.title = normalizeTaskTitle(input.title);
    }

    if (input.description !== undefined) {
      data.description = this.normalizeDescription(input.description);
    }

    if (input.dueDate !== undefined) {
      data.dueDate = this.parseDueDateInput(input.dueDate);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one updatable task field is required.');
    }

    const task = await toTaskDatabase(this.prisma).task.update({
      where: { id: taskId },
      data,
      select: taskDetailsSelect,
    });

    await this.invalidateTaskListCaches();

    return this.toDetails(task);
  }

  async deleteTask(workspaceId: string, taskId: string, currentUserId: string): Promise<void> {
    try {
      await this.membershipsService.requireMembership(workspaceId, currentUserId);
      await this.findTaskOrThrow(workspaceId, taskId);

      await toTaskDatabase(this.prisma).task.delete({
        where: { id: taskId },
      });

      await this.invalidateTaskListCaches();

      this.securityTelemetryService.record({
        category: 'destructive',
        eventName: 'task.delete',
        outcome: 'success',
        workspaceId,
        actorUserId: currentUserId,
        details: {
          taskId,
        },
      });
    } catch (error) {
      this.securityTelemetryService.record({
        category: 'destructive',
        eventName: 'task.delete',
        outcome: 'failure',
        workspaceId,
        actorUserId: currentUserId,
        details: {
          taskId,
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
      });
      throw error;
    }
  }

  async updateTaskStatus(
    workspaceId: string,
    taskId: string,
    status: TaskStatus,
  ): Promise<TaskDetails> {
    await this.findTaskOrThrow(workspaceId, taskId);

    const task = await toTaskDatabase(this.prisma).task.update({
      where: { id: taskId },
      data: {
        status: toPrismaTaskStatus(status),
      },
      select: taskDetailsSelect,
    });

    await this.invalidateTaskListCaches();

    return this.toDetails(task);
  }

  async updateTaskAssignee(
    workspaceId: string,
    taskId: string,
    assigneeUserId: string | null,
    currentUserId: string,
  ): Promise<TaskDetails> {
    const db = toTaskDatabase(this.prisma);
    await this.membershipsService.requireMembership(workspaceId, currentUserId);
    await this.findTaskOrThrow(workspaceId, taskId);
    await this.ensureAssigneeBelongsToWorkspace(workspaceId, assigneeUserId, db);

    const task = await db.task.update({
      where: { id: taskId },
      data: { assigneeUserId },
      select: taskDetailsSelect,
    });

    await this.invalidateTaskListCaches();

    return this.toDetails(task);
  }

  toSummary(task: TaskRecord): TaskSummary {
    return {
      id: task.id,
      workspaceId: task.workspaceId,
      title: task.title,
      description: task.description,
      dueDate: serializeTaskDueDate(task.dueDate),
      status: task.status,
      createdByUserId: task.createdByUserId,
      assigneeUserId: task.assigneeUserId,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      createdByUser: this.toTaskActorSummary(task.createdByUser),
      assigneeUser: task.assigneeUser ? this.toTaskActorSummary(task.assigneeUser) : null,
    };
  }

  toDetails(task: TaskRecord): TaskDetails {
    return this.toSummary(task);
  }

  private async findTaskOrThrow(workspaceId: string, taskId: string): Promise<TaskRecord> {
    const task = await toTaskDatabase(this.prisma).task.findFirst({
      where: {
        id: taskId,
        workspaceId,
      },
      select: taskDetailsSelect,
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    return task;
  }

  private async ensureAssigneeBelongsToWorkspace(
    workspaceId: string,
    assigneeUserId: string | null,
    db: TaskDatabase,
  ): Promise<void> {
    if (!assigneeUserId) {
      return;
    }

    const membership = await db.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: assigneeUserId,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new BadRequestException('Assignee must be a member of this workspace.');
    }
  }

  private normalizeDescription(description: string | null | undefined): string | null {
    if (description === undefined || description === null) {
      return null;
    }

    const normalizedDescription = normalizeTaskDescription(description);
    return normalizedDescription === '' ? null : normalizedDescription;
  }

  private parseDueDateInput(dueDate: string | null | undefined): Date | null {
    if (dueDate === undefined || dueDate === null) {
      return null;
    }

    const parsedDueDate = tryParseTaskDueDate(dueDate);

    if (!parsedDueDate) {
      throw new BadRequestException('Due date must be a valid date in YYYY-MM-DD format.');
    }

    return parsedDueDate;
  }

  private buildTaskListWhere(input: ListTasksForUserInput): Prisma.TaskWhereInput {
    return {
      ...this.buildTaskListScopeFilter(input),
      ...this.buildAssignmentFilter(input.assignment ?? 'everyone', input.currentUserId),
      ...this.buildDueBucketFilter(input.dueBucket, input.referenceDate),
    };
  }

  private buildTaskListScopeFilter(input: ListTasksForUserInput): Prisma.TaskWhereInput {
    if (input.workspaceId) {
      return {
        workspaceId: input.workspaceId,
      };
    }

    return {
      workspace: {
        memberships: {
          some: {
            userId: input.currentUserId,
          },
        },
      },
    };
  }

  private buildAssignmentFilter(
    assignment: TaskAssignmentFilter,
    currentUserId: string,
  ): Prisma.TaskWhereInput {
    if (assignment === 'me') {
      return { assigneeUserId: currentUserId };
    }

    if (assignment === 'others') {
      return {
        AND: [{ assigneeUserId: { not: null } }, { assigneeUserId: { not: currentUserId } }],
      };
    }

    if (assignment === 'unassigned') {
      return { assigneeUserId: null };
    }

    return {};
  }

  private buildDueBucketFilter(
    dueBucket: TaskDueBucket | undefined,
    referenceDateInput: string | null | undefined,
  ): Prisma.TaskWhereInput {
    if (!dueBucket) {
      return {};
    }

    if (dueBucket === 'no_date') {
      return { dueDate: null };
    }

    const referenceDate = this.resolveReferenceDate(referenceDateInput);

    if (dueBucket === 'past_due') {
      return {
        dueDate: { lt: referenceDate },
        status: { not: PrismaTaskStatus.done },
      };
    }

    if (dueBucket === 'today') {
      return { dueDate: { equals: referenceDate } };
    }

    return { dueDate: { gt: referenceDate } };
  }

  private resolveReferenceDate(referenceDateInput: string | null | undefined): Date {
    if (!referenceDateInput) {
      return this.getCurrentUtcDate();
    }

    const parsedDate = tryParseTaskDueDate(referenceDateInput);

    if (!parsedDate) {
      throw new BadRequestException('Reference date must be a valid date in YYYY-MM-DD format.');
    }

    return parsedDate;
  }

  private getCurrentUtcDate(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private async loadTaskListUsers(tasks: TaskListRecord[]): Promise<Map<string, TaskActorSummary>> {
    const userIds = new Set<string>();

    for (const task of tasks) {
      userIds.add(task.createdByUserId);

      if (task.assigneeUserId) {
        userIds.add(task.assigneeUserId);
      }
    }

    if (userIds.size === 0) {
      return new Map();
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: Array.from(userIds),
        },
      },
      select: userSummarySelect,
    });

    return new Map(users.map((user) => [user.id, this.toTaskActorSummary(user)]));
  }

  private toSummaryFromListRecord(
    task: TaskListRecord,
    usersById: Map<string, TaskActorSummary>,
  ): TaskSummary {
    const createdByUser = usersById.get(task.createdByUserId);

    if (!createdByUser) {
      throw new NotFoundException('Task creator not found.');
    }

    const assigneeUser = task.assigneeUserId ? (usersById.get(task.assigneeUserId) ?? null) : null;

    if (task.assigneeUserId && !assigneeUser) {
      throw new NotFoundException('Task assignee not found.');
    }

    return {
      id: task.id,
      workspaceId: task.workspaceId,
      title: task.title,
      description: task.description,
      dueDate: serializeTaskDueDate(task.dueDate),
      status: task.status,
      createdByUserId: task.createdByUserId,
      assigneeUserId: task.assigneeUserId,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      createdByUser,
      assigneeUser,
    };
  }

  private resolveTaskListLimit(requestedLimit: number | undefined): number {
    if (!requestedLimit) {
      return DEFAULT_TASK_LIST_RESULTS;
    }

    return Math.min(Math.max(requestedLimit, 1), MAX_TASK_LIST_RESULTS);
  }

  private buildTaskListCacheKey(input: ListTasksForUserInput): string {
    const limit = this.resolveTaskListLimit(input.limit);
    const referenceDateSegment = this.resolveTaskListCacheReferenceDateSegment(input);

    return [
      'tasks:list',
      input.currentUserId,
      input.workspaceId ?? 'all',
      input.includeDescription === false ? 'without-description' : 'with-description',
      input.assignment ?? 'everyone',
      input.dueBucket ?? 'all',
      referenceDateSegment,
      String(limit),
      input.cursor ?? 'start',
    ].join(':');
  }

  private resolveTaskListCacheReferenceDateSegment(input: ListTasksForUserInput): string {
    if (!input.dueBucket || input.dueBucket === 'no_date') {
      return 'no-reference-date';
    }

    return input.referenceDate ?? serializeTaskDueDate(this.resolveReferenceDate(undefined)) ?? 'no-reference-date';
  }

  private async invalidateTaskListCaches(): Promise<void> {
    const keys = await redis.keys('tasks:list:*');

    if (keys.length === 0) {
      return;
    }

    await redis.del(...keys);
  }

  private toTaskActorSummary(
    user: Pick<TaskActorSummary, 'id' | 'displayName'>,
  ): TaskActorSummary {
    return {
      id: user.id,
      displayName: user.displayName,
    };
  }
}

function toPrismaTaskStatus(status: TaskStatus): PrismaTaskStatus {
  if (status === 'in_progress') {
    return PrismaTaskStatus.in_progress;
  }

  if (status === 'done') {
    return PrismaTaskStatus.done;
  }

  return PrismaTaskStatus.todo;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null;
}

function isTaskActorSummary(value: unknown): value is TaskActorSummary {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value['id'] === 'string' && typeof value['displayName'] === 'string';
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === 'todo' || value === 'in_progress' || value === 'done';
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}

function isTaskSummary(value: unknown): value is TaskSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value['id'] === 'string' &&
    typeof value['workspaceId'] === 'string' &&
    typeof value['title'] === 'string' &&
    isNullableString(value['description']) &&
    isNullableString(value['dueDate']) &&
    isTaskStatus(value['status']) &&
    typeof value['createdByUserId'] === 'string' &&
    isNullableString(value['assigneeUserId']) &&
    typeof value['createdAt'] === 'string' &&
    typeof value['updatedAt'] === 'string' &&
    isTaskActorSummary(value['createdByUser']) &&
    (value['assigneeUser'] === null || isTaskActorSummary(value['assigneeUser']))
  );
}

function isTaskListResponse(value: unknown): value is TaskListResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value['tasks']) &&
    value['tasks'].every((task) => isTaskSummary(task)) &&
    typeof value['limit'] === 'number' &&
    typeof value['hasMore'] === 'boolean' &&
    isNullableString(value['nextCursor'])
  );
}
