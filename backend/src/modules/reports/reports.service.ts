import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateReportScheduleDto } from './dto/create-report-schedule.dto';
import { ReportType, Prisma, InvoiceStatus, QuoteStatus, TaskStatus, ProjectStatus, LeaveStatus, LeaveType } from '@prisma/client';
import { ReportInsightService } from './report-insight.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportInsightService: ReportInsightService,
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

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  async findAll(user: any, filters: { type?: ReportType; createdById?: string; isArchived?: boolean } = {}) {
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
    };

    // Department security for managers
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
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
        schedules: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user?: any) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
        schedules: true,
      },
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

      if (role === 'CHEF_PROJET' && report.type === ReportType.PROJECT) {
        const filters = (report.filters as Record<string, any>) || {};
        if (filters.projectId) {
          const isMember = await this.prisma.projectMember.findFirst({
            where: { projectId: filters.projectId, userId: user.id },
          });
          if (!isMember) {
            throw new ForbiddenException('Access denied: You are not assigned to the project of this report.');
          }
        }
      }
    }

    return report;
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

    if (role === 'CHEF_PROJET' && dto.type === ReportType.PROJECT) {
      const filters = (dto.filters as Record<string, any>) || {};
      if (filters.projectId) {
        const isMember = await this.prisma.projectMember.findFirst({
          where: { projectId: filters.projectId, userId: user.id },
        });
        if (!isMember) {
          throw new ForbiddenException('Access denied: You can only create reports for projects you are assigned to.');
        }
      }
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

    return this.prisma.report.create({
      data: {
        name: reportName,
        type: dto.type,
        subType: dto.subType,
        filters: dto.filters ?? {},
        isShared: dto.isShared ?? false,
        createdById: user.id,
        departmentId: deptId || undefined,
        managerId: role !== 'GERANT' ? user.id : undefined,
        reportingPeriod: dto.reportingPeriod || 'Current Month',
        status: 'PENDING_REVIEW',
        version: 1,
      },
    });
  }

  async update(id: string, dto: Partial<CreateReportDto>, user: any) {
    const report = await this.findOne(id, user);

    if (dto.type) {
      const role = user?.role?.name;
      const allowedTypes = this.getAllowedReportTypes(role);
      if (!allowedTypes.includes(dto.type)) {
        throw new ForbiddenException(`Access denied: You cannot change report type to ${dto.type}.`);
      }
    }

    return this.prisma.report.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.type && { type: dto.type }),
        ...(dto.subType !== undefined && { subType: dto.subType }),
        ...(dto.filters !== undefined && { filters: dto.filters }),
        ...(dto.isShared !== undefined && { isShared: dto.isShared }),
        ...(dto.reportingPeriod !== undefined && { reportingPeriod: dto.reportingPeriod }),
      },
    });
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

  // ─── Report REVIEW Workflow ──────────────────────────────────────────────────

  async approveReport(id: string, approverId: string, comment?: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(`Rapport introuvable.`);

    const updated = await this.prisma.report.update({
      where: { id },
      data: { status: 'APPROVED', comment: comment || 'Approuvé par la direction' },
    });

    if (report.createdById) {
      await this.prisma.notification.create({
        data: {
          userId: report.createdById,
          type: 'SYSTEM',
          title: `Rapport Approuvé : ${report.name}`,
          body: `Votre rapport ${report.name} a été approuvé par la direction.`,
        },
      });
    }

    return updated;
  }

  async rejectReport(id: string, reviewerId: string, reason: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException(`Rapport introuvable.`);

    const updated = await this.prisma.report.update({
      where: { id },
      data: { status: 'REJECTED', comment: reason || 'Rejeté pour révision' },
    });

    if (report.createdById) {
      await this.prisma.notification.create({
        data: {
          userId: report.createdById,
          type: 'SYSTEM',
          title: `Rapport Rejeté : ${report.name}`,
          body: `Votre rapport ${report.name} a été rejeté. Raison : ${reason}`,
        },
      });
    }

    return updated;
  }

  // ─── Report Execution ─────────────────────────────────────────────────────────

  async runReport(reportId: string, user: any) {
    const report = await this.findOne(reportId, user);
    const filters = (report.filters as Record<string, any>) ?? {};

    let data: any;

    switch (report.type) {
      case ReportType.FINANCIAL:
        data = await this.generateFinancialReport(filters);
        break;
      case ReportType.HR:
        data = await this.generateHrReport(filters);
        break;
      case ReportType.PROJECT:
        data = await this.generateProjectReport(filters, user);
        break;
      case ReportType.CRM:
        data = await this.generateCrmReport(filters);
        break;
      case ReportType.MARKETING:
        data = await this.generateMarketingReport(filters);
        break;
      case ReportType.SALES:
        data = await this.generateSalesReport(filters);
        break;
      case ReportType.PRODUCTIVITY:
        data = await this.generateProductivityReport(filters);
        break;
      default:
        data = { message: 'Report type not supported', type: report.type };
    }

    const { dateFrom, dateTo } = this.parseDateRange(filters);
    const insightsList = await this.reportInsightService.generateInsights(reportId, report.type, data.summary);
    
    // Combine dynamic insights for backwards compatibility with the JSON aiInsights field
    const keyFindings = insightsList.map(i => i.insightText);
    const performanceSummary = insightsList[0]?.insightText || 'Activité stable.';
    const aiInsights = {
      keyFindings,
      performanceSummary,
      risks: insightsList.filter(i => i.severity === 'HIGH').map(i => i.insightText),
      opportunities: insightsList.filter(i => i.severity === 'MEDIUM').map(i => i.insightText),
      recommendations: ['Consolider les processus opérationnels en fonction des constats.'],
      priorityLevel: insightsList.some(i => i.severity === 'HIGH') ? 'HIGH' : 'MEDIUM',
    };

    // Save metrics
    if (data.summary) {
      const metricsData = Object.entries(data.summary)
        .filter(([_, val]) => typeof val === 'number')
        .map(([key, val]) => ({
          reportId,
          metricName: key,
          metricValue: Number(val),
        }));
      if (metricsData.length > 0) {
        await this.prisma.reportMetric.deleteMany({ where: { reportId } });
        await this.prisma.reportMetric.createMany({ data: metricsData });
      }
    }

    // Determine sequential report code if not already set
    let reportCode = report.reportNumber;
    if (!reportCode) {
      const latestReport = await this.prisma.report.findFirst({
        where: { reportNumber: { startsWith: 'RPT-' } },
        orderBy: { reportNumber: 'desc' },
        select: { reportNumber: true },
      });
      if (latestReport?.reportNumber) {
        const match = latestReport.reportNumber.match(/^RPT-(\d+)/);
        if (match) {
          const lastSeq = parseInt(match[1], 10);
          reportCode = `RPT-${String(lastSeq + 1).padStart(3, '0')}`;
        }
      } else {
        reportCode = 'RPT-001';
      }
    }

    const updatedReport = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        data,
        aiInsights,
        status: 'PENDING_REVIEW',
        version: report.version + 1,
        reportNumber: reportCode,
        title: report.name,
        periodStart: dateFrom || new Date(),
        periodEnd: dateTo || new Date(),
        summary: performanceSummary,
        jsonData: data,
        pdfUrl: `/pdf/reports/${reportId}.pdf`,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Notify CEO
    const ceos = await this.prisma.user.findMany({
      where: { role: { name: 'GERANT' } },
      select: { id: true },
    });

    const senderName = `${user.firstName} ${user.lastName}`;
    for (const ceo of ceos) {
      await this.prisma.notification.create({
        data: {
          userId: ceo.id,
          type: 'SYSTEM',
          title: `Rapport à valider : ${report.name}`,
          body: `Le manager ${senderName} a généré et soumis le rapport ${report.name}.`,
          resourceId: reportId,
        },
      });
    }

    return updatedReport;
  }

  // ─── FINANCIAL REPORT ─────────────────────────────────────────────────────────

  private async generateFinancialReport(filters: Record<string, any>) {
    const { dateFrom, dateTo } = this.parseDateRange(filters);

    const dateFilter = dateFrom && dateTo ? { gte: dateFrom, lte: dateTo } : undefined;

    const [invoices, payments, expenses, quotes, salaries] = await Promise.all([
      this.prisma.invoice.findMany({
        where: dateFilter ? { issueDate: dateFilter } : {},
        select: {
          id: true, reference: true, status: true, total: true, paidAmount: true,
          dueDate: true, issueDate: true, currency: true,
          client: { select: { id: true, companyName: true } },
        },
      }),
      this.prisma.payment.findMany({
        where: dateFilter ? { paidAt: dateFilter } : {},
        select: { id: true, amount: true, method: true, paidAt: true, invoice: { select: { reference: true } } },
      }),
      this.prisma.expense.findMany({
        where: {
          ...(dateFilter ? { expenseDate: dateFilter } : {}),
        },
        select: {
          id: true, description: true, amount: true, expenseDate: true,
          isApproved: true, currency: true,
          category: { select: { id: true, name: true } },
        },
      }),
      this.prisma.quote.findMany({
        where: dateFilter ? { issueDate: dateFilter } : {},
        select: { id: true, reference: true, status: true, total: true },
      }),
      this.prisma.salary.findMany({
        where: { effectiveTo: null },
        select: { amount: true },
      }),
    ]);

    const approvedExpenses = expenses.filter(e => e.isApproved);
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalExpenses = approvedExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const payrollCost = salaries.reduce((sum, s) => sum + Number(s.amount), 0);
    const netProfit = totalRevenue - totalExpenses - payrollCost;
    const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

    // Invoice status distribution
    const invoiceStatusDist = [
      { status: 'DRAFT', count: invoices.filter(i => i.status === 'DRAFT').length },
      { status: 'SENT', count: invoices.filter(i => i.status === 'SENT').length },
      { status: 'PAID', count: invoices.filter(i => i.status === 'PAID').length },
      { status: 'OVERDUE', count: invoices.filter(i => i.status === 'OVERDUE').length },
      { status: 'PARTIALLY_PAID', count: invoices.filter(i => i.status === 'PARTIALLY_PAID').length },
      { status: 'PENDING_APPROVAL', count: invoices.filter(i => i.status === 'PENDING_APPROVAL').length },
    ].filter(s => s.count > 0);

    // Expense breakdown by category
    const categoryMap: Record<string, { name: string; amount: number; count: number }> = {};
    approvedExpenses.forEach(e => {
      const catName = e.category?.name || 'Autre';
      if (!categoryMap[catName]) categoryMap[catName] = { name: catName, amount: 0, count: 0 };
      categoryMap[catName].amount += Number(e.amount);
      categoryMap[catName].count += 1;
    });
    const expenseByCategory = Object.values(categoryMap).sort((a, b) => b.amount - a.amount);

    // Monthly revenue trend (last 6 months)
    const monthlyTrend: { month: string; revenue: number; expenses: number; profit: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const label = start.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

      const mRev = payments.filter(p => new Date(p.paidAt) >= start && new Date(p.paidAt) <= end)
        .reduce((s, p) => s + Number(p.amount), 0);
      const mExp = approvedExpenses.filter(e => new Date(e.expenseDate) >= start && new Date(e.expenseDate) <= end)
        .reduce((s, e) => s + Number(e.amount), 0);

      monthlyTrend.push({ month: label, revenue: mRev, expenses: mExp, profit: mRev - mExp - (payrollCost / 6) });
    }

    // Quote conversion rate
    const totalQuotes = quotes.length;
    const approvedQuotes = quotes.filter(q => q.status === 'APPROVED' || q.status === 'ACCEPTED').length;
    const quoteConversionRate = totalQuotes > 0 ? Math.round((approvedQuotes / totalQuotes) * 100) : 0;

    // Top 5 clients by revenue
    const clientRevMap: Record<string, { name: string; revenue: number }> = {};
    invoices.forEach(inv => {
      const cn = inv.client?.companyName || 'Inconnu';
      if (!clientRevMap[cn]) clientRevMap[cn] = { name: cn, revenue: 0 };
      clientRevMap[cn].revenue += Number(inv.paidAmount);
    });
    const topClients = Object.values(clientRevMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Outstanding amount
    const outstandingAmount = invoices
      .filter(i => ['SENT', 'OVERDUE', 'PARTIALLY_PAID', 'APPROVED'].includes(i.status))
      .reduce((sum, i) => sum + Number(i.total) - Number(i.paidAmount), 0);

    const outstandingInvoicesCount = invoices.filter(i => i.status !== 'PAID').length;
    const cashFlow = totalRevenue - totalExpenses;

    return {
      type: 'FINANCIAL',
      generatedAt: new Date(),
      summary: {
        totalRevenue,
        totalExpenses,
        payrollCost,
        netProfit,
        profitMargin,
        invoiceCount: invoices.length,
        paidInvoices: invoices.filter(i => i.status === 'PAID').length,
        overdueInvoices: invoices.filter(i => i.status === 'OVERDUE').length,
        outstandingAmount,
        outstandingInvoicesCount,
        totalQuotes,
        approvedQuotes,
        quoteConversionRate,
        expenseCount: approvedExpenses.length,
        cashFlow,
      },
      charts: {
        monthlyTrend,
        invoiceStatusDist,
        expenseByCategory,
        topClients,
      },
    };
  }

  // ─── HR REPORT ────────────────────────────────────────────────────────────────

  private async generateHrReport(filters: Record<string, any>) {
    const { dateFrom, dateTo } = this.parseDateRange(filters);
    const dateFilter = dateFrom && dateTo ? { gte: dateFrom, lte: dateTo } : undefined;

    const [employees, leaveRequests, contracts, attendances, vacancies, candidates, salaries] = await Promise.all([
      this.prisma.employeeProfile.findMany({
        include: {
          user: { select: { firstName: true, lastName: true, email: true, isActive: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      this.prisma.leaveRequest.findMany({
        where: dateFilter ? { startDate: dateFilter } : {},
        include: {
          employee: { include: { user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } } },
        },
      }),
      this.prisma.contract.findMany({
        where: { isActive: true },
        select: { id: true, type: true, grossSalary: true, currency: true, employee: { select: { user: { select: { firstName: true, lastName: true } } } } },
      }),
      this.prisma.attendance.findMany({
        where: dateFilter ? { date: dateFilter } : {},
        select: { id: true, status: true, hoursWorked: true, date: true },
      }),
      this.prisma.jobVacancy.findMany({
        where: { isArchived: false },
        select: { id: true, title: true, status: true, _count: { select: { candidates: true } } },
      }),
      this.prisma.candidate.findMany({
        where: { isArchived: false },
        select: { id: true, status: true },
      }),
      this.prisma.salary.findMany({
        where: { effectiveTo: null },
        select: { amount: true, currency: true },
      }),
    ]);

    const activeEmployees = employees.filter(e => e.status === 'ACTIVE').length;
    const onLeaveEmployees = employees.filter(e => e.status === 'ON_LEAVE').length;

    // Department distribution
    const deptMap: Record<string, number> = {};
    employees.forEach(e => {
      const dName = e.department?.name || 'Non assigné';
      deptMap[dName] = (deptMap[dName] || 0) + 1;
    });
    const departmentDistribution = Object.entries(deptMap).map(([name, count]) => ({ name, count }));

    // Leave by status
    const leaveByStatus = [
      { status: 'PENDING', count: leaveRequests.filter(l => l.status === 'PENDING').length },
      { status: 'APPROVED', count: leaveRequests.filter(l => l.status === 'APPROVED').length },
      { status: 'REJECTED', count: leaveRequests.filter(l => l.status === 'REJECTED').length },
      { status: 'REVIEWED', count: leaveRequests.filter(l => (l.status as string) === 'REVIEWED').length },
    ].filter(s => s.count > 0);

    // Leave by type
    const leaveTypeMap: Record<string, number> = {};
    leaveRequests.forEach(l => {
      leaveTypeMap[l.type] = (leaveTypeMap[l.type] || 0) + 1;
    });
    const leaveByType = Object.entries(leaveTypeMap).map(([type, count]) => ({ type, count }));

    // Attendance stats
    const totalAttendance = attendances.length;
    const presentCount = attendances.filter(a => ['PRESENT', 'REMOTE'].includes(a.status)).length;
    const lateCount = attendances.filter(a => a.status === 'LATE').length;
    const absentCount = attendances.filter(a => a.status === 'ABSENT').length;
    const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 100;
    const avgHoursWorked = totalAttendance > 0
      ? (attendances.reduce((s, a) => s + Number(a.hoursWorked || 0), 0) / totalAttendance).toFixed(1)
      : '0';

    // Contract type distribution
    const contractTypeMap: Record<string, number> = {};
    contracts.forEach(c => {
      contractTypeMap[c.type] = (contractTypeMap[c.type] || 0) + 1;
    });
    const contractByType = Object.entries(contractTypeMap).map(([type, count]) => ({ type, count }));

    // Total payroll
    const totalPayroll = salaries.reduce((sum, s) => sum + Number(s.amount), 0);

    // Recruitment
    const openVacancies = vacancies.filter(v => v.status === 'OPEN').length;
    const candidatesByStatus = [
      { status: 'APPLIED', count: candidates.filter(c => c.status === 'APPLIED').length },
      { status: 'INTERVIEWING', count: candidates.filter(c => c.status === 'INTERVIEWING').length },
      { status: 'OFFERED', count: candidates.filter(c => c.status === 'OFFERED').length },
      { status: 'HIRED', count: candidates.filter(c => c.status === 'HIRED').length },
      { status: 'REJECTED', count: candidates.filter(c => c.status === 'REJECTED').length },
    ].filter(s => s.count > 0);

    return {
      type: 'HR',
      generatedAt: new Date(),
      summary: {
        totalEmployees: employees.length,
        activeEmployees,
        onLeaveEmployees,
        totalLeaveRequests: leaveRequests.length,
        pendingLeaveRequests: leaveRequests.filter(l => l.status === 'PENDING').length,
        approvedLeaveRequests: leaveRequests.filter(l => l.status === 'APPROVED').length,
        rejectedLeaveRequests: leaveRequests.filter(l => l.status === 'REJECTED').length,
        totalActiveContracts: contracts.length,
        attendanceRate,
        avgHoursWorked: parseFloat(avgHoursWorked),
        totalPayroll,
        openVacancies,
        totalCandidates: candidates.length,
        leaveRate: employees.length > 0 ? Math.round((leaveRequests.length / employees.length) * 100) : 0,
        averageSalary: employees.length > 0 ? Math.round(totalPayroll / employees.length) : 0,
      },
      charts: {
        departmentDistribution,
        leaveByStatus,
        leaveByType,
        contractByType,
        candidatesByStatus,
        attendanceSummary: [
          { status: 'Présent', count: presentCount },
          { status: 'En retard', count: lateCount },
          { status: 'Absent', count: absentCount },
        ],
      },
    };
  }

  // ─── PROJECT REPORT ───────────────────────────────────────────────────────────

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

    // Task status distribution
    const taskStatusMap: Record<string, number> = {};
    allTasks.forEach(t => {
      taskStatusMap[t.status] = (taskStatusMap[t.status] || 0) + 1;
    });
    const taskStatusDist = Object.entries(taskStatusMap).map(([status, count]) => ({ status, count }));

    // Per-project completion
    const projectProgress = projects.map(p => {
      const pTasks = p.tasks.length;
      const pDone = p.tasks.filter(t => t.status === 'DONE').length;
      const pOverdue = p.tasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED' && t.dueDate && new Date(t.dueDate) < now).length;
      const completion = pTasks > 0 ? Math.round((pDone / pTasks) * 100) : 0;
      const budgetUsed = p.tasks.reduce((s, t) => s + Number(t.actualHours || 0), 0) * 50; // 50 TND/h

      return {
        id: p.id,
        name: p.name,
        client: p.client?.companyName || 'Sans client',
        status: p.status,
        totalTasks: pTasks,
        doneTasks: pDone,
        overdueTasks: pOverdue,
        completion,
        budget: Number(p.budget || 0),
        budgetUsed,
        budgetUtilization: Number(p.budget) > 0 ? Math.round((budgetUsed / Number(p.budget)) * 100) : 0,
        members: p._count.members,
      };
    });

    // Team workload (tasks per assignee)
    const workloadMap: Record<string, { name: string; activeTasks: number; completedTasks: number }> = {};
    allTasks.forEach(t => {
      if (!t.assignee) return;
      const name = `${t.assignee.firstName} ${t.assignee.lastName}`;
      if (!workloadMap[name]) workloadMap[name] = { name, activeTasks: 0, completedTasks: 0 };
      if (t.status === 'DONE') {
        workloadMap[name].completedTasks += 1;
      } else if (t.status !== 'CANCELLED') {
        workloadMap[name].activeTasks += 1;
      }
    });
    const teamWorkload = Object.values(workloadMap).sort((a, b) => b.activeTasks - a.activeTasks);

    // Delayed projects
    const delayedProjects = projectProgress.filter(p => p.overdueTasks > 0 && p.status === 'ACTIVE');

    // Milestone completion
    const allMilestones = projects.flatMap(p => p.milestones);
    const completedMilestones = allMilestones.filter(m => m.status === 'COMPLETED').length;
    const missedMilestones = allMilestones.filter(m => m.status !== 'COMPLETED' && new Date(m.dueDate) < now).length;

    const validDurationProjects = projects.filter(p => p.startDate && p.endDate);
    const totalDurationDays = validDurationProjects.reduce((sum, p) => {
      const diff = new Date(p.endDate).getTime() - new Date(p.startDate).getTime();
      return sum + (diff / (1000 * 60 * 60 * 24));
    }, 0);
    const averageProjectDuration = validDurationProjects.length > 0 ? Math.round(totalDurationDays / validDurationProjects.length) : 90;

    const totalPlannedBudget = projects.reduce((sum, p) => sum + Number(p.budget || 0), 0);
    const totalSpentBudget = projectProgress.reduce((sum, p) => sum + p.budgetUsed, 0);
    const budgetConsumption = totalPlannedBudget > 0 ? Math.round((totalSpentBudget / totalPlannedBudget) * 100) : 0;

    return {
      type: 'PROJECT',
      generatedAt: new Date(),
      summary: {
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'ACTIVE').length,
        completedProjects: projects.filter(p => p.status === 'COMPLETED').length,
        totalTasks,
        doneTasks,
        inProgressTasks,
        overdueTasks,
        completionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
        totalMilestones: allMilestones.length,
        completedMilestones,
        missedMilestones,
        delayedProjectsCount: delayedProjects.length,
        delayedProjects: delayedProjects.length,
        taskCompletionRate: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
        averageProjectDuration,
        budgetConsumption,
      },
      charts: {
        projectProgress,
        taskStatusDist,
        teamWorkload,
        delayedProjects,
      },
    };
  }

  // ─── CRM REPORT ───────────────────────────────────────────────────────────────

  private async generateCrmReport(filters: Record<string, any>) {
    const { dateFrom, dateTo } = this.parseDateRange(filters);
    const dateFilter = dateFrom && dateTo ? { gte: dateFrom, lte: dateTo } : undefined;

    const [leads, clients] = await Promise.all([
      this.prisma.lead.findMany({
        where: dateFilter ? { createdAt: dateFilter } : {},
        select: { id: true, companyName: true, status: true, source: true, estimatedValue: true, createdAt: true },
      }),
      this.prisma.client.findMany({
        select: { id: true, companyName: true, industry: true, isActive: true, createdAt: true },
      }),
    ]);

    const wonLeads = leads.filter(l => l.status === 'WON').length;
    const lostLeads = leads.filter(l => l.status === 'LOST').length;

    // Lead source breakdown
    const sourceMap: Record<string, { source: string; count: number; wonCount: number; value: number }> = {};
    leads.forEach(l => {
      if (!sourceMap[l.source]) sourceMap[l.source] = { source: l.source, count: 0, wonCount: 0, value: 0 };
      sourceMap[l.source].count += 1;
      if (l.status === 'WON') sourceMap[l.source].wonCount += 1;
      sourceMap[l.source].value += Number(l.estimatedValue || 0);
    });
    const leadsBySource = Object.values(sourceMap);

    // Lead status distribution
    const statusMap: Record<string, number> = {};
    leads.forEach(l => { statusMap[l.status] = (statusMap[l.status] || 0) + 1; });
    const leadsByStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    return {
      type: 'CRM',
      generatedAt: new Date(),
      summary: {
        totalLeads: leads.length,
        wonLeads,
        lostLeads,
        conversionRate: leads.length > 0 ? ((wonLeads / leads.length) * 100).toFixed(1) + '%' : '0%',
        totalClients: clients.length,
        activeClients: clients.filter(c => c.isActive).length,
        pipelineValue: leads.reduce((s, l) => s + Number(l.estimatedValue || 0), 0),
      },
      charts: { leadsBySource, leadsByStatus },
    };
  }

  // ─── MARKETING REPORT ─────────────────────────────────────────────────────────

  private async generateMarketingReport(filters: Record<string, any>) {
    const { dateFrom, dateTo } = this.parseDateRange(filters);
    const dateFilter = dateFrom && dateTo ? { gte: dateFrom, lte: dateTo } : undefined;

    const leads = await this.prisma.lead.findMany({
      where: dateFilter ? { createdAt: dateFilter } : {},
      select: { id: true, status: true, source: true, estimatedValue: true, createdAt: true },
    });

    const sources = [...new Set(leads.map(l => l.source))];
    const breakdown = sources.map(src => {
      const srcLeads = leads.filter(l => l.source === src);
      return {
        source: src,
        count: srcLeads.length,
        wonCount: srcLeads.filter(l => l.status === 'WON').length,
        value: srcLeads.reduce((sum, l) => sum + Number(l.estimatedValue || 0), 0),
      };
    });

    const wonCount = leads.filter(l => l.status === 'WON').length;

    return {
      type: 'MARKETING',
      generatedAt: new Date(),
      summary: {
        totalLeads: leads.length,
        wonLeads: wonCount,
        conversionRate: leads.length > 0 ? Math.round((wonCount / leads.length) * 100) : 0,
        totalPipelineValue: leads.reduce((sum, l) => sum + Number(l.estimatedValue || 0), 0),
      },
      charts: { breakdown },
    };
  }

  // ─── SALES REPORT ─────────────────────────────────────────────────────────────

  private async generateSalesReport(filters: Record<string, any>) {
    const { dateFrom, dateTo } = this.parseDateRange(filters);
    const dateFilter = dateFrom && dateTo ? { gte: dateFrom, lte: dateTo } : undefined;

    const [quotes, leads] = await Promise.all([
      this.prisma.quote.findMany({
        where: dateFilter ? { issueDate: dateFilter } : {},
        select: { id: true, reference: true, status: true, total: true, client: { select: { companyName: true } } },
      }),
      this.prisma.lead.findMany({
        where: dateFilter ? { createdAt: dateFilter } : {},
        select: { id: true, status: true, estimatedValue: true },
      }),
    ]);

    const approvedCount = quotes.filter(q => q.status === 'APPROVED' || q.status === 'ACCEPTED').length;
    const salesPipeline = leads.reduce((sum, l) => sum + Number(l.estimatedValue || 0), 0);

    // Quote status distribution
    const quoteStatusMap: Record<string, number> = {};
    quotes.forEach(q => { quoteStatusMap[q.status] = (quoteStatusMap[q.status] || 0) + 1; });
    const quotesByStatus = Object.entries(quoteStatusMap).map(([status, count]) => ({ status, count }));

    return {
      type: 'SALES',
      generatedAt: new Date(),
      summary: {
        totalQuotes: quotes.length,
        approvedQuotes: approvedCount,
        totalPipeline: salesPipeline,
        conversions: leads.filter(l => l.status === 'WON').length,
        totalQuoteValue: quotes.reduce((s, q) => s + Number(q.total), 0),
      },
      charts: { quotesByStatus },
    };
  }

  // ─── AI Insights ──────────────────────────────────────────────────────────────

  private generateAiInsightsForReport(type: ReportType, data: any) {
    const keyFindings: string[] = [];
    const risks: string[] = [];
    const opportunities: string[] = [];
    const recommendations: string[] = [];
    let priorityLevel = 'MEDIUM';
    let performanceSummary = '';

    if (type === ReportType.FINANCIAL) {
      const s = data.summary;
      const margin = s.profitMargin;

      keyFindings.push(`Chiffre d'affaires réalisé de ${s.totalRevenue.toLocaleString()} TND sur ${s.invoiceCount} factures.`);
      keyFindings.push(`Charges approuvées de ${s.totalExpenses.toLocaleString()} TND (${s.expenseCount} dépenses).`);
      keyFindings.push(`Taux de conversion des devis : ${s.quoteConversionRate}% (${s.approvedQuotes}/${s.totalQuotes}).`);
      performanceSummary = `Marge bénéficiaire nette de ${margin}%. Bénéfice net : ${s.netProfit.toLocaleString()} TND.`;

      if (s.totalExpenses > s.totalRevenue) {
        risks.push(`Risque majeur : dépenses (${s.totalExpenses.toLocaleString()}) supérieures aux revenus (${s.totalRevenue.toLocaleString()}).`);
        priorityLevel = 'HIGH';
      } else if (margin < 15) {
        risks.push(`Marge nette critique à ${margin}%, sous le seuil de 15%.`);
        priorityLevel = 'HIGH';
      }
      if (s.overdueInvoices > 0) {
        risks.push(`${s.overdueInvoices} facture(s) en retard de paiement, montant impayé : ${s.outstandingAmount.toLocaleString()} TND.`);
      }
      if (risks.length === 0) risks.push('Trésorerie saine. Aucun risque de liquidité immédiat.');

      opportunities.push('Accélérer la relance des factures en souffrance pour améliorer le cash flow.');
      if (s.quoteConversionRate < 50) {
        opportunities.push(`Améliorer le taux de conversion des devis (actuellement ${s.quoteConversionRate}%).`);
      }
      recommendations.push('Mettre en place un suivi hebdomadaire des factures impayées.');
      recommendations.push('Négocier des délais de paiement plus courts avec les clients en retard.');
    } else if (type === ReportType.HR) {
      const s = data.summary;

      keyFindings.push(`Effectif total : ${s.totalEmployees} collaborateurs dont ${s.activeEmployees} actifs.`);
      keyFindings.push(`${s.totalLeaveRequests} demande(s) de congé dont ${s.pendingLeaveRequests} en attente.`);
      keyFindings.push(`Taux de présence : ${s.attendanceRate}% (moyenne ${s.avgHoursWorked}h/jour).`);
      keyFindings.push(`Masse salariale mensuelle : ${s.totalPayroll.toLocaleString()} TND.`);
      performanceSummary = `${s.totalActiveContracts} contrats actifs. ${s.openVacancies} poste(s) ouvert(s) au recrutement.`;

      if (s.pendingLeaveRequests > 3) {
        risks.push(`${s.pendingLeaveRequests} demandes de congé en attente risquent de bloquer la planification.`);
        priorityLevel = 'MEDIUM';
      }
      if (s.attendanceRate < 85) {
        risks.push(`Taux de présence faible (${s.attendanceRate}%). Risque de sous-effectif.`);
        priorityLevel = 'HIGH';
      }
      if (s.onLeaveEmployees > 0) {
        risks.push(`${s.onLeaveEmployees} employé(s) actuellement en congé.`);
      }
      if (risks.length === 0) risks.push('Gestion RH fluide. Aucun conflit de planning identifié.');

      opportunities.push('Planifier des entretiens de performance pour ajuster la motivation.');
      if (s.openVacancies > 0) {
        opportunities.push(`Accélérer le recrutement des ${s.openVacancies} postes ouverts.`);
      }
      recommendations.push('Traiter les demandes de congés en attente sous 48h.');
      recommendations.push('Mettre à jour les fiches de poste des contrats expirant prochainement.');
    } else if (type === ReportType.PROJECT) {
      const s = data.summary;
      const progress = s.completionRate;

      keyFindings.push(`${s.totalProjects} projets suivis : ${s.activeProjects} actifs, ${s.completedProjects} terminés.`);
      keyFindings.push(`Taux d'avancement global : ${progress}% (${s.doneTasks}/${s.totalTasks} tâches terminées).`);
      keyFindings.push(`${s.overdueTasks} tâche(s) en retard. ${s.missedMilestones} jalon(s) manqué(s).`);
      performanceSummary = `Productivité globale à ${progress}%. ${s.delayedProjectsCount} projet(s) en retard.`;

      if (s.overdueTasks > 5) {
        risks.push(`${s.overdueTasks} tâches en retard. Risque élevé d'impact sur les livrables.`);
        priorityLevel = 'HIGH';
      }
      if (s.missedMilestones > 0) {
        risks.push(`${s.missedMilestones} jalon(s) critique(s) dépassé(s).`);
        priorityLevel = 'HIGH';
      }
      if (progress < 45 && s.totalTasks > 5) {
        risks.push(`Taux d'avancement faible (${progress}%). Revoir la charge de travail.`);
      }
      if (risks.length === 0) risks.push('Projets en bonne voie. Calendrier respecté.');

      opportunities.push('Réaffecter les ressources disponibles aux tâches bloquées.');
      recommendations.push('Daily stand-up de 15 minutes pour les projets en retard.');
      recommendations.push('Revoir les priorités des tâches en backlog.');
    } else if (type === ReportType.MARKETING) {
      const s = data.summary;
      keyFindings.push(`${s.totalLeads} prospects générés. Pipeline total : ${s.totalPipelineValue.toLocaleString()} TND.`);
      keyFindings.push(`Taux de conversion : ${s.conversionRate}%.`);
      performanceSummary = `Acquisition de ${s.wonLeads} clients convertis sur ${s.totalLeads} prospects.`;
      if (s.conversionRate < 10 && s.totalLeads > 0) {
        risks.push(`Faible conversion (${s.conversionRate}%). Revoir la stratégie d'acquisition.`);
        priorityLevel = 'HIGH';
      } else {
        risks.push('Canaux d\'acquisition stables.');
      }
      opportunities.push('Renforcer les campagnes LinkedIn/SEO pour les profils B2B.');
      recommendations.push('Optimiser les formulaires de capture de leads.');
    } else {
      const total = data.summary?.totalQuotes || data.summary?.totalLeads || 0;
      keyFindings.push(`Activité commerciale : ${total} opportunités identifiées.`);
      performanceSummary = 'Volume commercial stable.';
      risks.push('Aucun risque critique détecté.');
      opportunities.push('Relancer les prospects froids sous 48h.');
      recommendations.push('Améliorer le suivi des devis envoyés.');
    }

    return { keyFindings, performanceSummary, risks, opportunities, recommendations, priorityLevel };
  }

  private async generateProductivityReport(filters: Record<string, any>) {
    const { dateFrom, dateTo } = this.parseDateRange(filters);
    const dateFilter = dateFrom && dateTo ? { gte: dateFrom, lte: dateTo } : undefined;

    // Fetch active employees, tasks, attendances, project memberships
    const [employees, tasks, attendances, projectMembers] = await Promise.all([
      this.prisma.employeeProfile.findMany({
        where: { status: 'ACTIVE' },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              id: true,
            }
          },
          department: { select: { id: true, name: true } },
        }
      }),
      this.prisma.task.findMany({
        where: dateFilter ? { createdAt: dateFilter } : {},
        select: { id: true, assigneeId: true, status: true, dueDate: true }
      }),
      this.prisma.attendance.findMany({
        where: dateFilter ? { date: dateFilter } : {},
        select: { employeeId: true, status: true }
      }),
      this.prisma.projectMember.findMany({
        select: { userId: true, projectId: true }
      }),
    ]);

    const now = new Date();

    const employeeScores = employees.map(emp => {
      const empUserTasks = tasks.filter(t => t.assigneeId === emp.userId);
      const totalTasks = empUserTasks.length;
      const completedTasks = empUserTasks.filter(t => t.status === 'DONE').length;
      const overdueTasks = empUserTasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED' && t.dueDate && new Date(t.dueDate) < now).length;

      // Completion Score (40%)
      const completionScore = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 100;

      // Delay Score (20%): Penalty for overdue tasks
      const delayScore = totalTasks > 0 ? (1 - Math.min(overdueTasks / totalTasks, 1)) * 100 : 100;

      // Attendance Score (20%)
      const empAttendances = attendances.filter(a => a.employeeId === emp.id);
      const presentDays = empAttendances.filter(a => ['PRESENT', 'REMOTE', 'LATE'].includes(a.status)).length;
      const totalDays = empAttendances.length;
      const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 100;

      // Project Participation Score (20%)
      const projectCount = projectMembers.filter(pm => pm.userId === emp.userId).length;
      const projectParticipationScore = Math.min(projectCount * 33.3, 100);

      // Weighted score
      const productivityScore = Math.round(
        (completionScore * 0.40) +
        (delayScore * 0.20) +
        (attendanceRate * 0.20) +
        (projectParticipationScore * 0.20)
      );

      return {
        id: emp.id,
        name: `${emp.user.firstName} ${emp.user.lastName}`,
        department: emp.department?.name || 'Non assigné',
        departmentId: emp.departmentId,
        productivityScore,
        completedTasks,
        totalTasks,
        overdueTasks,
        attendanceRate: Math.round(attendanceRate),
        projectsCount: projectCount,
      };
    });

    const averageProductivityScore = employeeScores.length > 0
      ? Math.round(employeeScores.reduce((sum, e) => sum + e.productivityScore, 0) / employeeScores.length)
      : 85;

    // Get highest and lowest productive departments
    const deptMap: Record<string, { sum: number; count: number }> = {};
    employeeScores.forEach(e => {
      if (!deptMap[e.department]) {
        deptMap[e.department] = { sum: 0, count: 0 };
      }
      deptMap[e.department].sum += e.productivityScore;
      deptMap[e.department].count += 1;
    });

    let highestProductiveDept = '';
    let highestScore = -1;
    let lowestProductiveDept = '';
    let lowestScore = 101;

    Object.entries(deptMap).forEach(([name, data]) => {
      const avg = data.sum / data.count;
      if (avg > highestScore) {
        highestScore = avg;
        highestProductiveDept = name;
      }
      if (avg < lowestScore) {
        lowestScore = avg;
        lowestProductiveDept = name;
      }
    });

    return {
      type: 'PRODUCTIVITY',
      generatedAt: new Date(),
      summary: {
        averageProductivityScore,
        highestProductiveDept,
        lowestProductiveDept,
        totalEmployees: employees.length,
      },
      charts: {
        employeeScores: employeeScores.sort((a, b) => b.productivityScore - a.productivityScore).slice(0, 10),
      }
    };
  }

  // ─── CEO Comparison Analytics ─────────────────────────────────────────────────

  async getComparisonAnalytics() {
    const [departments, invoices] = await Promise.all([
      this.prisma.department.findMany({
        where: { isArchived: false },
        include: {
          employees: {
            include: {
              user: { select: { assignedTasks: { select: { status: true } } } },
            },
          },
          expenses: { where: { isApproved: true } },
        },
      }),
      this.prisma.invoice.findMany({
        where: { isArchived: false },
        include: {
          project: {
            include: {
              members: true,
            },
          },
        },
      }),
    ]);

    const comparison = departments.map(dept => {
      const totalExpenses = dept.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const activeCount = dept.employees.filter(emp => emp.status === 'ACTIVE').length;
      const avgPerformance = dept.employees.length > 0
        ? Math.round(dept.employees.reduce((sum, emp) => sum + emp.performanceScore, 0) / dept.employees.length)
        : 85;

      // Real task completion rate
      const allTasks = dept.employees.flatMap(emp => emp.user.assignedTasks);
      const totalTasks = allTasks.length;
      const doneTasks = allTasks.filter(t => t.status === 'DONE').length;
      const taskCompletionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

      // Calculate revenueContribution by summing the total of all invoices linked to projects that belong to the respective department.
      const deptUserIds = new Set(dept.employees.map(emp => emp.userId));
      const deptInvoices = invoices.filter(inv => {
        if (!inv.project) return false;
        return inv.project.members.some(member => deptUserIds.has(member.userId));
      });
      const revenueContribution = deptInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);

      return {
        id: dept.id,
        name: dept.name,
        employeeCount: dept.employees.length,
        activeEmployeeCount: activeCount,
        expenses: totalExpenses,
        averageProductivity: avgPerformance,
        taskCompletionRate,
        revenueContribution,
        budget: Number(dept.budget || 0),
        budgetUtilization: Number(dept.budget) > 0 ? Math.round((totalExpenses / Number(dept.budget)) * 100) : 0,
      };
    });

    return comparison;
  }

  // ─── CEO Summary ──────────────────────────────────────────────────────────────

  async getCeoSummary() {
    const [
      totalEmployees,
      activeProjects,
      totalInvoices,
      paidInvoicesResult,
      totalExpensesResult,
      pendingReports,
      pendingLeaves,
      recentReports,
    ] = await Promise.all([
      this.prisma.employeeProfile.count(),
      this.prisma.project.count({ where: { status: ProjectStatus.ACTIVE } }),
      this.prisma.invoice.aggregate({ _sum: { paidAmount: true }, _count: true }),
      this.prisma.invoice.count({ where: { status: InvoiceStatus.PAID } }),
      this.prisma.expense.aggregate({ _sum: { amount: true }, where: { isApproved: true } }),
      this.prisma.report.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.leaveRequest.count({ where: { status: LeaveStatus.PENDING } }),
      this.prisma.report.findMany({
        where: { status: 'PENDING_REVIEW' },
        include: {
          createdBy: { select: { firstName: true, lastName: true } },
          department: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const totalRevenue = Number(totalInvoices._sum.paidAmount ?? 0);
    const totalExpenses = Number(totalExpensesResult._sum.amount ?? 0);

    return {
      kpis: {
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        totalEmployees,
        activeProjects,
        totalInvoices: totalInvoices._count,
        paidInvoices: paidInvoicesResult,
        pendingReports,
        pendingLeaves,
      },
      recentPendingReports: recentReports,
    };
  }

  // ─── Report Schedules ─────────────────────────────────────────────────────────

  async createSchedule(reportId: string, dto: CreateReportScheduleDto, user: any) {
    await this.findOne(reportId, user);

    return this.prisma.reportSchedule.create({
      data: {
        reportId,
        cronExpr: dto.cronExpr,
        recipients: dto.recipients,
        isActive: dto.isActive ?? true,
      },
    });
  }
}
