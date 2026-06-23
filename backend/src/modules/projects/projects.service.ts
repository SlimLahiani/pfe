import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ProjectStatus, ProjectMemberRole, MilestoneStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { paginate, getPaginationParams } from '../../core/dto/paginated-response';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Projects ────────────────────────────────────────────────────────────────

  async findAll(query: QueryProjectsDto, currentUser?: any) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      clientId,
      isArchived = false,
    } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const restrictedRoles = ['COLLABORATEUR', 'STAGIAIRE', 'CHEF_PROJET', 'CHEF_EQUIPE'];
    const isRestricted = currentUser && restrictedRoles.includes(currentUser.role?.name);

    const where: Prisma.ProjectWhereInput = {
      isArchived,
      ...(status && { status }),
      ...(clientId && { clientId }),
      ...(isRestricted && {
        members: {
          some: {
            userId: currentUser.id,
          },
        },
      }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const validSortFields: Record<string, keyof Prisma.ProjectOrderByWithRelationInput> = {
      createdAt: 'createdAt',
      endDate: 'endDate',
      name: 'name',
    };
    const orderBy: Prisma.ProjectOrderByWithRelationInput = {
      [validSortFields[sortBy] ?? 'createdAt']: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        skip,
        take,
        include: {
          client: { select: { id: true, companyName: true } },
          _count: {
            select: {
              members: true,
              milestones: true,
            },
          },
        },
        orderBy,
      }),
      this.prisma.project.count({ where }),
    ]);

    const paginated = paginate(data, total, page, limit);

    // Calculate dynamic counts by status
    const statsArray = await this.prisma.project.groupBy({
      by: ['status'],
      _count: true,
      where: { isArchived },
    });

    const stats = {
      PLANNING: 0,
      ACTIVE: 0,
      ON_HOLD: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    statsArray.forEach((s) => {
      if (s.status in stats) {
        stats[s.status] = s._count;
      }
    });

    return {
      ...paginated,
      stats,
    };
  }

  async findOne(id: string, currentUser?: any) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            milestones: true,
            tasks: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" not found`);
    }

    if (currentUser && ['COLLABORATEUR', 'STAGIAIRE', 'CHEF_PROJET', 'CHEF_EQUIPE'].includes(currentUser.role?.name)) {
      const isMember = project.members.some((m) => m.userId === currentUser.id);
      if (!isMember) {
        throw new ForbiddenException('Access denied: You are not a member of this project.');
      }
    }

    // Compute profitability metrics dynamically
    const expenses = await this.prisma.expense.findMany({
      where: { projectId: id, isApproved: true },
    });
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const tasks = await this.prisma.task.findMany({
      where: { projectId: id },
    });
    const totalHours = tasks.reduce((sum, t) => sum + Number(t.actualHours || t.estimatedHours || 0), 0);
    const laborCost = totalHours * 50.0; // 50 TND hourly rate allocation

    const budget = Number(project.budget || 0);
    const profit = budget - totalExpenses - laborCost;
    const profitabilityPercent = budget > 0 ? (profit / budget) * 100 : 0;
    const marginPercent = budget > 0 ? ((budget - totalExpenses) / budget) * 100 : 0;

    return {
      ...project,
      financials: {
        revenue: budget,
        expenses: totalExpenses,
        laborCost,
        profit,
        profitabilityPercent: Math.round(profitabilityPercent * 10) / 10,
        marginPercent: Math.round(marginPercent * 10) / 10,
      },
    };
  }

  async create(dto: CreateProjectDto, creatorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Find latest project code starting with [PRJ-
      let projectCode = '[PRJ-001]';
      const latestProject = await tx.project.findFirst({
        where: {
          name: {
            startsWith: '[PRJ-',
          },
        },
        orderBy: {
          name: 'desc',
        },
        select: {
          name: true,
        },
      });

      if (latestProject && latestProject.name) {
        const match = latestProject.name.match(/^\[PRJ-(\d+)\]/);
        if (match) {
          const lastSeq = parseInt(match[1], 10);
          if (!isNaN(lastSeq)) {
            projectCode = `[PRJ-${String(lastSeq + 1).padStart(3, '0')}]`;
          }
        }
      }

      const projectName = dto.name.startsWith('[PRJ-') ? dto.name : `${projectCode} ${dto.name}`;

      const project = await tx.project.create({
        data: {
          name: projectName,
          description: dto.description,
          clientId: dto.clientId,
          budget: dto.budget,
          currency: dto.currency ?? 'USD',
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          status: dto.status ? (dto.status as ProjectStatus) : ProjectStatus.PLANNING,
          priority: dto.priority ?? 'MEDIUM',
          isArchived: false,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: creatorUserId,
          role: ProjectMemberRole.MANAGER,
        },
      });

      return project;
    });
  }

  async update(id: string, dto: UpdateProjectDto, currentUser?: any) {
    await this.findOne(id, currentUser);

    return this.prisma.project.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async archive(id: string, currentUser?: any) {
    await this.findOne(id, currentUser);

    return this.prisma.project.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
  }

  async unarchive(id: string, currentUser?: any) {
    if (currentUser && ['COLLABORATEUR', 'STAGIAIRE', 'CHEF_EQUIPE'].includes(currentUser.role?.name)) {
      throw new ForbiddenException('Access denied: You do not have permission to restore or unarchive projects.');
    }
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" not found`);
    }

    return this.prisma.project.update({
      where: { id },
      data: { isArchived: false, deletedAt: null },
    });
  }

  // ─── Members ─────────────────────────────────────────────────────────────────

  async getMembers(projectId: string, currentUser?: any) {
    await this.findOne(projectId, currentUser);

    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async addMember(projectId: string, dto: AddMemberDto, currentUser?: any) {
    if (currentUser && ['COLLABORATEUR', 'STAGIAIRE', 'CHEF_EQUIPE'].includes(currentUser.role?.name)) {
      throw new ForbiddenException('Access denied: You do not have permission to add members to projects.');
    }
    const project = await this.findOne(projectId, currentUser);

    const member = await this.prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId: dto.userId,
        },
      },
      update: {
        role: dto.role ?? ProjectMemberRole.MEMBER,
      },
      create: {
        projectId,
        userId: dto.userId,
        role: dto.role ?? ProjectMemberRole.MEMBER,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    try {
      await this.notificationsService.createNotification(
        dto.userId,
        'SYSTEM',
        `Assigned to Project: ${project.name}`,
        `You have been added to the project "${project.name}" as a ${dto.role || 'MEMBER'}.`,
        projectId,
      );
    } catch {
      // Swallow
    }

    return member;
  }

  async removeMember(projectId: string, userId: string, currentUser?: any) {
    if (currentUser && ['COLLABORATEUR', 'STAGIAIRE', 'CHEF_EQUIPE'].includes(currentUser.role?.name)) {
      throw new ForbiddenException('Access denied: You do not have permission to remove members from projects.');
    }
    await this.findOne(projectId, currentUser);

    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException(
        `Member with user ID "${userId}" not found in project "${projectId}"`,
      );
    }

    return this.prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });
  }

  // ─── Milestones ───────────────────────────────────────────────────────────────

  async getMilestones(projectId: string, currentUser?: any) {
    await this.findOne(projectId, currentUser);

    return this.prisma.projectMilestone.findMany({
      where: { projectId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async createMilestone(projectId: string, dto: CreateMilestoneDto, currentUser?: any) {
    if (currentUser && currentUser.role?.name === 'COLLABORATEUR') {
      throw new ForbiddenException('Access denied: Employees cannot create milestones.');
    }
    await this.findOne(projectId, currentUser);

    return this.prisma.projectMilestone.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description,
        dueDate: new Date(dto.dueDate),
        status: dto.status ?? MilestoneStatus.PENDING,
      },
    });
  }

  async updateMilestone(
    milestoneId: string,
    dto: Partial<CreateMilestoneDto>,
    currentUser?: any,
  ) {
    const milestone = await this.prisma.projectMilestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      throw new NotFoundException(
        `Milestone with ID "${milestoneId}" not found`,
      );
    }

    if (currentUser && currentUser.role?.name === 'COLLABORATEUR') {
      await this.findOne(milestone.projectId, currentUser);
    }

    return this.prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  async deleteMilestone(milestoneId: string, currentUser?: any) {
    const milestone = await this.prisma.projectMilestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      throw new NotFoundException(
        `Milestone with ID "${milestoneId}" not found`,
      );
    }

    if (currentUser && currentUser.role?.name === 'COLLABORATEUR') {
      throw new ForbiddenException('Access denied: Employees cannot delete milestones.');
    }

    return this.prisma.projectMilestone.delete({
      where: { id: milestoneId },
    });
  }

  // ─── Files ────────────────────────────────────────────────────────────────────

  async getFiles(projectId: string, currentUser?: any) {
    await this.findOne(projectId, currentUser);

    return this.prisma.projectFile.findMany({
      where: { projectId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
