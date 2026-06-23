import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { CreateTaskAttachmentDto } from './dto/create-task-attachment.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { RequirePermissions } from '../../core/decorators/permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@Controller('tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @RequirePermissions('tasks:read')
  findAll(@Query() query: QueryTasksDto, @CurrentUser() user: any) {
    return this.tasksService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermissions('tasks:read')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.findOne(id, user);
  }

  @Post()
  @RequirePermissions('tasks:write')
  create(@Body() createTaskDto: CreateTaskDto, @CurrentUser() user: any) {
    return this.tasksService.create(createTaskDto, user.id, user);
  }

  @Patch(':id')
  @RequirePermissions('tasks:write')
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.update(id, updateTaskDto, user);
  }

  @Patch(':id/status')
  @RequirePermissions('tasks:write')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.updateStatus(id, dto.status, user);
  }

  @Delete(':id')
  @RequirePermissions('tasks:write')
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.delete(id, user);
  }

  @Patch(':id/restore')
  @RequirePermissions('tasks:write')
  restore(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.restore(id, user);
  }

  // ─── Comments ────────────────────────────────────────────────────────────────

  @Get(':id/comments')
  @RequirePermissions('tasks:read')
  getComments(@Param('id') taskId: string, @CurrentUser() user: any) {
    return this.tasksService.getComments(taskId, user);
  }

  @Post(':id/comments')
  @RequirePermissions('tasks:write')
  addComment(
    @Param('id') taskId: string,
    @Body() dto: CreateTaskCommentDto,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.addComment(taskId, dto, user);
  }

  @Delete('comments/:commentId')
  @RequirePermissions('tasks:write')
  deleteComment(@Param('commentId') commentId: string, @CurrentUser() user: any) {
    return this.tasksService.deleteComment(commentId, user.id);
  }

  // ─── Attachments ─────────────────────────────────────────────────────────────

  @Get(':id/attachments')
  @RequirePermissions('tasks:read')
  getAttachments(@Param('id') taskId: string, @CurrentUser() user: any) {
    return this.tasksService.getAttachments(taskId, user);
  }

  @Post(':id/attachments')
  @RequirePermissions('tasks:write')
  addAttachment(
    @Param('id') taskId: string,
    @Body() dto: CreateTaskAttachmentDto,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.addAttachment(taskId, dto, user);
  }

  @Delete('attachments/:attachmentId')
  @RequirePermissions('tasks:write')
  deleteAttachment(@Param('attachmentId') attachmentId: string, @CurrentUser() user: any) {
    return this.tasksService.deleteAttachment(attachmentId, user);
  }

  // ─── Subtasks ────────────────────────────────────────────────────────────────

  @Get(':id/subtasks')
  @RequirePermissions('tasks:read')
  getSubtasks(@Param('id') taskId: string, @CurrentUser() user: any) {
    return this.tasksService.getSubtasks(taskId, user);
  }
}
