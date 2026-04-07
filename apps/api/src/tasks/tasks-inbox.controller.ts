import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { TaskListResponse } from '@teamwork/types';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { ListTaskFiltersDto } from './dto/list-task-filters.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksInboxController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async listTasks(
    @CurrentUser() user: RequestUser,
    @Query() filters: ListTaskFiltersDto,
  ): Promise<TaskListResponse> {
    return this.tasksService.listTasksForUser(user.id, filters);
  }
}
