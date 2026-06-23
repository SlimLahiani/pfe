import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeProfileDto } from './dto/create-employee-profile.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateSalaryDto } from './dto/create-salary.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { QueryLeaveRequestsDto } from './dto/query-leave-requests.dto';
import { CreateVacancyDto } from './dto/create-vacancy.dto';
import { QueryVacanciesDto } from './dto/query-vacancies.dto';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { QueryCandidatesDto } from './dto/query-candidates.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { LeaveStatus, LeaveType, Prisma } from '@prisma/client';
import { paginate, getPaginationParams } from '../../core/dto/paginated-response';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Employee Profiles ────────────────────────────────────────────────────────

  async findAllEmployees(query: QueryEmployeesDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'hireDate',
      sortOrder = 'desc',
      departmentId,
      isActive,
      showArchived,
      isArchived,
      status,
    } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const archivedFilter = showArchived === true || isArchived === true;

    const where: Prisma.EmployeeProfileWhereInput = {
      isArchived: archivedFilter,
      ...(departmentId && { departmentId }),
      ...(status && { status }),
      ...(isActive !== undefined && {
        user: { isActive },
      }),
      ...(search && {
        OR: [
          { employeeCode: { contains: search, mode: 'insensitive' } },
          { jobTitle: { contains: search, mode: 'insensitive' } },
          {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      }),
    };

    const validSortFields: Record<string, keyof Prisma.EmployeeProfileOrderByWithRelationInput> = {
      hireDate: 'hireDate',
      createdAt: 'createdAt',
      jobTitle: 'jobTitle',
    };
    const orderBy: Prisma.EmployeeProfileOrderByWithRelationInput = {
      [validSortFields[sortBy] ?? 'hireDate']: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.employeeProfile.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, isActive: true } },
          department: true,
        },
        orderBy,
      }),
      this.prisma.employeeProfile.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findEmployeeById(id: string, currentUser?: any) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        department: true,
        contracts: true,
        salaries: true,
        leaveRequests: true,
        leaveBalances: true,
      },
    });

    if (!profile) {
      throw new NotFoundException(`Employee profile with ID "${id}" not found`);
    }

    if (currentUser && currentUser.role?.name === 'COLLABORATEUR' && profile.userId !== currentUser.id) {
      throw new ForbiddenException('Access denied: You can only access your own profile details.');
    }

    return profile;
  }

  async findEmployeeByUserId(userId: string) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
      include: {
        department: true,
      },
    });

    if (!profile) {
      throw new NotFoundException(`Employee profile for User ID "${userId}" not found`);
    }

    return profile;
  }

  async createEmployeeProfile(dto: CreateEmployeeProfileDto) {
    const exists = await this.prisma.employeeProfile.findUnique({
      where: { userId: dto.userId },
    });

    if (exists) {
      throw new BadRequestException('Employee profile already exists for this user.');
    }

    return this.prisma.employeeProfile.create({
      data: {
        userId: dto.userId,
        departmentId: dto.departmentId,
        jobTitle: dto.jobTitle,
        employeeCode: dto.employeeCode,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        nationalId: dto.nationalId,
        phone: dto.phone,
        address: dto.address,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
        emergencyContact: dto.emergencyContact,
      },
    });
  }

  async updateEmployeeProfile(id: string, dto: Partial<CreateEmployeeProfileDto>, currentUser?: any) {
    const employee = await this.findEmployeeById(id, currentUser);

    if (currentUser) {
      const roleName = currentUser.role?.name;
      const isSelf = employee.userId === currentUser.id;
      if (!isSelf && roleName !== 'GERANT' && roleName !== 'RESPONSABLE_RH') {
        throw new ForbiddenException('Access denied: You cannot edit other employees.');
      }
    }

    return this.prisma.employeeProfile.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
      },
    });
  }

  async deleteEmployeeProfile(id: string, currentUser?: any) {
    await this.findEmployeeById(id, currentUser);

    if (currentUser) {
      const roleName = currentUser.role?.name;
      if (roleName !== 'GERANT' && roleName !== 'RESPONSABLE_RH') {
        throw new ForbiddenException('Access denied: Only CEO or HR Manager can delete employees.');
      }
    }

    return this.prisma.employeeProfile.update({
      where: { id },
      data: { isArchived: true, status: 'TERMINATED', deletedAt: new Date() },
    });
  }

  async restoreEmployeeProfile(id: string, currentUser?: any) {
    if (currentUser) {
      const roleName = currentUser.role?.name;
      if (roleName !== 'GERANT' && roleName !== 'RESPONSABLE_RH') {
        throw new ForbiddenException('Access denied: Only CEO or HR Manager can restore employees.');
      }
    }

    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id },
    });
    if (!employee) {
      throw new NotFoundException(`Collaborateur introuvable.`);
    }

    return this.prisma.employeeProfile.update({
      where: { id },
      data: { isArchived: false, status: 'ACTIVE', deletedAt: null },
    });
  }

  // ─── Departments ──────────────────────────────────────────────────────────────

  async findAllDepartments(query?: { showArchived?: boolean }) {
    const showArchived = query?.showArchived === true;
    return this.prisma.department.findMany({
      where: { isArchived: showArchived },
      include: {
        employees: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(dto: CreateDepartmentDto) {
    const exists = await this.prisma.department.findUnique({
      where: { name: dto.name },
    });

    if (exists) {
      throw new BadRequestException(`Department with name "${dto.name}" already exists.`);
    }

    return this.prisma.department.create({
      data: {
        name: dto.name,
        description: dto.description,
        managerId: dto.managerId,
      },
    });
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException(`Department with ID "${id}" not found`);
    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.managerId !== undefined && { managerId: dto.managerId }),
      },
    });
  }

  async deleteDepartment(id: string) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException(`Department with ID "${id}" not found`);
    return this.prisma.department.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
  }

  async restoreDepartment(id: string) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException(`Department with ID "${id}" not found`);
    return this.prisma.department.update({
      where: { id },
      data: { isArchived: false, deletedAt: null },
    });
  }

  // ─── Contracts ────────────────────────────────────────────────────────────────

  async getContracts(employeeId: string, currentUser?: any) {
    await this.findEmployeeById(employeeId, currentUser);
    return this.prisma.contract.findMany({
      where: { employeeId },
      orderBy: { startDate: 'desc' },
    });
  }

  async createContract(employeeId: string, dto: CreateContractDto) {
    await this.findEmployeeById(employeeId);

    return this.prisma.$transaction(async (tx) => {
      // Set previous active contracts to inactive
      await tx.contract.updateMany({
        where: { employeeId, isActive: true },
        data: { isActive: false },
      });

      return tx.contract.create({
        data: {
          employeeId,
          type: dto.type,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          grossSalary: dto.grossSalary,
          currency: dto.currency || 'TND',
          documentUrl: dto.documentUrl,
          isActive: true,
          notes: dto.notes,
        },
      });
    });
  }

  async deleteContract(employeeId: string, contractId: string) {
    await this.findEmployeeById(employeeId);
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract || contract.employeeId !== employeeId) {
      throw new NotFoundException(`Contract with ID "${contractId}" not found for this employee`);
    }
    return this.prisma.contract.delete({ where: { id: contractId } });
  }

  // ─── Salaries ─────────────────────────────────────────────────────────────────

  async getSalaries(employeeId: string, currentUser?: any) {
    await this.findEmployeeById(employeeId, currentUser);
    return this.prisma.salary.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async createSalary(employeeId: string, dto: CreateSalaryDto) {
    await this.findEmployeeById(employeeId);

    return this.prisma.$transaction(async (tx) => {
      // End the previous salary block
      await tx.salary.updateMany({
        where: { employeeId, effectiveTo: null },
        data: { effectiveTo: new Date(dto.effectiveFrom) },
      });

      return tx.salary.create({
        data: {
          employeeId,
          amount: dto.amount,
          currency: dto.currency || 'TND',
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          note: dto.note,
        },
      });
    });
  }

  // ─── Leave Requests ───────────────────────────────────────────────────────────

  async findAllLeaveRequests(query: QueryLeaveRequestsDto, currentUser?: any) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      type,
      employeeId,
      dateFrom,
      dateTo,
      isArchived = false,
    } = query;
    const { skip, take } = getPaginationParams(page, limit);

    let finalEmployeeId = employeeId;
    if (currentUser?.role?.name === 'COLLABORATEUR') {
      const empProfile = await this.prisma.employeeProfile.findUnique({
        where: { userId: currentUser.id },
      });
      finalEmployeeId = empProfile ? empProfile.id : 'non-existent-id';
    }

    const where: Prisma.LeaveRequestWhereInput = {
      isArchived,
      ...(status && { status }),
      ...(type && { type }),
      employeeId: finalEmployeeId || undefined,
      ...((dateFrom || dateTo) && {
        startDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
      ...(search && {
        employee: {
          user: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      }),
    };

    const validSortFields: Record<string, keyof Prisma.LeaveRequestOrderByWithRelationInput> = {
      createdAt: 'createdAt',
      startDate: 'startDate',
      endDate: 'endDate',
      days: 'days',
    };
    const orderBy: Prisma.LeaveRequestOrderByWithRelationInput = {
      [validSortFields[sortBy] ?? 'createdAt']: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        skip,
        take,
        include: {
          employee: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          requestedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async createLeaveRequest(employeeId: string, requestedById: string, dto: CreateLeaveRequestDto, currentUser?: any) {
    const employee = await this.findEmployeeById(employeeId);

    if (currentUser && currentUser.role?.name !== 'GERANT' && currentUser.role?.name !== 'RESPONSABLE_RH') {
      if (employee.userId !== currentUser.id) {
        throw new ForbiddenException('You can only create leave requests for yourself.');
      }
    }

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        employeeId,
        requestedById,
        type: dto.type,
        startDate: start,
        endDate: end,
        days: diffDays,
        status: LeaveStatus.PENDING,
        reason: dto.reason,
      },
    });

    try {
      const reviewers = await this.prisma.user.findMany({
        where: {
          role: {
            name: { in: ['GERANT', 'RESPONSABLE_RH'] },
          },
        },
      });

      const empName = `${employee.user.firstName} ${employee.user.lastName}`;
      for (const rev of reviewers) {
        await this.notificationsService.createNotification(
          rev.id,
          'SYSTEM',
          `New Leave Request: ${empName}`,
          `${empName} has requested ${diffDays} day(s) of ${dto.type} leave from ${dto.startDate} to ${dto.endDate}.`,
          leaveRequest.id,
        );
      }
    } catch {
      // Swallow
    }

    return leaveRequest;
  }

  async createLeaveRequestSelf(userId: string, dto: CreateLeaveRequestDto) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException(`Employee profile for user ID "${userId}" not found`);
    }
    return this.createLeaveRequest(profile.id, userId, dto);
  }

  async reviewLeaveRequest(id: string, reviewerId: string, dto: ReviewLeaveRequestDto) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: { include: { user: true } },
      },
    });

    if (!leave) {
      throw new NotFoundException(`Leave request with ID "${id}" not found`);
    }

    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerId },
      include: { role: true },
    });

    if (!reviewer) {
      throw new NotFoundException(`Reviewer with ID "${reviewerId}" not found`);
    }

    const reviewerRole = reviewer.role.name;

    // Standard Employee cannot review leave requests
    if (reviewerRole === 'COLLABORATEUR') {
      throw new ForbiddenException('Employees are not authorized to review leave requests.');
    }

    // Role-based logic
    if (reviewerRole === 'RESPONSABLE_RH') {
      // HR Manager can only mark as REVIEWED
      if (dto.status !== (LeaveStatus as any).REVIEWED) {
        throw new BadRequestException('HR Manager can only mark leave requests as REVIEWED.');
      }
      if (leave.status !== LeaveStatus.PENDING) {
        throw new BadRequestException('HR Manager can only review PENDING leave requests.');
      }
    } else if (reviewerRole === 'GERANT') {
      // CEO can approve/reject PENDING or REVIEWED requests
      if (dto.status !== LeaveStatus.APPROVED && dto.status !== LeaveStatus.REJECTED) {
        throw new BadRequestException('CEO can only approve or reject leave requests.');
      }
      if (leave.status !== LeaveStatus.PENDING && leave.status !== (LeaveStatus as any).REVIEWED) {
        throw new BadRequestException('CEO can only approve or reject PENDING or REVIEWED leave requests.');
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedLeave = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: dto.status,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewNote: dto.reviewNote,
        },
      });

      // If approved, update LeaveBalance
      if (dto.status === LeaveStatus.APPROVED) {
        const year = leave.startDate.getFullYear();
        const balance = await tx.leaveBalance.findUnique({
          where: {
            employeeId_leaveType_year: {
              employeeId: leave.employeeId,
              leaveType: leave.type,
              year,
            },
          },
        });

        if (balance) {
          const usedDays = Number(balance.usedDays) + Number(leave.days);
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { usedDays },
          });
        } else {
          // Initialize balance automatically if not present
          await tx.leaveBalance.create({
            data: {
              employeeId: leave.employeeId,
              leaveType: leave.type,
              year,
              totalDays: 30, // standard default
              usedDays: leave.days,
              pendingDays: 0,
            },
          });
        }

        // Create CalendarEvent
        const eventTitle = `Congés: ${leave.employee.user.firstName} ${leave.employee.user.lastName}`;
        const eventDescription = `Absence autorisée pour congés (${leave.type}). Motif: ${leave.reason || 'Aucun motif renseigné'}.`;

        const newEvent = await tx.calendarEvent.create({
          data: {
            title: eventTitle,
            description: eventDescription,
            type: 'HOLIDAY',
            startDate: leave.startDate,
            endDate: leave.endDate,
            allDay: true,
            createdById: reviewerId,
          },
        });

        // Add the employee as attendee
        await tx.eventAttendee.create({
          data: {
            eventId: newEvent.id,
            userId: leave.employee.userId,
            accepted: true,
          },
        });

        // Update Employee status to ON_LEAVE
        await tx.employeeProfile.update({
          where: { id: leave.employeeId },
          data: { status: 'ON_LEAVE' },
        });
      } else if (dto.status === LeaveStatus.REJECTED || dto.status === LeaveStatus.CANCELLED) {
        // Revert employee status to ACTIVE
        await tx.employeeProfile.update({
          where: { id: leave.employeeId },
          data: { status: 'ACTIVE' },
        });
      }

      return updatedLeave;
    });

    try {
      const empName = `${leave.employee.user.firstName} ${leave.employee.user.lastName}`;
      if (dto.status === (LeaveStatus as any).REVIEWED) {
        // Notify all CEO users
        const ceoUsers = await this.prisma.user.findMany({
          where: { role: { name: 'GERANT' } },
          select: { id: true },
        });
        for (const ceo of ceoUsers) {
          await this.notificationsService.createNotification(
            ceo.id,
            'SYSTEM',
            `Leave Request Reviewed by HR`,
            `${empName}'s request for ${Number(leave.days)} day(s) was reviewed by HR and is pending your final approval.`,
            id,
          );
        }
      } else {
        // Notify the employee of CEO decision
        await this.notificationsService.createNotification(
          leave.requestedById,
          'LEAVE_REQUEST_UPDATED',
          `Leave Request ${dto.status}`,
          `Your requested leave of ${Number(leave.days)} day(s) has been ${dto.status.toLowerCase()} by the CEO.`,
          id,
        );
      }
    } catch {
      // Swallow notification errors
    }

    return result;
  }

  async updateLeaveRequest(id: string, dto: UpdateLeaveRequestDto) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
    });
    if (!leave) {
      throw new NotFoundException(`Leave request with ID "${id}" not found`);
    }

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Seules les demandes de congé en attente (PENDING) peuvent être modifiées.');
    }

    const start = dto.startDate ? new Date(dto.startDate) : leave.startDate;
    const end = dto.endDate ? new Date(dto.endDate) : leave.endDate;

    let diffDays = Number(leave.days);
    if (dto.startDate || dto.endDate) {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        ...(dto.type && { type: dto.type }),
        ...(dto.startDate && { startDate: start }),
        ...(dto.endDate && { endDate: end }),
        ...(dto.reason !== undefined && { reason: dto.reason }),
        days: diffDays,
      },
    });
  }

  async deleteLeaveRequest(id: string) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) {
      throw new NotFoundException(`Leave request with ID "${id}" not found`);
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
  }

  async restoreLeaveRequest(id: string) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) {
      throw new NotFoundException(`Leave request with ID "${id}" not found`);
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: { isArchived: false, deletedAt: null },
    });
  }

  // ─── Leave Balances ───────────────────────────────────────────────────────────

  async getLeaveBalances(employeeId: string, currentUser?: any) {
    await this.findEmployeeById(employeeId, currentUser);
    return this.prisma.leaveBalance.findMany({
      where: { employeeId },
      orderBy: { year: 'desc' },
    });
  }

  async updateLeaveBalance(
    employeeId: string,
    leaveType: LeaveType,
    year: number,
    dto: { totalDays: number; usedDays?: number; pendingDays?: number },
  ) {
    await this.findEmployeeById(employeeId);

    return this.prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveType_year: {
          employeeId,
          leaveType,
          year,
        },
      },
      update: {
        totalDays: dto.totalDays,
        ...(dto.usedDays !== undefined && { usedDays: dto.usedDays }),
        ...(dto.pendingDays !== undefined && { pendingDays: dto.pendingDays }),
      },
      create: {
        employeeId,
        leaveType,
        year,
        totalDays: dto.totalDays,
        usedDays: dto.usedDays || 0,
        pendingDays: dto.pendingDays || 0,
      },
    });
  }

  // ─── HR Dashboard & Analytics ──────────────────────────────────────────────────

  async getHRDashboard() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const totalEmployees = await this.prisma.employeeProfile.count();
    const activeEmployees = await this.prisma.employeeProfile.count({
      where: { status: 'ACTIVE' },
    });
    const newEmployees = await this.prisma.employeeProfile.count({
      where: { hireDate: { gte: thirtyDaysAgo } },
    });

    const employeesOnLeave = await this.prisma.leaveRequest.count({
      where: {
        status: LeaveStatus.APPROVED,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    const expiringContracts = await this.prisma.contract.count({
      where: {
        isActive: true,
        endDate: { gte: now, lte: thirtyDaysAhead },
      },
    });

    const avgProd = await this.prisma.employeeProfile.aggregate({
      _avg: { performanceScore: true },
    });

    const todayPresent = await this.prisma.attendance.count({
      where: {
        date: startOfToday,
        status: { in: ['PRESENT', 'LATE', 'REMOTE'] },
      },
    });

    const attendanceRate = activeEmployees > 0 ? (todayPresent / activeEmployees) * 100 : 100;

    const pendingLeaves = await this.prisma.leaveRequest.count({
      where: {
        status: { in: [LeaveStatus.PENDING, (LeaveStatus as any).REVIEWED] },
      },
    });

    return {
      totalEmployees,
      activeEmployees,
      newEmployees,
      employeesOnLeave,
      contractsExpiringSoon: expiringContracts,
      averageProductivity: Math.round(avgProd._avg.performanceScore ?? 90),
      attendanceRate: Math.round(attendanceRate),
      leaveRequestsPending: pendingLeaves,
    };
  }

  async getHRAnalytics() {
    // 1. Employee Growth (last 6 months)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const employees = await this.prisma.employeeProfile.findMany({
      where: { hireDate: { gte: sixMonthsAgo } },
      select: { hireDate: true },
    });

    const growthMap: Record<string, number> = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('fr-FR', { month: 'short', year: 'numeric' });
      growthMap[label] = 0;
    }

    employees.forEach((emp) => {
      if (emp.hireDate) {
        const label = emp.hireDate.toLocaleString('fr-FR', { month: 'short', year: 'numeric' });
        if (growthMap[label] !== undefined) {
          growthMap[label]++;
        }
      }
    });

    const employeeGrowth = Object.entries(growthMap)
      .map(([month, count]) => ({ month, count }))
      .reverse();

    // 2. Department Distribution
    const depts = await this.prisma.department.findMany({
      include: { _count: { select: { employees: true } } },
    });
    const departmentDistribution = depts.map((d) => ({
      departmentName: d.name,
      count: d._count.employees,
    }));

    // 3. Leave Statistics
    const leaveStatsRaw = await this.prisma.leaveRequest.groupBy({
      by: ['type'],
      _count: true,
    });
    const leaveStatistics = leaveStatsRaw.map((stat) => ({
      type: stat.type,
      count: stat._count,
    }));

    // 4. Productivity Trends by Department
    const prodTrends = await this.prisma.department.findMany({
      include: {
        employees: {
          select: { performanceScore: true },
        },
      },
    });
    const productivityTrends = prodTrends.map((d) => {
      const avg = d.employees.length > 0
        ? d.employees.reduce((sum, e) => sum + e.performanceScore, 0) / d.employees.length
        : 85;
      return {
        departmentName: d.name,
        averageProductivity: Math.round(avg),
      };
    });

    return {
      employeeGrowth,
      departmentDistribution,
      leaveStatistics,
      productivityTrends,
    };
  }

  // ─── Attendance System ────────────────────────────────────────────────────────

  async checkIn(userId: string) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException(`Profil employé introuvable pour l'utilisateur ${userId}`);
    }

    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const existing = await this.prisma.attendance.findUnique({
      where: {
        employeeId_date: { employeeId: profile.id, date },
      },
    });

    if (existing && existing.checkIn) {
      throw new BadRequestException('Déjà émargé (Check In) pour aujourd\'hui.');
    }

    const status = now.getHours() >= 9 && now.getMinutes() > 15 ? 'LATE' : 'PRESENT';

    return this.prisma.attendance.upsert({
      where: {
        employeeId_date: { employeeId: profile.id, date },
      },
      update: {
        checkIn: now,
        status,
      },
      create: {
        employeeId: profile.id,
        date,
        checkIn: now,
        status,
      },
    });
  }

  async checkOut(userId: string) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException(`Profil employé introuvable pour l'utilisateur ${userId}`);
    }

    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const existing = await this.prisma.attendance.findUnique({
      where: {
        employeeId_date: { employeeId: profile.id, date },
      },
    });

    if (!existing || !existing.checkIn) {
      throw new BadRequestException('Veuillez d\'abord faire votre Check In.');
    }

    if (existing.checkOut) {
      throw new BadRequestException('Déjà émargé (Check Out) pour aujourd\'hui.');
    }

    const diffMs = now.getTime() - existing.checkIn.getTime();
    const hoursWorked = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
    const overtime = hoursWorked > 8 ? Number((hoursWorked - 8).toFixed(2)) : 0;

    return this.prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkOut: now,
        hoursWorked,
        overtime,
      },
    });
  }

  async getAttendance(employeeId: string, currentUser?: any) {
    await this.findEmployeeById(employeeId, currentUser);
    return this.prisma.attendance.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' },
      take: 100,
    });
  }

  async getMyAttendance(userId: string) {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      return [];
    }
    return this.prisma.attendance.findMany({
      where: { employeeId: profile.id },
      orderBy: { date: 'desc' },
      take: 100,
    });
  }

  async getAttendanceTodayReport() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todayRecords = await this.prisma.attendance.findMany({
      where: { date: startOfToday },
      include: { employee: { include: { user: true } } },
    });

    const activeEmployees = await this.prisma.employeeProfile.findMany({
      where: { status: 'ACTIVE' },
      include: { user: true },
    });

    const presentIds = todayRecords.map((r) => r.employeeId);
    const absents = activeEmployees
      .filter((emp) => !presentIds.includes(emp.id))
      .map((emp) => ({
        employeeId: emp.id,
        name: `${emp.user.firstName} ${emp.user.lastName}`,
        status: 'ABSENT',
      }));

    const presents = todayRecords.map((r) => ({
      employeeId: r.employeeId,
      name: `${r.employee.user.firstName} ${r.employee.user.lastName}`,
      status: r.status,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
    }));

    return {
      records: [...presents, ...absents],
      summary: {
        present: todayRecords.filter((r) => r.status === 'PRESENT').length,
        late: todayRecords.filter((r) => r.status === 'LATE').length,
        remote: todayRecords.filter((r) => r.status === 'REMOTE').length,
        absent: absents.length,
      },
    };
  }

  // ─── Salary Management ────────────────────────────────────────────────────────

  async getPayslips(employeeId: string, currentUser?: any) {
    await this.findEmployeeById(employeeId, currentUser);
    return this.prisma.payslip.findMany({
      where: { employeeId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async getPayslipById(id: string, currentUser?: any) {
    const payslip = await this.prisma.payslip.findUnique({
      where: { id },
      include: { employee: { include: { user: true, department: true } } },
    });
    if (!payslip) {
      throw new NotFoundException(`Bulletin de paie introuvable.`);
    }
    if (currentUser && currentUser.role?.name === 'COLLABORATEUR' && payslip.employee.userId !== currentUser.id) {
      throw new ForbiddenException('Access denied: You can only download your own payslips.');
    }
    return payslip;
  }

  async createPayslip(employeeId: string, dto: { month: number; year: number; bonuses?: number; deductions?: number; notes?: string; status?: string }) {
    // Get latest active contract or salary to determine base salary
    const salaries = await this.prisma.salary.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
      take: 1,
    });
    const baseSalary = salaries.length > 0 ? Number(salaries[0].amount) : 1200; // default backup

    // Compute overtime hours from attendance in that month/year
    const startDate = new Date(dto.year, dto.month - 1, 1);
    const endDate = new Date(dto.year, dto.month, 0);

    const attendances = await this.prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
    });

    const overtimeHours = attendances.reduce((sum, att) => sum + Number(att.overtime ?? 0), 0);
    // Supppose 1 hour overtime pays 1.25x of standard base hourly rate (assumed 173 hours/month)
    const hourlyRate = baseSalary / 173;
    const overtimePay = overtimeHours * hourlyRate * 1.25;

    const bonuses = dto.bonuses || 0;
    const deductions = dto.deductions || 0;
    const netSalary = baseSalary + overtimePay + bonuses - deductions;

    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id: employeeId },
      include: { user: true, department: true },
    });
    if (!employee) {
      throw new NotFoundException(`Collaborateur introuvable.`);
    }

    const statusVal = dto.status || 'DRAFT';

    const payslip = await this.prisma.payslip.create({
      data: {
        employeeId,
        month: dto.month,
        year: dto.year,
        baseSalary,
        bonuses,
        deductions,
        overtime: overtimePay,
        netSalary,
        notes: dto.notes,
        status: statusVal,
      },
    });

    if (statusVal === 'PAID') {
      await this.createExpenseForPayslip(payslip, employee);
    }

    return payslip;
  }

  private async createExpenseForPayslip(payslip: any, employee: any) {
    const description = `Salaire - ${employee.user.firstName} ${employee.user.lastName} - ${payslip.month}/${payslip.year}`;

    // Check if expense already exists for this payslip to avoid duplicate expenses
    const existingExpense = await this.prisma.expense.findFirst({
      where: {
        description,
      },
    });

    if (!existingExpense) {
      let category = await this.prisma.expenseCategory.findUnique({
        where: { name: 'Salaires & Rémunérations' },
      });
      if (!category) {
        category = await this.prisma.expenseCategory.create({
          data: {
            name: 'Salaires & Rémunérations',
            description: 'Salaires et rémunérations des employés',
          },
        });
      }

      const expense = await this.prisma.expense.create({
        data: {
          categoryId: category.id,
          submittedById: employee.userId,
          description,
          amount: new Prisma.Decimal(payslip.netSalary),
          currency: 'TND',
          expenseDate: new Date(),
          isApproved: true,
          approvedById: employee.department?.managerId || employee.userId,
          notes: `Généré automatiquement suite à la validation de la fiche de paie.`,
          departmentId: employee.departmentId,
        },
      });

      await this.prisma.expenseApprovalWorkflow.create({
        data: {
          expenseId: expense.id,
          userId: employee.department?.managerId || employee.userId,
          status: 'APPROVED',
          notes: 'Approuvé automatiquement lors de la validation de la fiche de paie.',
        },
      });
    }
  }

  async updatePayslipStatus(id: string, status: string) {
    const payslip = await this.prisma.payslip.findUnique({
      where: { id },
      include: { employee: { include: { user: true, department: true } } },
    });
    if (!payslip) {
      throw new NotFoundException(`Bulletin de paie introuvable.`);
    }

    const updated = await this.prisma.payslip.update({
      where: { id },
      data: { status },
    });

    if (status === 'PAID') {
      await this.createExpenseForPayslip(updated, payslip.employee);
    }

    return updated;
  }

  async deletePayslip(id: string) {
    const payslip = await this.prisma.payslip.findUnique({ where: { id } });
    if (!payslip) {
      throw new NotFoundException(`Bulletin de paie introuvable.`);
    }
    return this.prisma.payslip.delete({ where: { id } });
  }

  // ─── Employee Lifecycle & Career History ──────────────────────────────────────────

  async getEmployeeHistory(employeeId: string, currentUser?: any) {
    await this.findEmployeeById(employeeId, currentUser);
    return this.prisma.employeeHistory.findMany({
      where: { employeeId },
      orderBy: { eventDate: 'desc' },
    });
  }

  async addHistoryEvent(employeeId: string, dto: { eventType: string; title: string; description?: string; notes?: string }) {
    return this.prisma.employeeHistory.create({
      data: {
        employeeId,
        eventType: dto.eventType,
        title: dto.title,
        description: dto.description,
        notes: dto.notes,
      },
    });
  }

  // ─── Onboarding Checklist ──────────────────────────────────────────────────────

  async getOnboardingTasks(employeeId: string, currentUser?: any) {
    await this.findEmployeeById(employeeId, currentUser);
    // If onboarding tasks don't exist yet, create default ones
    const existing = await this.prisma.onboardingTask.findMany({
      where: { employeeId },
    });

    if (existing.length === 0) {
      const defaults = [
        'Création des comptes (Email, Slack, Jira)',
        'Signature du contrat de travail',
        'Signature de l\'accord de confidentialité (NDA)',
        'Remise du matériel (Ordinateur, Badge)',
        'Assignation d\'un parrain / mentor',
        'Entretien d\'intégration RH complet',
      ];

      await this.prisma.onboardingTask.createMany({
        data: defaults.map((taskName) => ({
          employeeId,
          taskName,
          isCompleted: false,
        })),
      });

      return this.prisma.onboardingTask.findMany({
        where: { employeeId },
      });
    }

    return existing;
  }

  async toggleOnboardingTask(employeeId: string, taskId: string, isCompleted: boolean) {
    await this.prisma.onboardingTask.update({
      where: { id: taskId },
      data: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    });

    // Recalculate progress percentage
    const all = await this.prisma.onboardingTask.findMany({
      where: { employeeId },
    });

    const completed = all.filter((t) => t.isCompleted).length;
    const progress = Math.round((completed / all.length) * 100);

    const updatedProfile = await this.prisma.employeeProfile.update({
      where: { id: employeeId },
      data: {
        onboardingProgress: progress,
        ...(progress === 100 && { lifecycleStage: 'ACTIVE' }),
      },
    });

    if (progress === 100) {
      await this.addHistoryEvent(employeeId, {
        eventType: 'STAGE_CHANGE',
        title: 'Intégration Terminée (Onboarding)',
        description: 'L\'employé a complété avec succès tout son parcours d\'onboarding.',
      });
    }

    return {
      tasks: all,
      progress,
      profile: updatedProfile,
    };
  }

  // ─── HR Intelligence Recommendations ───────────────────────────────────────────

  async getHRRecommendations() {
    const activeProfiles = await this.prisma.employeeProfile.findMany({
      where: { status: 'ACTIVE' },
      include: { user: true, department: true, leaveRequests: true },
    });

    const recommendations: { type: string; title: string; description: string; employeeName: string; employeeId: string }[] = [];

    for (const emp of activeProfiles) {
      const name = `${emp.user.firstName} ${emp.user.lastName}`;

      // 1. Expiring contract renew warning (checked contracts)
      const activeContracts = await this.prisma.contract.findMany({
        where: { employeeId: emp.id, isActive: true },
      });
      const now = new Date();
      const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      for (const contract of activeContracts) {
        if (contract.endDate && contract.endDate >= now && contract.endDate <= thirtyDaysAhead) {
          recommendations.push({
            type: 'CONTRACT_RENEWAL',
            title: 'Renouvellement de contrat nécessaire',
            description: `Le contrat de type ${contract.type} arrive à échéance le ${contract.endDate.toLocaleDateString('fr-FR')}.`,
            employeeName: name,
            employeeId: emp.id,
          });
        }
      }

      // 2. Promotion candidate (Score > 92 and hireDate > 1 year)
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      if (emp.performanceScore >= 92 && emp.hireDate && emp.hireDate < oneYearAgo && emp.lifecycleStage !== 'PROMOTION') {
        recommendations.push({
          type: 'PROMOTION_CANDIDATE',
          title: 'Candidat potentiel pour promotion',
          description: `Score de performance de ${emp.performanceScore}% et plus d'un an d'ancienneté. Envisager une revalorisation.`,
          employeeName: name,
          employeeId: emp.id,
        });
      }

      // 3. Burnout / Overload risk (check active task count)
      const activeTasksCount = await this.prisma.task.count({
        where: { assigneeId: emp.userId, status: { in: ['TODO', 'IN_PROGRESS'] } },
      });
      if (activeTasksCount >= 8) {
        recommendations.push({
          type: 'BURNOUT_RISK',
          title: 'Risque de surcharge / Burnout',
          description: `L'employé est actuellement assigné à ${activeTasksCount} tâches en cours. Envisager un rééquilibrage de la charge.`,
          employeeName: name,
          employeeId: emp.id,
        });
      }

      // 4. Low leave balance (hasn't taken leave in 6 months)
      const recentApprovedLeave = emp.leaveRequests.filter(
        (lr) => lr.status === LeaveStatus.APPROVED && lr.endDate >= new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
      );
      if (recentApprovedLeave.length === 0 && emp.hireDate && emp.hireDate < new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())) {
        recommendations.push({
          type: 'LEAVE_NEEDED',
          title: 'Absence prolongée de congés',
          description: `L'employé n'a pris aucun congé approuvé au cours des 6 derniers mois. Risque de fatigue accumulée.`,
          employeeName: name,
          employeeId: emp.id,
        });
      }
    }

    // 5. Understaffed Department
    const depts = await this.prisma.department.findMany({
      include: { employees: true },
    });
    for (const d of depts) {
      const activeProjectCount = await this.prisma.project.count({
        where: { status: 'ACTIVE' },
      });
      // Simple heuristic: if company is active, departments with < 2 members are understaffed
      if (d.employees.length < 2 && activeProjectCount > 1) {
        recommendations.push({
          type: 'DEPARTMENT_UNDERSTAFFED',
          title: 'Département sous-effectif',
          description: `Le département "${d.name}" ne compte que ${d.employees.length} employé(s) actif(s) pour la charge agence.`,
          employeeName: `Département ${d.name}`,
          employeeId: d.id,
        });
      }
    }

    return recommendations;
  }

  async findLeaveRequestById(id: string) {
    return this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: { include: { user: true } } },
    });
  }

  // ─── Recruitment - Job Vacancies ──────────────────────────────────────────────

  async createVacancy(dto: CreateVacancyDto) {
    return this.prisma.jobVacancy.create({
      data: {
        title: dto.title,
        departmentId: dto.departmentId,
        description: dto.description,
        requirements: dto.requirements,
        salaryRange: dto.salaryRange,
        status: dto.status || 'OPEN',
      },
      include: { department: true },
    });
  }

  async findAllVacancies(query: QueryVacanciesDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      departmentId,
      status,
      isArchived = false,
    } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const where: Prisma.JobVacancyWhereInput = {
      isArchived,
      ...(departmentId && { departmentId }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { requirements: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const validSortFields: Record<string, keyof Prisma.JobVacancyOrderByWithRelationInput> = {
      createdAt: 'createdAt',
      title: 'title',
    };
    const orderBy: Prisma.JobVacancyOrderByWithRelationInput = {
      [validSortFields[sortBy] ?? 'createdAt']: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.jobVacancy.findMany({
        where,
        skip,
        take,
        include: {
          department: true,
          _count: { select: { candidates: true } },
        },
        orderBy,
      }),
      this.prisma.jobVacancy.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findVacancyById(id: string) {
    const vacancy = await this.prisma.jobVacancy.findUnique({
      where: { id },
      include: {
        department: true,
        candidates: true,
      },
    });
    if (!vacancy) {
      throw new NotFoundException(`Vacancy with ID "${id}" not found`);
    }
    return vacancy;
  }

  async updateVacancy(id: string, dto: Partial<CreateVacancyDto>) {
    await this.findVacancyById(id);
    return this.prisma.jobVacancy.update({
      where: { id },
      data: dto,
      include: { department: true },
    });
  }

  async deleteVacancy(id: string) {
    await this.findVacancyById(id);
    return this.prisma.jobVacancy.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
  }

  async restoreVacancy(id: string) {
    const vacancy = await this.prisma.jobVacancy.findUnique({ where: { id } });
    if (!vacancy) {
      throw new NotFoundException(`Vacancy with ID "${id}" not found`);
    }
    return this.prisma.jobVacancy.update({
      where: { id },
      data: { isArchived: false, deletedAt: null },
    });
  }

  // ─── Recruitment - Candidates ──────────────────────────────────────────────────

  async createCandidate(dto: CreateCandidateDto) {
    return this.prisma.candidate.create({
      data: {
        vacancyId: dto.vacancyId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        resumeUrl: dto.resumeUrl,
        status: dto.status || 'APPLIED',
        notes: dto.notes,
      },
      include: { vacancy: { include: { department: true } } },
    });
  }

  async findAllCandidates(query: QueryCandidatesDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      vacancyId,
      status,
      isArchived = false,
    } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const where: Prisma.CandidateWhereInput = {
      isArchived,
      ...(vacancyId && { vacancyId }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const validSortFields: Record<string, keyof Prisma.CandidateOrderByWithRelationInput> = {
      createdAt: 'createdAt',
      lastName: 'lastName',
      firstName: 'firstName',
    };
    const orderBy: Prisma.CandidateOrderByWithRelationInput = {
      [validSortFields[sortBy] ?? 'createdAt']: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.candidate.findMany({
        where,
        skip,
        take,
        include: {
          vacancy: { include: { department: true } },
        },
        orderBy,
      }),
      this.prisma.candidate.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findCandidateById(id: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: { vacancy: true },
    });
    if (!candidate) {
      throw new NotFoundException(`Candidate with ID "${id}" not found`);
    }
    return candidate;
  }

  async updateCandidate(id: string, dto: Partial<CreateCandidateDto>) {
    await this.findCandidateById(id);
    return this.prisma.candidate.update({
      where: { id },
      data: dto,
      include: { vacancy: true },
    });
  }

  async deleteCandidate(id: string) {
    await this.findCandidateById(id);
    return this.prisma.candidate.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
  }

  async restoreCandidate(id: string) {
    const candidate = await this.prisma.candidate.findUnique({ where: { id } });
    if (!candidate) {
      throw new NotFoundException(`Candidate with ID "${id}" not found`);
    }
    return this.prisma.candidate.update({
      where: { id },
      data: { isArchived: false, deletedAt: null },
    });
  }
}

