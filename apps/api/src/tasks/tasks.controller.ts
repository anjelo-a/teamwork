import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { TaskDeleteResponse, TaskListResponse, TaskResponse } from '@teamwork/types';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../common/auth/workspace-member.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTaskFiltersDto } from './dto/list-task-filters.dto';
import type { TaskAssignmentFilter, TaskDueBucket } from './dto/list-task-filters.dto';
import { UpdateTaskAssigneeDto } from './dto/update-task-assignee.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TasksService } from './tasks.service';

@Controller('workspaces/:workspaceId/tasks')
@UseGuards(JwtAuthGuard, WorkspaceMemberGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async listTasks(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query() filters: ListTaskFiltersDto,
  ): Promise<TaskListResponse> {
    if (filters.workspaceId && filters.workspaceId !== workspaceId) {
      throw new BadRequestException('workspaceId query param must match the route workspaceId.');
    }

    return {
      tasks: await this.tasksService.listTasksForWorkspace(this.buildListTasksInput(
        workspaceId,
        user.id,
        filters,
      )),
    };
  }

  @Post()
  async createTask(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: CreateTaskDto,
  ): Promise<TaskResponse> {
    return {
      task: await this.tasksService.createTask(workspaceId, dto, user.id),
    };
  }

  @Get(':taskId')
  async getTask(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<TaskResponse> {
    return {
      task: await this.tasksService.getTaskForWorkspace(workspaceId, taskId, user.id),
    };
  }

  @Patch(':taskId')
  async updateTask(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskResponse> {
    return {
      task: await this.tasksService.updateTask(workspaceId, taskId, dto, user.id),
    };
  }

  @Delete(':taskId')
  async deleteTask(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<TaskDeleteResponse> {
    await this.tasksService.deleteTask(workspaceId, taskId, user.id);
    return { success: true };
  }

  @Patch(':taskId/status')
  async updateTaskStatus(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskStatusDto,
  ): Promise<TaskResponse> {
    return {
      task: await this.tasksService.updateTaskStatus(workspaceId, taskId, dto.status, user.id),
    };
  }

  @Patch(':taskId/assignee')
  async updateTaskAssignee(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskAssigneeDto,
  ): Promise<TaskResponse> {
    return {
      task: await this.tasksService.updateTaskAssignee(
        workspaceId,
        taskId,
        dto.assigneeUserId,
        user.id,
      ),
    };
  }

  private buildListTasksInput(
    workspaceId: string,
    currentUserId: string,
    filters: ListTaskFiltersDto,
  ): {
    workspaceId: string;
    currentUserId: string;
    dueBucket?: TaskDueBucket;
    assignment?: TaskAssignmentFilter;
    referenceDate?: string | null;
  } {
    return {
      workspaceId,
      currentUserId,
      ...(filters.dueBucket !== undefined ? { dueBucket: filters.dueBucket } : {}),
      ...(filters.assignment !== undefined ? { assignment: filters.assignment } : {}),
      ...(filters.referenceDate !== undefined ? { referenceDate: filters.referenceDate } : {}),
    };
  }
}
