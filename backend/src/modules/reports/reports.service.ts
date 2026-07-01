import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateReportScheduleDto } from './dto/create-report-schedule.dto';
import { GenerateHrReportDto } from './dto/generate-hr-report.dto';
import { GenerateFinanceReportDto } from './dto/generate-finance-report.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import {
  ReportType,
  Prisma,
} from '@prisma/client';
import { ReportInsightService } from './report-insight.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import PDFDocument = require('pdfkit');

// ─── Workflow status constants ──────────────────────────────────────────────
export const WORKFLOW_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportInsightService: ReportInsightService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private async getUserDepartmentId(userId: string): Promise<string | null> {
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
      select: { departmentId: true },
    });
    return profile?.departmentId || null;
  }

  private getAllowedReportTypes(role: string): ReportType[] {
    if (role === 'GERANT') {
      return [ReportType.FINANCIAL, ReportType.HR, ReportType.PROJECT, ReportType.CRM, ReportType.MARKETING, ReportType.SALES, ReportType.PRODUCTIVITY];
    } else if (role === 'RESPONSABLE_RH') {
      return [ReportType.HR, ReportType.PRODUCTIVITY];
    } else if (role === 'RESPONSABLE_FINANCIER') {
      return [ReportType.FINANCIAL];
    } else if (role === 'RESPONSABLE_MARKETING') {
      return [ReportType.MARKETING];
    } else if (role === 'RESPONSABLE_VENTES') {
      return [ReportType.SALES];
    } else if (role === 'CHEF_PROJET') {
      return [ReportType.PROJECT, ReportType.PRODUCTIVITY];
    } else if (role === 'SECRETAIRE') {
      return [ReportType.CRM, ReportType.PROJECT];
    }
    return [];
  }

  private parseDateRange(filters: Record<string, any>): { dateFrom?: Date; dateTo?: Date } {
    if (filters.dateFrom && filters.dateTo) {
      return { dateFrom: new Date(filters.dateFrom), dateTo: new Date(filters.dateTo) };
    }

    const now = new Date();
    const period = filters.period || 'THIS_MONTH';

    switch (period) {
      case 'TODAY': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        return { dateFrom: start, dateTo: end };
      }
      case 'THIS_WEEK': {
        const dayOfWeek = now.getDay() || 7;
        const start = new Date(now);
        start.setDate(now.getDate() - dayOfWeek + 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { dateFrom: start, dateTo: end };
      }
      case 'THIS_MONTH': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        return { dateFrom: start, dateTo: end };
      }
      case 'THIS_QUARTER': {
        const quarter = Math.floor(now.getMonth() / 3);
        const start = new Date(now.getFullYear(), quarter * 3, 1);
        const end = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59);
        return { dateFrom: start, dateTo: end };
      }
      case 'THIS_YEAR': {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        return { dateFrom: start, dateTo: end };
      }
      default:
        return {};
    }
  }

  private getReportIncludes() {
    return {
      createdBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      department: { select: { id: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
      schedules: true,
      reportComments: {
        include: { author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' as const },
      },
      reportApprovals: {
        include: { reviewer: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' as const },
      },
    };
  }

  private async logHistory(reportId: string, userId: string, action: string, details: any = {}) {
    await this.prisma.reportHistory.create({
      data: { reportId, performedById: userId, action, details },
    });
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  async findAll(user: any, filters: { type?: ReportType; createdById?: string; isArchived?: boolean; workflowStatus?: string; departmentId?: string } = {}) {
    const isArchived = filters.isArchived ?? false;
    const role = user?.role?.name;

    if (role === 'COLLABORATEUR') {
      throw new ForbiddenException('Access denied: Employees cannot view reports.');
    }

    const allowedTypes = this.getAllowedReportTypes(role);
    const requestedType = filters.type;

    if (requestedType && !allowedTypes.includes(requestedType)) {
      throw new ForbiddenException(`Access denied: You do not have permission to view ${requestedType} reports.`);
    }

    const where: Prisma.ReportWhereInput = {
      isArchived,
      type: requestedType ? requestedType : { in: allowedTypes },
      ...(filters.createdById && { createdById: filters.createdById }),
      ...(filters.workflowStatus ? { workflowStatus: filters.workflowStatus } : (role === 'GERANT' && { workflowStatus: { not: 'DRAFT' } })),
      ...(filters.departmentId && { departmentId: filters.departmentId }),
    };

    // Department security for managers — only see own department's reports
    if (role !== 'GERANT' && role !== 'SECRETAIRE') {
      const deptId = await this.getUserDepartmentId(user.id);
      if (deptId) {
        where.departmentId = deptId;
      } else {
        where.createdById = user.id;
      }
    }

    return this.prisma.report.findMany({
      where,
      include: this.getReportIncludes(),
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, user?: any) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: this.getReportIncludes(),
    });

    if (!report) {
      throw new NotFoundException(`Report with ID "${id}" not found`);
    }

    if (user) {
      const role = user.role?.name;
      if (role === 'COLLABORATEUR' || role === 'STAGIAIRE') {
        throw new ForbiddenException('Access denied: Employees/Interns cannot view reports.');
      }

      const allowedTypes = this.getAllowedReportTypes(role);
      if (!allowedTypes.includes(report.type)) {
        throw new ForbiddenException(`Access denied: You do not have permission to access ${report.type} reports.`);
      }

      if (role !== 'GERANT' && role !== 'SECRETAIRE') {
        const deptId = await this.getUserDepartmentId(user.id);
        if (deptId && report.departmentId && report.departmentId !== deptId) {
          throw new ForbiddenException('Access denied: You can only view reports for your own department.');
        }
      }
    }

    let dynamicData = null;
    if (report.workflowStatus !== 'DRAFT' && report.data) {
      dynamicData = report.data;
    } else if (report.periodStart && report.periodEnd) {
      try {
        if (report.type === 'HR') {
          dynamicData = await this.calculateHrData(report.periodStart, report.periodEnd, report.departmentId || undefined);
        } else if (report.type === 'FINANCIAL') {
          dynamicData = await this.calculateFinanceData(report.periodStart, report.periodEnd);
        }
      } catch (err) {
        console.error(`Failed to calculate dynamic data for report ${id}:`, err);
      }
    }

    return { ...report, data: dynamicData };
  }

  async getReportData(id: string, user: any) {
    const report = await this.findOne(id, user);
    let rawData = null;

    if (report.workflowStatus !== 'DRAFT' && report.data) {
      rawData = report.data;
    } else if (report.periodStart && report.periodEnd) {
      if (report.type === 'HR') {
        rawData = await this.calculateHrData(report.periodStart, report.periodEnd, report.departmentId || undefined);
      } else if (report.type === 'FINANCIAL') {
        rawData = await this.calculateFinanceData(report.periodStart, report.periodEnd);
      }
    }

    if (!rawData) return { data: null };

    const summary = rawData.summary || rawData || {};
    const charts = rawData.charts || {};

    const flatData = {
      ...summary,
      ...charts,
      // HR form mapping
      averageAttendance: summary.attendanceRate ?? 0,
      pendingLeaves: summary.pendingLeaveRequests ?? 0,
      resignedEmployees: summary.employeesLeft ?? 0,
      completedTasks: summary.tasksCompleted ?? 0,
      totalTasks: summary.totalTasks ?? 0,

      // Finance form mapping
      margin: summary.profitMargin ?? 0,
      outstandingCash: summary.outstandingPayments ?? 0,
      paidInvoicesCount: summary.paidInvoices ?? 0,
      unpaidInvoicesCount: summary.outstandingInvoicesCount ?? 0,
      profit: summary.profit ?? 0,
    };

    return { data: flatData };
  }

  async create(dto: CreateReportDto, user: any) {
    const role = user?.role?.name;
    if (role === 'COLLABORATEUR' || role === 'STAGIAIRE') {
      throw new ForbiddenException('Access denied: Employees/Interns cannot create reports.');
    }

    const allowedTypes = this.getAllowedReportTypes(role);
    if (!allowedTypes.includes(dto.type)) {
      throw new ForbiddenException(`Access denied: You cannot create reports of type ${dto.type}.`);
    }

    const deptId = role === 'GERANT' ? dto.departmentId : await this.getUserDepartmentId(user.id);

    // Sequential report code
    let reportCode = '[RPT-001]';
    const latestReport = await this.prisma.report.findFirst({
      where: { name: { startsWith: '[RPT-' } },
      orderBy: { name: 'desc' },
      select: { name: true },
    });

    if (latestReport?.name) {
      const match = latestReport.name.match(/^\[RPT-(\d+)\]/);
      if (match) {
        const lastSeq = parseInt(match[1], 10);
        if (!isNaN(lastSeq)) {
          reportCode = `[RPT-${String(lastSeq + 1).padStart(3, '0')}]`;
        }
      }
    }

    const reportName = dto.name.startsWith('[RPT-') ? dto.name : `${reportCode} ${dto.name}`;

     const payload = {
      name: reportName,
      type: dto.type,
      subType: dto.subType,
      filters: dto.filters ?? {},
      isShared: dto.isShared ?? false,
      createdById: user.id,
      departmentId: deptId || undefined,
      managerId: role !== 'GERANT' ? user.id : undefined,
      reportingPeriod: dto.reportingPeriod || 'Current Month',
      status: dto.status || 'PENDING_REVIEW',
      title: dto.title,
      periodStart: dto.periodStart ? new Date(dto.periodStart) : undefined,
      periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : undefined,
      notes: dto.notes ?? Prisma.JsonNull,
      workflowStatus: dto.workflowStatus || 'DRAFT',
    };

    console.log('[ReportsService] Creating report in Prisma with payload:', payload);

    try {
      const report = await this.prisma.report.create({
        data: payload,
      });

      await this.logHistory(report.id, user.id, 'CREATED');
      return report;
    } catch (error) {
      console.error('[ReportsService] Prisma Creation Error:', error);
      throw new BadRequestException('Failed to create report in database');
    }
  }

  async update(id: string, dto: Partial<CreateReportDto> & { notes?: any; title?: string; periodStart?: string; periodEnd?: string; reportingPeriod?: string }, user: any) {
    const report = await this.findOne(id, user);
    const role = user?.role?.name;

    console.log({
      reportId: id,
      reportStatus: report.status,
      reportOwner: report.managerId,
      currentUser: user.id,
      role: role,
    });

    // CEO cannot edit reports
    if (role === 'GERANT') {
      throw new ForbiddenException({ reason: "INSUFFICIENT_ROLE" });
    }

    // Only DRAFT reports can be edited
    if (report.status !== 'DRAFT' && report.workflowStatus !== 'DRAFT') {
      throw new ForbiddenException({ reason: "STATUS_NOT_DRAFT" });
    }

    // Manager must own the report
    if (report.managerId !== user.id) {
      throw new ForbiddenException({ reason: "NOT_REPORT_OWNER" });
    }

    const payload = {
      name: dto.name,
      title: dto.title,
      isShared: dto.isShared,
      filters: dto.filters,
      subType: dto.subType,
      reportingPeriod: dto.reportingPeriod,
      status: dto.status,
      periodStart: dto.periodStart ? new Date(dto.periodStart) : undefined,
      periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : undefined,
      notes: dto.notes !== undefined ? dto.notes : undefined,
      workflowStatus: dto.workflowStatus,
    };

    console.log(`[ReportsService] Updating report ${id} in Prisma with payload:`, payload);

    try {
      const updated = await this.prisma.report.update({
        where: { id },
        data: payload,
      });

      console.log("Database update successful");
      await this.logHistory(id, user.id, 'UPDATED');
      return updated;
    } catch (error) {
      console.error('[ReportsService] Prisma Update Error:', error);
      throw new BadRequestException('Failed to update report in database');
    }


  }

  async delete(id: string, user: any) {
    await this.findOne(id, user);
    return this.prisma.report.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
  }

  async restore(id: string, user: any) {
    await this.findOne(id, user);
    return this.prisma.report.update({
      where: { id },
      data: { isArchived: false, deletedAt: null },
    });
  }

  // ─── Workflow: Submit ──────────────────────────────────────────────────────────

  async submitReport(id: string, user: any) {
    const report = await this.findOne(id, user);
    const role = user?.role?.name;

    if (role === 'GERANT') {
      throw new ForbiddenException('CEOs cannot submit reports.');
    }

    if (report.workflowStatus !== WORKFLOW_STATUS.DRAFT) {
      throw new ConflictException(`Report is in "${report.workflowStatus}" status and cannot be submitted.`);
    }

    console.log("Current status:", report.workflowStatus);

    // Calculate latest data to snapshot
    let snapshotData: any = null;
    let snapshotCharts: any = null;
    if (report.periodStart && report.periodEnd) {
      try {
        if (report.type === 'HR') {
          const raw = await this.calculateHrData(report.periodStart, report.periodEnd, report.departmentId || undefined);
          snapshotData = raw;
          snapshotCharts = raw.charts;
        } else if (report.type === 'FINANCIAL') {
          const raw = await this.calculateFinanceData(report.periodStart, report.periodEnd);
          snapshotData = raw;
          snapshotCharts = raw.charts;
        }
      } catch (err) {
        console.error('Failed to snapshot data during submission:', err);
      }
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        workflowStatus: 'SUBMITTED',
        status: 'SUBMITTED',
        submittedAt: new Date(),
        data: snapshotData ?? Prisma.JsonNull,
        charts: snapshotCharts ?? Prisma.JsonNull,
      },
    });

    await this.logHistory(id, user.id, 'SUBMITTED', {});

    // Notify all CEOs
    const ceos = await this.prisma.user.findMany({
      where: { role: { name: 'GERANT' }, isActive: true },
      select: { id: true },
    });

    const reportTypeName = report.type === 'HR' ? 'RH' : 'Finance';
    const managerName = `${user.firstName} ${user.lastName}`;

    for (const ceo of ceos) {
      const notif = await this.prisma.notification.create({
        data: {
          userId: ceo.id,
          type: 'REPORT_SUBMITTED' as any,
          title: `Nouveau rapport soumis : ${report.name}`,
          body: `Le manager ${managerName} a soumis le rapport ${reportTypeName} "${report.name}" pour révision.`,
          resourceId: id,
        },
      });
      this.notificationsGateway.sendToUser(ceo.id, 'notification', notif);
    }

    return this.findOne(id);
  }

  // ─── Workflow: Approve ─────────────────────────────────────────────────────────

  async approveReport(id: string, approverId: string, comment?: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(`Report not found.`);

    if (report.workflowStatus !== WORKFLOW_STATUS.SUBMITTED && report.workflowStatus !== 'UNDER_REVIEW') {
      throw new ConflictException(`Report must be in SUBMITTED or UNDER_REVIEW status to approve.`);
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        workflowStatus: WORKFLOW_STATUS.APPROVED,
        status: 'APPROVED',
        comment: comment || 'Approuvé par la direction',
        approvedAt: new Date(),
        approvedById: approverId,
      },
    });

    // Create approval record
    await this.prisma.reportApproval.create({
      data: { reportId: id, reviewerId: approverId, action: 'APPROVED', comment },
    });

    await this.logHistory(id, approverId, 'APPROVED', { comment });

    // Notify manager
    if (report.createdById) {
      const notif1 = await this.prisma.notification.create({
        data: {
          userId: report.createdById,
          type: 'REPORT_APPROVED' as any,
          title: `Rapport approuvé : ${report.name}`,
          body: `Votre rapport "${report.name}" a été approuvé par la direction. ${comment ? `Commentaire : ${comment}` : ''}`,
          resourceId: id,
        },
      });
      this.notificationsGateway.sendToUser(report.createdById, 'notification', notif1);
    }
    if (report.managerId && report.managerId !== report.createdById) {
      const notif2 = await this.prisma.notification.create({
        data: {
          userId: report.managerId,
          type: 'REPORT_APPROVED' as any,
          title: `Rapport approuvé : ${report.name}`,
          body: `Le rapport "${report.name}" a été approuvé.`,
          resourceId: id,
        },
      });
      this.notificationsGateway.sendToUser(report.managerId, 'notification', notif2);
    }

    return updated;
  }

  // ─── Workflow: Reject ──────────────────────────────────────────────────────────

  async rejectReport(id: string, reviewerId: string, reason: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(`Report not found.`);

    if (report.workflowStatus !== WORKFLOW_STATUS.SUBMITTED && report.workflowStatus !== 'UNDER_REVIEW') {
      throw new ConflictException(`Report must be in SUBMITTED or UNDER_REVIEW status to reject.`);
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        workflowStatus: WORKFLOW_STATUS.REJECTED,
        status: 'REJECTED',
        comment: reason,
        rejectedAt: new Date(),
        rejectedById: reviewerId,
      },
    });

    // Create approval record
    await this.prisma.reportApproval.create({
      data: { reportId: id, reviewerId, action: 'REJECTED', comment: reason },
    });

    await this.logHistory(id, reviewerId, 'REJECTED', { reason });

    // Notify manager
    if (report.createdById) {
      const notif1 = await this.prisma.notification.create({
        data: {
          userId: report.createdById,
          type: 'REPORT_REJECTED' as any,
          title: `Rapport rejeté : ${report.name}`,
          body: `Votre rapport "${report.name}" a été rejeté. Raison : ${reason}`,
          resourceId: id,
        },
      });
      this.notificationsGateway.sendToUser(report.createdById, 'notification', notif1);
    }

    return updated;
  }

  // ─── Workflow: Return to Draft ───────────────────────────────────────────────

  async returnToDraft(id: string, user: any) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(`Report not found.`);

    if (report.workflowStatus !== WORKFLOW_STATUS.REJECTED) {
      throw new ConflictException(`Only REJECTED reports can be returned to draft.`);
    }

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        workflowStatus: WORKFLOW_STATUS.DRAFT,
        status: 'DRAFT',
      },
    });

    await this.logHistory(id, user.id, 'RETURNED_TO_DRAFT', {});
    return updated;
  }

  // ─── Workflow: Request Modifications ──────────────────────────────────────────

  async requestModifications(id: string, reviewerId: string, comment: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(`Report not found.`);

    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        workflowStatus: WORKFLOW_STATUS.DRAFT,
        status: 'PENDING_REVIEW',
        comment,
      },
    });

    await this.prisma.reportApproval.create({
      data: { reportId: id, reviewerId, action: 'MODIFICATION_REQUESTED', comment },
    });

    await this.logHistory(id, reviewerId, 'MODIFICATION_REQUESTED', { comment });

    if (report.createdById) {
      const notif1 = await this.prisma.notification.create({
        data: {
          userId: report.createdById,
          type: 'REPORT_MODIFICATION_REQUESTED' as any,
          title: `Modifications demandées : ${report.name}`,
          body: `Des modifications ont été demandées pour votre rapport "${report.name}". Commentaire : ${comment}`,
          resourceId: id,
        },
      });
      this.notificationsGateway.sendToUser(report.createdById, 'notification', notif1);
    }

    return updated;
  }

  // ─── Comments ─────────────────────────────────────────────────────────────────

  async addComment(id: string, user: any, dto: AddCommentDto) {
    await this.findOne(id, user);

    const comment = await this.prisma.reportComment.create({
      data: { reportId: id, authorId: user.id, content: dto.content },
      include: { author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });

    await this.logHistory(id, user.id, 'COMMENTED', { content: dto.content });
    return comment;
  }

  async getComments(id: string, user: any) {
    await this.findOne(id, user);
    return this.prisma.reportComment.findMany({
      where: { reportId: id },
      include: { author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─── History ──────────────────────────────────────────────────────────────────

  async getHistory(id: string, user: any) {
    await this.findOne(id, user);
    return this.prisma.reportHistory.findMany({
      where: { reportId: id },
      include: { performedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Generate HR Report Data ───────────────────────────────────────────────────

  async calculateHrData(periodStart: Date, periodEnd: Date, departmentId?: string) {
    const dateFilter = { gte: periodStart, lte: periodEnd };

    const [
      allEmployees,
      newEmployees,
      leaveRequests,
      contracts,
      attendances,
      vacancies,
      candidates,
      salaries,
      employeeHistories,
    ] = await Promise.all([
      this.prisma.employeeProfile.findMany({
        where: departmentId ? { departmentId } : {},
        include: {
          user: { select: { firstName: true, lastName: true, email: true, isActive: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      this.prisma.employeeProfile.findMany({
        where: {
          ...(departmentId && { departmentId }),
          createdAt: dateFilter,
        },
        select: { id: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          ...(departmentId && { employee: { departmentId } }),
          startDate: dateFilter,
        },
        include: {
          employee: {
            include: {
              user: { select: { firstName: true, lastName: true } },
              department: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.contract.findMany({
        where: { isActive: true },
        select: { id: true, type: true, grossSalary: true, currency: true },
      }),
      this.prisma.attendance.findMany({
        where: {
          ...(departmentId && { employee: { departmentId: departmentId } }),
          date: dateFilter,
        },
        select: { id: true, status: true, hoursWorked: true, overtime: true, date: true },
      }),
      this.prisma.jobVacancy.findMany({
        where: { isArchived: false },
        select: { id: true, title: true, status: true, _count: { select: { candidates: true } } },
      }),
      this.prisma.candidate.findMany({
        where: { isArchived: false },
        select: { id: true, status: true, vacancyId: true },
      }),
      this.prisma.salary.findMany({
        where: { effectiveTo: null },
        select: { amount: true, currency: true },
      }),
      this.prisma.employeeHistory.findMany({
        where: { eventDate: dateFilter },
        select: { id: true, eventType: true, title: true },
      }),
    ]);

    const activeEmployees = allEmployees.filter(e => e.status === 'ACTIVE').length;
    const onLeaveEmployees = allEmployees.filter(e => e.status === 'ON_LEAVE').length;

    // Attendance calculations
    const totalAttendanceDays = attendances.length;
    const presentCount = attendances.filter(a => ['PRESENT', 'REMOTE'].includes(a.status)).length;
    const lateCount = attendances.filter(a => a.status === 'LATE').length;
    const absentCount = attendances.filter(a => a.status === 'ABSENT').length;
    const remoteCount = attendances.filter(a => a.status === 'REMOTE').length;
    const attendanceRate = totalAttendanceDays > 0 ? Math.round((presentCount / totalAttendanceDays) * 100) : 100;
    const absenceRate = totalAttendanceDays > 0 ? Math.round((absentCount / totalAttendanceDays) * 100) : 0;
    const totalOvertimeHours = attendances.reduce((s, a) => s + Number(a.overtime || 0), 0);
    const avgHoursWorked = totalAttendanceDays > 0
      ? parseFloat((attendances.reduce((s, a) => s + Number(a.hoursWorked || 0), 0) / totalAttendanceDays).toFixed(1))
      : 0;

    // Leave stats
    const approvedLeaves = leaveRequests.filter(l => l.status === 'APPROVED').length;
    const pendingLeaves = leaveRequests.filter(l => l.status === 'PENDING').length;
    const rejectedLeaves = leaveRequests.filter(l => l.status === 'REJECTED').length;
    const sickLeave = leaveRequests.filter(l => l.type === 'SICK').length;
    const vacationLeave = leaveRequests.filter(l => l.type === 'ANNUAL').length;

    // Recruitment stats
    const openRecruitments = vacancies.filter(v => v.status === 'OPEN').length;
    const closedRecruitments = vacancies.filter(v => v.status !== 'OPEN').length;
    const interviewed = candidates.filter(c => c.status === 'INTERVIEWING').length;
    const hired = candidates.filter(c => c.status === 'HIRED').length;

    // Performance
    const promotions = employeeHistories.filter(h => h.eventType === 'PROMOTION').length;
    const warnings = employeeHistories.filter(h => h.eventType === 'WARNING').length;
    const perfScores = allEmployees.map(e => e.performanceScore);
    const avgPerformanceScore = perfScores.length > 0
      ? Math.round(perfScores.reduce((s, v) => s + v, 0) / perfScores.length)
      : 0;

    // Payroll
    const totalPayroll = salaries.reduce((sum, s) => sum + Number(s.amount), 0);

    // Department distribution
    const deptMap: Record<string, number> = {};
    allEmployees.forEach(e => {
      const dName = e.department?.name || 'Non assigné';
      deptMap[dName] = (deptMap[dName] || 0) + 1;
    });

    // Leave by type chart
    const leaveTypeMap: Record<string, number> = {};
    leaveRequests.forEach(l => { leaveTypeMap[l.type] = (leaveTypeMap[l.type] || 0) + 1; });

    // Contract distribution
    const contractTypeMap: Record<string, number> = {};
    contracts.forEach(c => { contractTypeMap[c.type] = (contractTypeMap[c.type] || 0) + 1; });

    const generatedData = {
      summary: {
        // Employees
        totalEmployees: allEmployees.length,
        activeEmployees,
        newEmployees: newEmployees.length,
        employeesLeft: 0,
        onLeaveEmployees,
        // Recruitment
        openRecruitments,
        closedRecruitments,
        candidatesInterviewed: interviewed,
        candidatesHired: hired,
        // Attendance
        attendanceRate,
        absenceRate,
        lateArrivals: lateCount,
        overtimeHours: totalOvertimeHours,
        remoteWorkDays: remoteCount,
        avgHoursWorked,
        // Leaves
        approvedLeaveRequests: approvedLeaves,
        pendingLeaveRequests: pendingLeaves,
        rejectedLeaveRequests: rejectedLeaves,
        sickLeave,
        vacationLeave,
        totalLeaveRequests: leaveRequests.length,
        // Performance
        performanceEvaluationsCompleted: allEmployees.length,
        avgPerformanceScore,
        promotions,
        warnings,
        performanceEvaluations: 0,
        averagePerformanceScore: 0,
        // Payroll
        totalPayroll,
        averageSalary: salaries.length > 0 ? totalPayroll / salaries.length : 0,
        // Training (placeholder — extend if training model added)
        trainingSessions: 0,
        certifications: 0,
        // Other
        totalActiveContracts: contracts.length,
        openVacancies: openRecruitments,
        totalCandidates: candidates.length,
      },
      charts: {
        departmentDistribution: Object.entries(deptMap).map(([name, count]) => ({ name, count })),
        leaveByStatus: [
          { status: 'PENDING', count: pendingLeaves },
          { status: 'APPROVED', count: approvedLeaves },
          { status: 'REJECTED', count: rejectedLeaves },
        ].filter(s => s.count > 0),
        leaveByType: Object.entries(leaveTypeMap).map(([type, count]) => ({ type, count })),
        contractByType: Object.entries(contractTypeMap).map(([type, count]) => ({ type, count })),
        candidatesByStatus: [
          { status: 'APPLIED', count: candidates.filter(c => c.status === 'APPLIED').length },
          { status: 'INTERVIEWING', count: interviewed },
          { status: 'OFFERED', count: candidates.filter(c => c.status === 'OFFERED').length },
          { status: 'HIRED', count: hired },
          { status: 'REJECTED', count: candidates.filter(c => c.status === 'REJECTED').length },
        ].filter(s => s.count > 0),
        attendanceSummary: [
          { status: 'Présent', count: presentCount },
          { status: 'En retard', count: lateCount },
          { status: 'Absent', count: absentCount },
          { status: 'Télétravail', count: remoteCount },
        ],
      },
    };

    return generatedData;
  }

  async generateHrReportData(dto: GenerateHrReportDto, user: any) {
    try {
      const periodStart = dto.periodStart ? new Date(dto.periodStart) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

      const generatedData = await this.calculateHrData(periodStart, periodEnd, dto.departmentId);

      const reportDto = {
        name: `Auto HR Report ${periodStart.toISOString().split('T')[0]}`,
        type: 'HR' as ReportType,
        departmentId: dto.departmentId,
        reportingPeriod: `${periodStart.toISOString().split('T')[0]} → ${periodEnd.toISOString().split('T')[0]}`,
        status: 'PENDING_REVIEW',
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        workflowStatus: 'DRAFT',
      };

      console.log('[ReportsService] Successfully aggregated HR data, creating report via this.create()');
      const createdReport = await this.create(reportDto, user);
      
      return { ...createdReport, data: generatedData };

    } catch (error) {
      console.error('[ReportsService] Prisma Error in generateHrReportData:', error);
      throw new InternalServerErrorException(
        error instanceof Error ? `Database error during HR generation: ${error.message}` : 'Unknown database error during HR generation'
      );
    }
  }

  // ─── Generate Finance Report Data ──────────────────────────────────────────────

  async calculateFinanceData(periodStart: Date, periodEnd: Date) {
    const dateFilter = { gte: periodStart, lte: periodEnd };

    const [invoices, payments, expenses, quotes, salaries, projects, clients] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { issueDate: dateFilter, isArchived: false },
        select: {
          id: true, reference: true, status: true, total: true, paidAmount: true,
          dueDate: true, issueDate: true, currency: true,
          client: { select: { id: true, companyName: true } },
        },
      }),
      this.prisma.payment.findMany({
        where: { paidAt: dateFilter },
        select: { id: true, amount: true, method: true, paidAt: true, invoice: { select: { reference: true } } },
      }),
      this.prisma.expense.findMany({
        where: { expenseDate: dateFilter, isArchived: false },
        select: {
          id: true, description: true, amount: true, expenseDate: true,
          isApproved: true, currency: true,
          category: { select: { id: true, name: true } },
        },
      }),
      this.prisma.quote.findMany({
        where: { issueDate: dateFilter, isArchived: false },
        select: { id: true, reference: true, status: true, total: true },
      }),
      this.prisma.salary.findMany({
        where: { effectiveTo: null },
        select: { amount: true },
      }),
      this.prisma.project.findMany({
        where: { createdAt: dateFilter },
        select: { id: true, budget: true, status: true },
      }),
      this.prisma.client.findMany({
        where: { isActive: true },
        select: { id: true },
      }),
    ]);

    const approvedExpenses = expenses.filter(e => e.isApproved);
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalExpenses = approvedExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const payrollCost = salaries.reduce((sum, s) => sum + Number(s.amount), 0);
    const profit = totalRevenue - totalExpenses;
    const netIncome = totalRevenue - totalExpenses - payrollCost;
    const cashFlow = totalRevenue - totalExpenses;
    const invoicePaymentRate = invoices.length > 0
      ? Math.round((invoices.filter(i => i.status === 'PAID').length / invoices.length) * 100)
      : 0;

    // Invoice breakdown
    const paidInvoices = invoices.filter(i => i.status === 'PAID').length;
    const pendingInvoices = invoices.filter(i => ['SENT', 'PARTIALLY_PAID', 'PENDING_APPROVAL', 'APPROVED'].includes(i.status)).length;
    const overdueInvoices = invoices.filter(i => i.status === 'OVERDUE').length;

    // Quote stats
    const totalQuotes = quotes.length;
    const acceptedQuotes = quotes.filter(q => ['ACCEPTED', 'APPROVED'].includes(q.status)).length;
    const rejectedQuotes = quotes.filter(q => q.status === 'REJECTED').length;
    const pendingQuotes = quotes.filter(q => ['DRAFT', 'SENT', 'PENDING_APPROVAL'].includes(q.status)).length;

    // Expense by category
    const categoryMap: Record<string, { name: string; amount: number; count: number }> = {};
    approvedExpenses.forEach(e => {
      const catName = e.category?.name || 'Autre';
      if (!categoryMap[catName]) categoryMap[catName] = { name: catName, amount: 0, count: 0 };
      categoryMap[catName].amount += Number(e.amount);
      categoryMap[catName].count += 1;
    });
    const expenseByCategory = Object.values(categoryMap).sort((a, b) => b.amount - a.amount);

    // Monthly revenue trend (last 6 months)
    const now = new Date();
    const monthlyTrend: { month: string; revenue: number; expenses: number; profit: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const label = start.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      const mRev = payments.filter(p => new Date(p.paidAt) >= start && new Date(p.paidAt) <= end)
        .reduce((s, p) => s + Number(p.amount), 0);
      const mExp = approvedExpenses.filter(e => new Date(e.expenseDate) >= start && new Date(e.expenseDate) <= end)
        .reduce((s, e) => s + Number(e.amount), 0);
      monthlyTrend.push({ month: label, revenue: mRev, expenses: mExp, profit: mRev - mExp });
    }

    // Projects stats
    const totalProjects = projects.length;
    const projectBudget = projects.reduce((sum, p) => sum + Number(p.budget || 0), 0);
    const projectCost = 0; // Requires aggregating expenses per project
    const projectProfit = projectBudget - projectCost;
    const activeClients = clients.length;
    const outstandingBalances = invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED').reduce((sum, i) => sum + (Number(i.total) - Number(i.paidAmount || 0)), 0);

    // Revenue by client (top 5)
    const clientRevMap: Record<string, { name: string; revenue: number }> = {};
    invoices.forEach(inv => {
      const cn = inv.client?.companyName || 'Inconnu';
      if (!clientRevMap[cn]) clientRevMap[cn] = { name: cn, revenue: 0 };
      clientRevMap[cn].revenue += Number(inv.paidAmount);
    });
    const revenueByClient = Object.values(clientRevMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Outstanding
    const outstandingPayments = invoices
      .filter(i => ['SENT', 'OVERDUE', 'PARTIALLY_PAID'].includes(i.status))
      .reduce((sum, i) => sum + (Number(i.total) - Number(i.paidAmount)), 0);
    const paymentsReceived = totalRevenue;

    // Invoice status distribution
    const invoiceStatusDist = [
      { status: 'PAID', count: paidInvoices },
      { status: 'PENDING', count: pendingInvoices },
      { status: 'OVERDUE', count: overdueInvoices },
    ].filter(s => s.count > 0);

    const generatedData = {
      summary: {
        // Invoices
        totalInvoices: invoices.length,
        paidInvoices,
        pendingInvoices,
        overdueInvoices,
        // Quotes
        totalQuotes,
        acceptedQuotes,
        rejectedQuotes,
        pendingQuotes,
        totalProjects,
        projectBudget,
        projectCost,
        projectProfit,
        activeClients,
        outstandingBalances,
        // Expenses
        totalExpenses,
        expenseCount: approvedExpenses.length,
        // Revenue
        monthlyRevenue: totalRevenue,
        annualRevenue: totalRevenue,
        // Payments
        paymentsReceived,
        outstandingPayments,
        // KPIs
        profit,
        expenses: totalExpenses,
        netIncome,
        cashFlow,
        invoicePaymentRate,
        payrollCost,
        quoteConversionRate: totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0,
        totalRevenue,
        invoiceCount: invoices.length,
        outstandingAmount: outstandingPayments,
        outstandingInvoicesCount: pendingInvoices + overdueInvoices,
        profitMargin: totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0,
        netProfit: netIncome,
        approvedQuotes: acceptedQuotes,
        expenseRatio: totalRevenue > 0 ? Math.round((totalExpenses / totalRevenue) * 100) : 0,
        averageInvoiceValue: invoices.length > 0 ? Math.round(totalRevenue / invoices.length) : 0,
        averageExpensePerProject: totalProjects > 0 ? Math.round(totalExpenses / totalProjects) : 0,
        revenueGrowth: monthlyTrend.length >= 2 ? Math.round(((monthlyTrend[5].revenue - monthlyTrend[4].revenue) / (monthlyTrend[4].revenue || 1)) * 100) : 0,
      },
      charts: {
        monthlyTrend,
        invoiceStatusDist,
        expenseByCategory,
        revenueByClient,
        topClients: revenueByClient,
      },
    };

    return generatedData;
  }

  async generateFinanceReportData(dto: GenerateFinanceReportDto, user: any) {
    try {
      const periodStart = dto.periodStart ? new Date(dto.periodStart) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

      const generatedData = await this.calculateFinanceData(periodStart, periodEnd);

      const reportDto = {
        name: `Auto Finance Report ${periodStart.toISOString().split('T')[0]}`,
        type: 'FINANCIAL' as ReportType,
        departmentId: undefined,
        reportingPeriod: `${periodStart.toISOString().split('T')[0]} → ${periodEnd.toISOString().split('T')[0]}`,
        status: 'PENDING_REVIEW',
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        workflowStatus: 'DRAFT',
      };

      console.log('[ReportsService] Successfully aggregated Finance data, creating report via this.create()');
      const createdReport = await this.create(reportDto, user);
      
      return { ...createdReport, data: generatedData };

    } catch (error) {
      console.error('[ReportsService] Prisma Error in generateFinanceReportData:', error);
      throw new InternalServerErrorException(
        error instanceof Error ? `Database error during Finance generation: ${error.message}` : 'Unknown database error during Finance generation'
      );
    }
  }

  async runReport(reportId: string, user: any) {
    try {
      console.log('Running report:', reportId);

      const report = await this.prisma.report.findUnique({
        where: { id: reportId },
        include: {
          ...this.getReportIncludes(),
          reportHistory: true,
        },
      });

      console.log('Report:', report?.id);

      if (!report) {
        throw new NotFoundException('Report Not Found');
      }

      console.log('Department:', report.department);
      console.log('Type:', report.type);

      // Verify relationships
      if (!report.createdBy) {
        console.warn('Warning: Report has no creator relation');
      }

      let data: any = null;
      const periodStart = report.periodStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const periodEnd = report.periodEnd || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

      if (report.type === 'FINANCIAL') {
        data = await this.calculateFinanceData(periodStart, periodEnd);
      } else if (report.type === 'HR') {
        data = await this.calculateHrData(periodStart, periodEnd, report.departmentId || undefined);
      } else {
        throw new Error(`Report type not supported for dynamic generation: ${report.type}`);
      }

      // Update status
      const updatedReport = await this.prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'PENDING_REVIEW',
          version: report.version + 1,
        },
        include: {
          ...this.getReportIncludes(),
          reportHistory: true,
        },
      });

      return {
        report: updatedReport,
        statistics: data?.summary || {},
        kpis: data?.summary || {}, // Returning summary as KPIs as well since they are mixed
        charts: data?.charts || {},
        managerNotes: updatedReport.notes || {},
        generatedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(error);
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException({
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }

  // ─── PDF Export ────────────────────────────────────────────────────────────────

  async exportPdf(id: string, user: any): Promise<Buffer> {
    const report = await this.findOne(id, user);
    const data = report.data as any;
    const notes = report.notes as any;
    const approvals = report.reportApprovals as any[];
    const comments = report.reportComments as any[];
    const summary = data?.summary || data || {};

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const primaryColor = '#2563EB'; // Deep blue
      const grayColor = '#64748B'; // Slate gray
      const darkColor = '#0F172A'; // Slate dark
      const lineColor = '#E2E8F0'; // Light gray
      const pageWidth = doc.page.width - 100;

      const checkPageBreak = (neededHeight: number) => {
        if (doc.y + neededHeight > doc.page.height - 70) {
          doc.addPage();
        }
      };

      // ── Title Section ──
      doc.fontSize(22).font('Helvetica-Bold').fillColor(darkColor)
        .text(report.name || report.title || 'Rapport d\'Activité', 50, 45, { width: pageWidth });
      doc.moveDown(0.2);
      
      const periodLabel = report.reportingPeriod || 
        `${report.periodStart ? new Date(report.periodStart).toLocaleDateString('fr-FR') : '-'} au ${report.periodEnd ? new Date(report.periodEnd).toLocaleDateString('fr-FR') : '-'}`;
      doc.fontSize(10).font('Helvetica').fillColor(grayColor)
        .text(`Période du rapport : ${periodLabel}`, 50, doc.y);
      doc.moveDown(0.8);

      // ── Metadata Block ──
      const metaY = doc.y;
      doc.rect(50, metaY, pageWidth, 75).fillColor('#F8FAFC').fill().strokeColor(lineColor).lineWidth(1).stroke();
      
      doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold')
        .text('INFORMATIONS DU RAPPORT', 65, metaY + 12);
      
      doc.fontSize(8).font('Helvetica').fillColor('#475569');
      doc.text(`Type : ${report.type} ${report.subType ? `· ${report.subType}` : ''}`, 65, metaY + 30);
      doc.text(`Auteur : ${report.createdBy?.firstName} ${report.createdBy?.lastName}`, 65, metaY + 45);
      doc.text(`Département : ${report.department?.name || (report.type === 'HR' ? 'Ressources Humaines' : 'Finance')}`, 65, metaY + 60);
      
      const statusLabel = report.workflowStatus || report.status || 'DRAFT';
      doc.text(`Statut : ${statusLabel}`, pageWidth / 2 + 65, metaY + 30);
      doc.text(`Généré le : ${new Date(report.createdAt).toLocaleDateString('fr-FR')}`, pageWidth / 2 + 65, metaY + 45);
      doc.text(`Version : v${report.version}`, pageWidth / 2 + 65, metaY + 60);
      
      doc.y = metaY + 90;

      // ── KPI / Statistics Section ──
      if (summary) {
        checkPageBreak(120);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor)
          .text('Indicateurs de Performance (KPIs)', 50, doc.y);
        doc.moveDown(0.4);

        const kpiEntries = Object.entries(summary)
          .filter(([k, v]) => (typeof v === 'number' || typeof v === 'string') && !['id', 'reportId'].includes(k))
          .slice(0, 18);

        const colWidth = pageWidth / 2;
        let col = 0;
        let rowY = doc.y;

        kpiEntries.forEach(([key, val]) => {
          checkPageBreak(48);
          // Recalculate rowY if checkPageBreak triggered a new page
          if (doc.y === 50) {
            rowY = 50;
            col = 0;
          }
          const x = 50 + col * colWidth;
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          
          let value = String(val);
          if (typeof val === 'number') {
            const isCurrency = ['totalRevenue', 'netProfit', 'totalExpenses', 'payrollCost', 'cashFlow', 'outstandingAmount', 'monthlyRevenue', 'annualRevenue', 'projectBudget', 'projectCost', 'projectProfit', 'averageInvoiceValue', 'averageExpensePerProject', 'outstandingBalances', 'paymentsReceived', 'outstandingPayments', 'profit'].includes(key);
            const isPercentage = ['profitMargin', 'invoicePaymentRate', 'quoteConversionRate', 'expenseRatio', 'revenueGrowth', 'margin'].includes(key);
            if (isCurrency) {
              value = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND', minimumFractionDigits: 0 }).format(val);
            } else if (isPercentage) {
              value = val + ' %';
            } else {
              value = val.toLocaleString('fr-FR');
            }
          }

          doc.rect(x + 2, rowY, colWidth - 8, 42).fillColor('#FFFFFF').fill().strokeColor(lineColor).lineWidth(1).stroke();
          doc.rect(x + 2, rowY, 3, 42).fillColor(primaryColor).fill();
          
          doc.fontSize(7).font('Helvetica-Bold').fillColor(grayColor).text(label.toUpperCase(), x + 10, rowY + 8, { width: colWidth - 20 });
          doc.fontSize(11).font('Helvetica-Bold').fillColor(darkColor).text(value, x + 10, rowY + 22, { width: colWidth - 20 });

          col++;
          if (col >= 2) {
            col = 0;
            rowY += 48;
            doc.y = rowY;
          }
        });

        doc.y = rowY + (col > 0 ? 48 : 0) + 15;
      }

      // ── Manager Notes Section ──
      if (notes && typeof notes === 'object') {
        checkPageBreak(80);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor)
          .text('Notes & Analyses du Manager', 50, doc.y);
        doc.moveDown(0.4);

        const noteFields: Record<string, string> = {
          achievements: 'Réalisations principales',
          problems: 'Problèmes et défis rencontrés',
          risks: 'Risques identifiés',
          recommendations: 'Recommandations direction',
          improvementPlan: 'Plan d\'amélioration',
          generalObservations: 'Observations générales',
          financialAnalysis: 'Analyse de performance financière',
          budgetIssues: 'Contrôle et alertes budgétaires',
          plannedActions: 'Actions futures planifiées',
        };

        Object.entries(noteFields).forEach(([key, label]) => {
          const content = notes[key];
          if (content && String(content).trim()) {
            const textContent = String(content).trim();
            const textHeight = doc.heightOfString(textContent, { width: pageWidth - 30 });
            const boxHeight = textHeight + 25;
            checkPageBreak(boxHeight + 20);

            // Draw callout
            doc.rect(50, doc.y, pageWidth, boxHeight).fillColor('#F8FAFC').fill();
            doc.rect(50, doc.y, 4, boxHeight).fillColor('#475569').fill();
            
            doc.fontSize(9).font('Helvetica-Bold').fillColor(darkColor).text(label.toUpperCase(), 65, doc.y + 8);
            doc.fontSize(9).font('Helvetica').fillColor('#334155').text(textContent, 65, doc.y + 22, { width: pageWidth - 30 });
            
            doc.y += boxHeight + 12;
          }
        });
        doc.moveDown(0.5);
      }

      // ── CEO Comments Section ──
      if (comments && comments.length > 0) {
        checkPageBreak(80);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor)
          .text('Commentaires & Retours Direction', 50, doc.y);
        doc.moveDown(0.4);

        comments.forEach(c => {
          const authorName = `${c.author?.firstName || ''} ${c.author?.lastName || ''}`.trim();
          const dateStr = new Date(c.createdAt).toLocaleDateString('fr-FR');
          const contentStr = c.content.trim();
          const textHeight = doc.heightOfString(contentStr, { width: pageWidth - 30 });
          const boxHeight = textHeight + 25;
          checkPageBreak(boxHeight + 20);

          doc.rect(50, doc.y, pageWidth, boxHeight).fillColor('#F1F5F9').fill();
          doc.rect(50, doc.y, 4, boxHeight).fillColor(primaryColor).fill();

          doc.fontSize(8).font('Helvetica-Bold').fillColor(darkColor).text(`${authorName.toUpperCase()} — ${dateStr}`, 65, doc.y + 8);
          doc.fontSize(9).font('Helvetica').fillColor('#334155').text(contentStr, 65, doc.y + 22, { width: pageWidth - 30 });

          doc.y += boxHeight + 12;
        });
        doc.moveDown(0.5);
      }

      // ── Approval History Section ──
      if (approvals && approvals.length > 0) {
        checkPageBreak(80);
        doc.fontSize(12).font('Helvetica-Bold').fillColor(primaryColor)
          .text('Historique des Décisions', 50, doc.y);
        doc.moveDown(0.4);

        approvals.forEach(a => {
          const reviewerName = `${a.reviewer?.firstName || ''} ${a.reviewer?.lastName || ''}`.trim();
          const dateStr = new Date(a.createdAt).toLocaleDateString('fr-FR');
          const commentStr = a.comment ? a.comment.trim() : '';
          const textHeight = commentStr ? doc.heightOfString(commentStr, { width: pageWidth - 30 }) : 0;
          const boxHeight = Math.max(35, textHeight + 25);
          checkPageBreak(boxHeight + 20);

          const actionColors: Record<string, { bg: string; accent: string }> = { 
            APPROVED: { bg: '#ECFDF5', accent: '#10B981' }, 
            REJECTED: { bg: '#FEF2F2', accent: '#EF4444' }, 
            MODIFICATION_REQUESTED: { bg: '#FFFBEB', accent: '#F59E0B' } 
          };
          const style = actionColors[a.action] || { bg: '#F8FAFC', accent: '#475569' };

          doc.rect(50, doc.y, pageWidth, boxHeight).fillColor(style.bg).fill();
          doc.rect(50, doc.y, 4, boxHeight).fillColor(style.accent).fill();

          const statusFrench: Record<string, string> = { APPROVED: 'APPROUVÉ', REJETED: 'REJETÉ', MODIFICATION_REQUESTED: 'MODIFICATIONS DEMANDÉES' };
          doc.fontSize(8).font('Helvetica-Bold').fillColor(style.accent).text(`${statusFrench[a.action] || a.action} par ${reviewerName} le ${dateStr}`, 65, doc.y + 8);
          if (commentStr) {
            doc.fontSize(9).font('Helvetica').fillColor('#334155').text(commentStr, 65, doc.y + 22, { width: pageWidth - 30 });
          }

          doc.y += boxHeight + 12;
        });
        doc.moveDown(0.5);
      }

      // ── Signature Block Section ──
      checkPageBreak(90);
      doc.moveDown(1.5);
      const sigY = doc.y;
      
      doc.fontSize(9).font('Helvetica-Bold').fillColor(darkColor)
        .text('SIGNATURE DU MANAGER', 50, sigY)
        .fontSize(8).font('Helvetica').fillColor(grayColor)
        .text('Date : ____ / ____ / ________', 50, sigY + 14)
        .moveTo(50, sigY + 50).lineTo(220, sigY + 50).strokeColor(lineColor).lineWidth(1).stroke();
        
      doc.fontSize(9).font('Helvetica-Bold').fillColor(darkColor)
        .text('SIGNATURE DU DIRECTEUR (CEO)', 310, sigY)
        .fontSize(8).font('Helvetica').fillColor(grayColor)
        .text('Date : ____ / ____ / ________', 310, sigY + 14)
        .moveTo(310, sigY + 50).lineTo(480, sigY + 50).strokeColor(lineColor).lineWidth(1).stroke();

      // ── Draw Headers and Footers decoration on all pages (2-pass layout) ──
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        
        // Dynamic top banner (blue accent line)
        doc.rect(0, 0, doc.page.width, 10).fill(primaryColor);
        
        // Footer line
        const footerY = doc.page.height - 40;
        doc.moveTo(50, footerY - 5).lineTo(doc.page.width - 50, footerY - 5).strokeColor(lineColor).lineWidth(0.5).stroke();
        
        // Footer labels
        doc.fontSize(7).font('Helvetica-Bold').fillColor(grayColor)
          .text('CREATIVART — CONFIDENTIEL', 50, footerY, { align: 'left' });
        doc.fontSize(7).font('Helvetica').fillColor(grayColor)
          .text(`Page ${i + 1} sur ${range.count}`, doc.page.width - 150, footerY, { width: 100, align: 'right' });
      }

      doc.end();
    });
  }

  // ─── Excel Export ──────────────────────────────────────────────────────────────

  async exportExcel(id: string, user: any): Promise<Buffer> {
    const report = await this.findOne(id, user);
    const data = report.data as any;
    const summary = data?.summary || {};
    const notes = report.notes as any;

    // Dynamic import of exceljs to avoid compile issues if not installed
    let ExcelJS: any;
    try {
      ExcelJS = require('exceljs');
    } catch {
      throw new BadRequestException('Excel export requires exceljs package. Please install it.');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AgencyOS';
    workbook.created = new Date();

    // ── Sheet 1: General Info ──
    const infoSheet = workbook.addWorksheet('Informations Générales');
    infoSheet.columns = [
      { header: 'Champ', key: 'field', width: 25 },
      { header: 'Valeur', key: 'value', width: 40 },
    ];
    const primaryStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } } };
    infoSheet.getRow(1).eachCell(cell => Object.assign(cell, primaryStyle));

    const infoData = [
      ['Titre du Rapport', report.name],
      ['Département', report.department?.name || (report.type === 'HR' ? 'Ressources Humaines' : 'Finance')],
      ['Manager', `${report.manager?.firstName || report.createdBy?.firstName || ''} ${report.manager?.lastName || report.createdBy?.lastName || ''}`],
      ['Période de début', report.periodStart ? new Date(report.periodStart).toLocaleDateString('fr-FR') : '-'],
      ['Période de fin', report.periodEnd ? new Date(report.periodEnd).toLocaleDateString('fr-FR') : '-'],
      ['Date de création', new Date(report.createdAt).toLocaleDateString('fr-FR')],
      ['Statut', report.workflowStatus || report.status],
      ['Version', `v${report.version}`],
    ];
    infoData.forEach(([field, value]) => infoSheet.addRow({ field, value }));

    // ── Sheet 2: KPIs ──
    const kpiSheet = workbook.addWorksheet('Indicateurs KPI');
    kpiSheet.columns = [
      { header: 'Indicateur', key: 'indicator', width: 35 },
      { header: 'Valeur', key: 'value', width: 20 },
    ];
    kpiSheet.getRow(1).eachCell(cell => Object.assign(cell, primaryStyle));

    Object.entries(summary).forEach(([key, val]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      kpiSheet.addRow({ indicator: label, value: typeof val === 'number' ? val : String(val) });
    });

    // ── Sheet 3: Manager Notes ──
    if (notes && typeof notes === 'object') {
      const notesSheet = workbook.addWorksheet('Notes du Manager');
      notesSheet.columns = [
        { header: 'Section', key: 'section', width: 30 },
        { header: 'Contenu', key: 'content', width: 80 },
      ];
      notesSheet.getRow(1).eachCell(cell => Object.assign(cell, primaryStyle));

      const noteLabels: Record<string, string> = {
        achievements: 'Réalisations',
        problems: 'Problèmes identifiés',
        risks: 'Risques',
        recommendations: 'Recommandations',
        improvementPlan: 'Plan d\'amélioration',
        generalObservations: 'Observations générales',
        financialAnalysis: 'Analyse financière',
        budgetIssues: 'Problèmes budgétaires',
        plannedActions: 'Actions planifiées',
      };

      Object.entries(notes).forEach(([key, val]) => {
        const label = noteLabels[key] || key;
        notesSheet.addRow({ section: label, content: String(val || '') });
      });
    }

    // ── Sheet 4: Charts data ──
    if (data?.charts) {
      const chartsSheet = workbook.addWorksheet('Données Graphiques');
      chartsSheet.addRow(['Type de données', 'Catégorie', 'Valeur']).font = { bold: true };

      Object.entries(data.charts).forEach(([chartKey, chartData]) => {
        if (Array.isArray(chartData)) {
          (chartData as any[]).forEach(item => {
            const label = chartKey.replace(/([A-Z])/g, ' $1');
            const category = item.name || item.status || item.type || item.month || '';
            const value = item.count || item.amount || item.revenue || item.profit || 0;
            chartsSheet.addRow([label, category, value]);
          });
        }
      });
    }

    // ── Sheet 5: Comments ──
    const comments = report.reportComments as any[];
    if (comments && comments.length > 0) {
      const commSheet = workbook.addWorksheet('Commentaires');
      commSheet.columns = [
        { header: 'Auteur', key: 'author', width: 25 },
        { header: 'Commentaire', key: 'content', width: 70 },
        { header: 'Date', key: 'date', width: 20 },
      ];
      commSheet.getRow(1).eachCell(cell => Object.assign(cell, primaryStyle));
      comments.forEach(c => {
        commSheet.addRow({
          author: `${c.author?.firstName || ''} ${c.author?.lastName || ''}`.trim(),
          content: c.content,
          date: new Date(c.createdAt).toLocaleDateString('fr-FR'),
        });
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ─── Analytics ────────────────────────────────────────────────────────────────

  async getComparisonAnalytics() {
    const departments = await this.prisma.department.findMany({
      include: {
        employees: { select: { id: true, status: true, performanceScore: true } },
        expenses: { where: { isApproved: true }, select: { amount: true } },
      },
    });

    return departments.map(dept => {
      const employees = dept.employees;
      const activeEmployees = employees.filter(e => e.status === 'ACTIVE').length;
      const totalExpenses = dept.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const avgProductivity = employees.length > 0
        ? Math.round(employees.reduce((sum, e) => sum + e.performanceScore, 0) / employees.length)
        : 0;
      const budget = Number(dept.budget || 0);
      const budgetUtilization = budget > 0 ? Math.round((totalExpenses / budget) * 100) : 0;

      return {
        id: dept.id,
        name: dept.name,
        employeeCount: employees.length,
        activeEmployeeCount: activeEmployees,
        expenses: totalExpenses,
        averageProductivity: avgProductivity,
        budget,
        budgetUtilization,
        revenueContribution: 0,
      };
    });
  }

  async getCeoSummary() {
    const [totalReports, pendingReports, approvedReports, rejectedReports] = await Promise.all([
      this.prisma.report.count({ where: { isArchived: false } }),
      this.prisma.report.count({ where: { workflowStatus: WORKFLOW_STATUS.SUBMITTED } }),
      this.prisma.report.count({ where: { workflowStatus: WORKFLOW_STATUS.APPROVED } }),
      this.prisma.report.count({ where: { workflowStatus: WORKFLOW_STATUS.REJECTED } }),
    ]);
    return { totalReports, pendingReports, approvedReports, rejectedReports };
  }

  // ─── Schedule ─────────────────────────────────────────────────────────────────

  async createSchedule(reportId: string, dto: CreateReportScheduleDto, user: any) {
    await this.findOne(reportId, user);
    return this.prisma.reportSchedule.create({
      data: { reportId, cronExpr: dto.cronExpr, recipients: dto.recipients, isActive: dto.isActive ?? true },
    });
  }

  // ─── PRIVATE: Legacy generate methods (kept for runReport compatibility) ─────

  private async generateFinancialReport(filters: Record<string, any>, user?: any) {
    const { dateFrom, dateTo } = this.parseDateRange(filters);
    const dto = { periodStart: dateFrom?.toISOString(), periodEnd: dateTo?.toISOString() };
    return this.generateFinanceReportData(dto, user);
  }

  private async generateHrReport(filters: Record<string, any>, user?: any) {
    const { dateFrom, dateTo } = this.parseDateRange(filters);
    const dto = { periodStart: dateFrom?.toISOString(), periodEnd: dateTo?.toISOString() };
    return this.generateHrReportData(dto, user);
  }

  private async generateProjectReport(filters: Record<string, any>, user: any) {
    const role = user?.role?.name;
    let projectWhere: Prisma.ProjectWhereInput = {};

    if (role === 'CHEF_PROJET') {
      const pmProjects = await this.prisma.projectMember.findMany({
        where: { userId: user.id },
        select: { projectId: true },
      });
      projectWhere = { id: { in: pmProjects.map(p => p.projectId) } };
    }

    if (filters.projectId) {
      projectWhere = { id: filters.projectId };
    }

    const projects = await this.prisma.project.findMany({
      where: projectWhere,
      include: {
        client: { select: { companyName: true } },
        tasks: {
          select: {
            id: true, title: true, status: true, priority: true, dueDate: true,
            estimatedHours: true, actualHours: true,
            assignee: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        milestones: { select: { id: true, title: true, status: true, dueDate: true } },
        members: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        _count: { select: { tasks: true, milestones: true, members: true } },
      },
    });

    const now = new Date();
    const allTasks = projects.flatMap(p => p.tasks);
    const totalTasks = allTasks.length;
    const doneTasks = allTasks.filter(t => t.status === 'DONE').length;
    const overdueTasks = allTasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED' && t.dueDate && new Date(t.dueDate) < now).length;
    const inProgressTasks = allTasks.filter(t => t.status === 'IN_PROGRESS').length;

    const taskStatusMap: Record<string, number> = {};
    allTasks.forEach(t => { taskStatusMap[t.status] = (taskStatusMap[t.status] || 0) + 1; });
    const taskStatusDist = Object.entries(taskStatusMap).map(([status, count]) => ({ status, count }));

    const projectProgress = projects.map(p => {
      const pTasks = p.tasks.length;
      const pDone = p.tasks.filter(t => t.status === 'DONE').length;
      const pOverdue = p.tasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED' && t.dueDate && new Date(t.dueDate) < now).length;
      const completion = pTasks > 0 ? Math.round((pDone / pTasks) * 100) : 0;
      const budgetUsed = p.tasks.reduce((s, t) => s + Number(t.actualHours || 0), 0) * 50;
      return {
        id: p.id, name: p.name, client: p.client?.companyName || 'Sans client', status: p.status,
        totalTasks: pTasks, doneTasks: pDone, overdueTasks: pOverdue, completion,
        budget: Number(p.budget || 0), budgetUsed,
        budgetUtilization: Number(p.budget) > 0 ? Math.round((budgetUsed / Number(p.budget)) * 100) : 0,
        members: p._count.members,
      };
    });

    const workloadMap: Record<string, { name: string; activeTasks: number; completedTasks: number }> = {};
    allTasks.forEach(t => {
      if (t.assignee) {
        const key = t.assignee.id;
        if (!workloadMap[key]) workloadMap[key] = { name: `${t.assignee.firstName} ${t.assignee.lastName}`, activeTasks: 0, completedTasks: 0 };
        if (t.status === 'DONE') workloadMap[key].completedTasks++;
        else workloadMap[key].activeTasks++;
      }
    });

    const allMilestones = projects.flatMap(p => p.milestones);
    const completedMilestones = allMilestones.filter(m => m.status === 'COMPLETED').length;

    return {
      type: 'PROJECT',
      generatedAt: new Date(),
      summary: {
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'ACTIVE').length,
        totalTasks,
        doneTasks,
        overdueTasks,
        inProgressTasks,
        completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
        totalMilestones: allMilestones.length,
        completedMilestones,
        delayedProjectsCount: projectProgress.filter(p => p.overdueTasks > 0).length,
      },
      charts: {
        projectProgress,
        taskStatusDist,
        teamWorkload: Object.values(workloadMap).slice(0, 10),
        delayedProjects: projectProgress.filter(p => p.overdueTasks > 0),
      },
    };
  }

  private async generateCrmReport(filters: Record<string, any>) {
    const leads = await this.prisma.lead.findMany({ where: { isArchived: false }, select: { id: true, status: true, estimatedValue: true } });
    const clients = await this.prisma.client.findMany({ where: { isArchived: false }, select: { id: true } });
    const wonLeads = leads.filter(l => l.status === 'WON').length;
    const totalPipelineValue = leads.reduce((s, l) => s + Number(l.estimatedValue || 0), 0);
    const conversionRate = leads.length > 0 ? Math.round((wonLeads / leads.length) * 100) : 0;
    return {
      type: 'CRM', generatedAt: new Date(),
      summary: { totalLeads: leads.length, wonLeads, conversionRate, totalClients: clients.length, totalPipelineValue },
      charts: { leadByStatus: Object.entries(leads.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([status, count]) => ({ status, count })) },
    };
  }

  private async generateMarketingReport(filters: Record<string, any>) {
    return this.generateCrmReport(filters);
  }

  private async generateSalesReport(filters: Record<string, any>) {
    const quotes = await this.prisma.quote.findMany({ where: { isArchived: false }, select: { id: true, status: true, total: true } });
    const approvedQuotes = quotes.filter(q => ['ACCEPTED', 'APPROVED'].includes(q.status)).length;
    const pipelineValue = quotes.filter(q => !['REJECTED', 'EXPIRED'].includes(q.status)).reduce((s, q) => s + Number(q.total), 0);
    return {
      type: 'SALES', generatedAt: new Date(),
      summary: { totalQuotes: quotes.length, approvedQuotes, rejectedQuotes: quotes.filter(q => q.status === 'REJECTED').length, quoteConversionRate: quotes.length > 0 ? Math.round((approvedQuotes / quotes.length) * 100) : 0, totalPipelineValue: pipelineValue },
      charts: {},
    };
  }

  private async generateProductivityReport(filters: Record<string, any>) {
    const employees = await this.prisma.employeeProfile.findMany({
      include: {
        user: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
        attendances: { take: 30, orderBy: { date: 'desc' }, select: { status: true, hoursWorked: true } },
      },
    });

    const employeeScores = employees.map(emp => {
      const atts = emp.attendances;
      const totalAtt = atts.length;
      const presentAtt = atts.filter(a => ['PRESENT', 'REMOTE'].includes(a.status)).length;
      const attendanceRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 100;
      return {
        id: emp.id, name: `${emp.user.firstName} ${emp.user.lastName}`,
        department: emp.department?.name || 'N/A',
        productivityScore: emp.performanceScore, attendanceRate,
        completedTasks: 0, totalTasks: 0, projectsCount: 0,
      };
    }).sort((a, b) => b.productivityScore - a.productivityScore).slice(0, 10);

    const deptScores: Record<string, number[]> = {};
    employees.forEach(e => {
      const d = e.department?.name || 'N/A';
      if (!deptScores[d]) deptScores[d] = [];
      deptScores[d].push(e.performanceScore);
    });
    const deptAverages = Object.entries(deptScores).map(([name, scores]) => ({
      name, score: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    })).sort((a, b) => b.score - a.score);

    return {
      type: 'PRODUCTIVITY', generatedAt: new Date(),
      summary: {
        totalEmployees: employees.length,
        averageProductivityScore: employees.length > 0 ? Math.round(employees.reduce((s, e) => s + e.performanceScore, 0) / employees.length) : 0,
        highestProductiveDept: deptAverages[0]?.name || '-',
        lowestProductiveDept: deptAverages[deptAverages.length - 1]?.name || '-',
      },
      charts: { employeeScores, departmentScores: deptAverages },
    };
  }
}
