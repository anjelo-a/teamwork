import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskStatus as PrismaTaskStatus, type User } from '@prisma/client';
import { normalizeTaskDescription, normalizeTaskTitle } from '@teamwork/validation';
import type { TaskDetails, TaskStatus, TaskSummary, UserSummary } from '@teamwork/types';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { serializeTaskDueDate, tryParseTaskDueDate } from './task-due-date.util';
import type {
  TaskAssignmentFilter,
  TaskDueBucket,
  TaskListFilters,
} from './dto/list-task-filters.dto';

const userSummarySelect = {
  id: true,
  email: true,
  displayName: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

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

type TaskRecord = Prisma.TaskGetPayload<{
  select: typeof taskDetailsSelect;
}>;

interface ListTasksForWorkspaceInput extends TaskListFilters {
  workspaceId: string;
  currentUserId: string;
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
    private readonly usersService: UsersService,
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

    return this.toDetails(task);
  }

  async listTasksForWorkspace(input: ListTasksForWorkspaceInput): Promise<TaskSummary[]> {
    await this.membershipsService.requireMembership(input.workspaceId, input.currentUserId);

    const tasks = await toTaskDatabase(this.prisma).task.findMany({
      where: this.buildTaskListWhere(input),
      select: taskDetailsSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return tasks.map((task) => this.toSummary(task));
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

    return this.toDetails(task);
  }

  async deleteTask(workspaceId: string, taskId: string, currentUserId: string): Promise<void> {
    await this.membershipsService.requireMembership(workspaceId, currentUserId);
    await this.findTaskOrThrow(workspaceId, taskId);

    await toTaskDatabase(this.prisma).task.delete({
      where: { id: taskId },
    });
  }

  async updateTaskStatus(
    workspaceId: string,
    taskId: string,
    status: TaskStatus,
    currentUserId: string,
  ): Promise<TaskDetails> {
    await this.membershipsService.requireMembership(workspaceId, currentUserId);
    await this.findTaskOrThrow(workspaceId, taskId);

    const task = await toTaskDatabase(this.prisma).task.update({
      where: { id: taskId },
      data: {
        status: toPrismaTaskStatus(status),
      },
      select: taskDetailsSelect,
    });

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
      createdByUser: this.toUserSummary(task.createdByUser),
      assigneeUser: task.assigneeUser ? this.toUserSummary(task.assigneeUser) : null,
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

  private buildTaskListWhere(input: ListTasksForWorkspaceInput): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = {
      workspaceId: input.workspaceId,
    };

    const assignmentFilter = input.assignment ?? 'all';
    const dueBucket = input.dueBucket;

    this.applyAssignmentFilter(where, assignmentFilter, input.currentUserId);
    this.applyDueBucketFilter(where, dueBucket, input.referenceDate);

    return where;
  }

  private applyAssignmentFilter(
    where: Prisma.TaskWhereInput,
    assignment: TaskAssignmentFilter,
    currentUserId: string,
  ): void {
    if (assignment === 'me') {
      where.assigneeUserId = currentUserId;
      return;
    }

    if (assignment === 'unassigned') {
      where.assigneeUserId = null;
    }
  }

  private applyDueBucketFilter(
    where: Prisma.TaskWhereInput,
    dueBucket: TaskDueBucket | undefined,
    referenceDateInput: string | null | undefined,
  ): void {
    if (!dueBucket) {
      return;
    }

    if (dueBucket === 'no_date') {
      where.dueDate = null;
      return;
    }

    const referenceDate = this.resolveReferenceDate(referenceDateInput);

    if (dueBucket === 'past_due') {
      where.dueDate = { lt: referenceDate };
      return;
    }

    if (dueBucket === 'today') {
      where.dueDate = { equals: referenceDate };
      return;
    }

    where.dueDate = { gt: referenceDate };
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

  private toUserSummary(
    user: Pick<User, 'id' | 'email' | 'displayName' | 'createdAt' | 'updatedAt'>,
  ): UserSummary {
    return this.usersService.toSummary(user);
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
