import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { TasksInboxController } from './tasks-inbox.controller';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [MembershipsModule],
  controllers: [TasksInboxController, TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
