import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTaskFiltersDto } from './dto/list-task-filters.dto';
import { UpdateTaskAssigneeDto } from './dto/update-task-assignee.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';

describe('Task DTOs', () => {
  it('normalizes a create task payload', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: '  Build   task   API  ',
      description: '  Add task CRUD endpoints.  ',
      assigneeUserId: '3f0efc0b-4d17-4cb5-a522-6ac5cda66b68',
      dueDate: ' 2026-04-15 ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.title).toBe('Build task API');
    expect(dto.description).toBe('Add task CRUD endpoints.');
    expect(dto.dueDate).toBe('2026-04-15');
  });

  it('rejects a blank create task title after normalization', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: '   ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('title');
  });

  it('rejects an invalid create task assignee id', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: 'Build task API',
      assigneeUserId: 'not-a-uuid',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('assigneeUserId');
  });

  it('normalizes update task description and maps empty strings to null', async () => {
    const dto = plainToInstance(UpdateTaskDto, {
      title: '  Update   task ',
      description: '   ',
      dueDate: '   ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.title).toBe('Update task');
    expect(dto.description).toBeNull();
    expect(dto.dueDate).toBeNull();
  });

  it('rejects an invalid due date', async () => {
    const dto = plainToInstance(CreateTaskDto, {
      title: 'Build task API',
      dueDate: '2026-02-29',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('dueDate');
  });

  it('rejects an invalid task status', async () => {
    const dto = plainToInstance(UpdateTaskStatusDto, {
      status: 'blocked',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('status');
  });

  it('accepts null when unassigning a task', async () => {
    const dto = plainToInstance(UpdateTaskAssigneeDto, {
      assigneeUserId: null,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.assigneeUserId).toBeNull();
  });

  it('rejects an invalid assignee id on assignment update', async () => {
    const dto = plainToInstance(UpdateTaskAssigneeDto, {
      assigneeUserId: 'member-1',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('assigneeUserId');
  });

  it('normalizes valid task list filters', async () => {
    const dto = plainToInstance(ListTaskFiltersDto, {
      workspaceId: ' 3f0efc0b-4d17-4cb5-a522-6ac5cda66b68 ',
      dueBucket: ' today ',
      assignment: ' me ',
      referenceDate: ' 2026-04-15 ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.workspaceId).toBe('3f0efc0b-4d17-4cb5-a522-6ac5cda66b68');
    expect(dto.dueBucket).toBe('today');
    expect(dto.assignment).toBe('me');
    expect(dto.referenceDate).toBe('2026-04-15');
  });

  it('rejects an invalid task list reference date', async () => {
    const dto = plainToInstance(ListTaskFiltersDto, {
      referenceDate: '2026-02-29',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('referenceDate');
  });

  it('treats blank optional task list filters as omitted', async () => {
    const dto = plainToInstance(ListTaskFiltersDto, {
      workspaceId: '   ',
      dueBucket: '   ',
      assignment: '   ',
      referenceDate: '   ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.workspaceId).toBeUndefined();
    expect(dto.dueBucket).toBeUndefined();
    expect(dto.assignment).toBeUndefined();
    expect(dto.referenceDate).toBeNull();
  });
});
