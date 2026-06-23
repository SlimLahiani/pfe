import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { TaskStatus, TaskPriority, Prisma, ProjectStatus, MilestoneStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { CreateTaskAttachmentDto } from './dto/create-task-attachment.dto';
import { paginate, getPaginationParams } from '../../core/dto/paginated-response';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryTasksDto, currentUser?: any) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      priority,
      projectId,
      assigneeId,
      createdById,
      dueDateFrom,
      dueDateTo,
      isArchived = false,
    } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const isProjectManager = currentUser?.role?.name === 'CHEF_PROJET';
    const isEmployeeOrIntern = currentUser && ['COLLABORATEUR', 'STAGIAIRE'].includes(currentUser.role?.name);
    const isTeamLeader = currentUser?.role?.name === 'CHEF_EQUIPE';

    const where: Prisma.TaskWhereInput = {
      isArchived,
      ...(status && { status }),
      ...(priority && { priority }),
      ...(projectId && { projectId }),
      assigneeId: isEmployeeOrIntern ? currentUser.id : (assigneeId || undefined),
      ...(isProjectManager && {
        project: {
          members: {
            some: {
              userId: currentUser.id,
            },
          },
        },
      }),
      ...(isTeamLeader && {
        OR: [
          {
            assignee: {
              employeeProfile: {
                department: {
                  managerId: currentUser.id,
                },
              },
            },
          },
          {
            assigneeId: currentUser.id,
          },
        ],
      }),
      ...(createdById && { createdById }),
      ...((dueDateFrom || dueDateTo) && {
        dueDate: {
          ...(dueDateFrom && { gte: new Date(dueDateFrom) }),
          ...(dueDateTo && { lte: new Date(dueDateTo) }),
        },
      }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const validSortFields: Record<string, keyof Prisma.TaskOrderByWithRelationInput> = {
      createdAt: 'createdAt',
      dueDate: 'dueDate',
      priority: 'priority',
    };
    const orderBy: Prisma.TaskOrderByWithRelationInput = {
      [validSortFields[sortBy] ?? 'createdAt']: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip,
        take,
        include: {
          assignee: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
          project: {
            select: { id: true, name: true },
          },
          _count: {
            select: { comments: true, subTasks: true },
          },
        },
        orderBy,
      }),
      this.prisma.task.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string, currentUser?: any) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        project: {
          select: { id: true, name: true },
        },
        parentTask: {
          select: { id: true, title: true, status: true },
        },
        _count: {
          select: { comments: true, subTasks: true, attachments: true },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with id "${id}" not found`);
    }

    // Task ownership verification: Collaborateurs and Interns can only read tasks assigned to or created by them
    if (currentUser) {
      const roleName = currentUser.role?.name;
      if (roleName === 'COLLABORATEUR' || roleName === 'STAGIAIRE') {
        if (task.assigneeId !== currentUser.id && task.createdById !== currentUser.id) {
          throw new ForbiddenException('Access denied: You do not own or participate in this task.');
        }
      } else if (roleName === 'CHEF_PROJET') {
        if (task.projectId) {
          const isMember = await this.prisma.projectMember.findFirst({
            where: { projectId: task.projectId, userId: currentUser.id },
          });
          if (!isMember) {
            throw new ForbiddenException('Access denied: You are not a member of the project for this task.');
          }
        }
      }
    }

    return task;
  }

  async create(dto: CreateTaskDto, creatorUserId: string, currentUser?: any) {
    if (currentUser) {
      const roleName = currentUser.role?.name;
      if (roleName === 'STAGIAIRE') {
        throw new ForbiddenException('Access denied: Interns cannot create tasks.');
      }
      if (roleName === 'COLLABORATEUR') {
        throw new ForbiddenException('Access denied: Employees cannot create tasks.');
      }
      if (roleName === 'CHEF_PROJET' && dto.projectId) {
        const isMember = await this.prisma.projectMember.findFirst({
          where: { projectId: dto.projectId, userId: currentUser.id },
        });
        if (!isMember) {
          throw new ForbiddenException('Access denied: You can only create tasks for projects you are assigned to.');
        }
      }
    }

    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        projectId: dto.projectId,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        estimatedHours: dto.estimatedHours,
        parentTaskId: dto.parentTaskId,
        createdById: creatorUserId,
      },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateTaskDto, currentUser?: any) {
    const taskBefore = await this.findOne(id, currentUser);

    if (currentUser) {
      const roleName = currentUser.role?.name;
      if (roleName === 'STAGIAIRE') {
        throw new ForbiddenException('Access denied: Interns cannot edit task details.');
      }
      if (roleName === 'COLLABORATEUR') {
        const fields = Object.keys(dto).filter((k) => dto[k as keyof UpdateTaskDto] !== undefined);
        const forbiddenFields = fields.filter((f) => f !== 'status' && f !== 'actualHours');
        if (forbiddenFields.length > 0) {
          throw new ForbiddenException('Access denied: Employees can only update task progress and status.');
        }
      }
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.projectId !== undefined && { projectId: dto.projectId }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(dto.estimatedHours !== undefined && { estimatedHours: dto.estimatedHours }),
        ...(dto.actualHours !== undefined && { actualHours: dto.actualHours }),
        ...(dto.parentTaskId !== undefined && { parentTaskId: dto.parentTaskId }),
      },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (dto.status === TaskStatus.DONE && taskBefore.status !== TaskStatus.DONE) {
      const assigneeId = dto.assigneeId !== undefined ? dto.assigneeId : taskBefore.assigneeId;
      if (assigneeId) {
        const profile = await this.prisma.employeeProfile.findUnique({
          where: { userId: assigneeId },
        });
        if (profile) {
          const newScore = Math.min(100, (profile.performanceScore || 0) + 2);
          await this.prisma.employeeProfile.update({
            where: { id: profile.id },
            data: { performanceScore: newScore },
          });
        }
      }
      
      const projId = updated.projectId || taskBefore.projectId;
      await this.handleTaskCompletion(projId);
    }

    return updated;
  }

  private async handleTaskCompletion(projectId: string | null) {
    if (!projectId) return;

    const projectTasks = await this.prisma.task.findMany({
      where: { projectId },
    });

    const allCompleted = projectTasks.length > 0 && projectTasks.every(t => t.status === TaskStatus.DONE);
    if (allCompleted) {
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.COMPLETED },
      });

      await this.prisma.projectMilestone.updateMany({
        where: { projectId },
        data: { status: MilestoneStatus.COMPLETED },
      });
    }
  }

  async updateStatus(id: string, status: TaskStatus, currentUser?: any) {
    const taskBefore = await this.findOne(id, currentUser);

    const updated = await this.prisma.task.update({
      where: { id },
      data: { status },
      select: { id: true, status: true, updatedAt: true },
    });

    if (status === TaskStatus.DONE && taskBefore.status !== TaskStatus.DONE && taskBefore.assigneeId) {
      const profile = await this.prisma.employeeProfile.findUnique({
        where: { userId: taskBefore.assigneeId },
      });
      if (profile) {
        const newScore = Math.min(100, (profile.performanceScore || 0) + 2);
        await this.prisma.employeeProfile.update({
          where: { id: profile.id },
          data: { performanceScore: newScore },
        });
      }
      await this.handleTaskCompletion(taskBefore.projectId);
    }

    return updated;
  }

  async delete(id: string, currentUser?: any) {
    if (currentUser && ['COLLABORATEUR', 'STAGIAIRE', 'SECRETAIRE'].includes(currentUser.role?.name)) {
      throw new ForbiddenException('Access denied: You do not have permission to delete tasks.');
    }
    await this.findOne(id, currentUser);

    return this.prisma.task.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
  }

  async restore(id: string, currentUser?: any) {
    if (currentUser && ['COLLABORATEUR', 'STAGIAIRE', 'SECRETAIRE'].includes(currentUser.role?.name)) {
      throw new ForbiddenException('Access denied: You do not have permission to restore tasks.');
    }
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Task with ID "${id}" not found`);
    }

    return this.prisma.task.update({
      where: { id },
      data: { isArchived: false, deletedAt: null },
    });
  }

  async getComments(taskId: string, currentUser?: any) {
    await this.findOne(taskId, currentUser);

    return this.prisma.taskComment.findMany({
      where: { taskId },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addComment(taskId: string, dto: CreateTaskCommentDto, currentUser: any) {
    await this.findOne(taskId, currentUser);

    return this.prisma.taskComment.create({
      data: {
        taskId,
        content: dto.content,
        authorId: currentUser.id,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  async deleteComment(commentId: string, requesterId: string) {
    const comment = await this.prisma.taskComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with id "${commentId}" not found`);
    }

    if (comment.authorId !== requesterId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    return this.prisma.taskComment.delete({ where: { id: commentId } });
  }

  async getAttachments(taskId: string, currentUser?: any) {
    await this.findOne(taskId, currentUser);

    return this.prisma.taskAttachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSubtasks(taskId: string, currentUser?: any) {
    await this.findOne(taskId, currentUser);

    return this.prisma.task.findMany({
      where: { parentTaskId: taskId },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        _count: {
          select: { comments: true, subTasks: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addAttachment(taskId: string, dto: CreateTaskAttachmentDto, currentUser?: any) {
    await this.findOne(taskId, currentUser);

    return this.prisma.taskAttachment.create({
      data: {
        taskId,
        name: dto.name,
        url: dto.url,
        size: dto.size,
        mimeType: dto.mimeType,
      },
    });
  }

  async deleteAttachment(attachmentId: string, currentUser?: any) {
    const attachment = await this.prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      include: { task: true },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment with id "${attachmentId}" not found`);
    }

    if (currentUser && currentUser.role?.name === 'COLLABORATEUR') {
      if (attachment.task.assigneeId !== currentUser.id && attachment.task.createdById !== currentUser.id) {
        throw new ForbiddenException('Access denied: You do not own the task associated with this attachment.');
      }
    }

    return this.prisma.taskAttachment.delete({
      where: { id: attachmentId },
    });
  }
}
