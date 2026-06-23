import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  LeaveStatus,
  QuoteStatus,
  InvoiceStatus,
  TaskStatus,
  ProjectStatus,
  LeaveType,
} from '@prisma/client';

@Injectable()
export class IntelligenceService {
  private readonly logger = new Logger(IntelligenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Decision Center: Pending Leaves, Quotes, and Invoices with Intelligent Recommendations
   */
  async getDecisionCenter() {
    this.logger.log('Fetching Decision Center recommendations...');

    // A. Leave Requests
    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: { status: LeaveStatus.PENDING },
      include: {
        employee: {
          include: {
            user: true,
            department: true,
            leaveBalances: true,
          },
        },
      },
    });

    const enrichedLeaveRequests = await Promise.all(
      leaveRequests.map(async (request) => {
        const deptId = request.employee.departmentId;
        const startDate = request.startDate;
        const endDate = request.endDate;

        // Check for conflicts in the same department
        const conflicts = await this.prisma.leaveRequest.findMany({
          where: {
            status: LeaveStatus.APPROVED,
            employee: { departmentId: deptId },
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: startDate } },
            ],
          },
          include: {
            employee: {
              include: { user: true },
            },
          },
        });

        // Find relevant leave balance for this year
        const currentYear = new Date().getFullYear();
        const balance = request.employee.leaveBalances.find(
          (b) => b.leaveType === request.type && b.year === currentYear,
        );

        const availableDays = balance ? Number(balance.totalDays) - Number(balance.usedDays) : 30;
        const requestedDays = Number(request.days);

        let recommendation = 'APPROVE';
        let reason = 'Aucun conflit détecté et solde suffisant.';
        let warningLevel = 'success'; // 'success' | 'warning' | 'danger'

        if (requestedDays > availableDays) {
          recommendation = 'REJECT';
          reason = `Solde insuffisant : ${requestedDays} jours demandés contre ${availableDays} restants.`;
          warningLevel = 'danger';
        } else if (conflicts.length > 0) {
          const conflictingNames = conflicts.map(
            (c) => `${c.employee.user.firstName} ${c.employee.user.lastName}`,
          );
          recommendation = 'WARN';
          reason = `Conflit d'équipe : ${conflictingNames.join(', ')} est déjà en congé à cette période.`;
          warningLevel = 'warning';
        }

        return {
          id: request.id,
          employeeName: `${request.employee.user.firstName} ${request.employee.user.lastName}`,
          department: request.employee.department?.name || 'Aucun',
          leaveType: request.type,
          startDate,
          endDate,
          days: requestedDays,
          reason: request.reason || 'Aucun motif',
          currentBalance: availableDays,
          recommendation: {
            decision: recommendation,
            reason,
            warningLevel,
          },
        };
      }),
    );

    // B. Quotes Pending Approval
    const quotes = await this.prisma.quote.findMany({
      where: { status: QuoteStatus.PENDING_APPROVAL },
      include: {
        client: true,
        project: true,
        items: true,
      },
    });

    const enrichedQuotes = quotes.map((quote) => {
      const subtotal = Number(quote.subtotal);
      const items = quote.items;
      
      // Compute margins or discounts
      let totalDiscount = 0;
      let totalItemsCost = 0;
      items.forEach((item) => {
        totalDiscount += Number(item.discount || 0);
        // Estimate a base cost of resource delivery (e.g. 60% of original unit price if discount is low)
        const unitPrice = Number(item.unitPrice);
        const qty = Number(item.quantity);
        totalItemsCost += unitPrice * qty * 0.6;
      });

      const avgDiscount = items.length > 0 ? totalDiscount / items.length : 0;
      const estimatedMargin = subtotal > 0 ? ((subtotal - totalItemsCost) / subtotal) * 100 : 40;

      let decision = 'APPROVE';
      let reason = `Marge estimée saine à ${estimatedMargin.toFixed(1)}% (seuil requis > 30%).`;
      let warningLevel = 'success';

      if (avgDiscount > 15) {
        decision = 'WARN';
        reason = `Remise moyenne élevée (${avgDiscount.toFixed(1)}%). Revoir les conditions commerciales.`;
        warningLevel = 'warning';
      } else if (estimatedMargin < 25) {
        decision = 'REJECT';
        reason = `Marge critique estimée à ${estimatedMargin.toFixed(1)}%. Risque de non-rentabilité.`;
        warningLevel = 'danger';
      }

      return {
        id: quote.id,
        reference: quote.reference,
        clientName: quote.client.companyName,
        projectName: quote.project?.name || 'Sans projet',
        validUntil: quote.validUntil,
        total: Number(quote.total),
        avgDiscount,
        estimatedMargin,
        recommendation: {
          decision,
          reason,
          warningLevel,
        },
      };
    });

    // C. Invoices Pending Approval
    const invoices = await this.prisma.invoice.findMany({
      where: { status: InvoiceStatus.PENDING_APPROVAL },
      include: {
        client: {
          include: {
            invoices: true,
          },
        },
      },
    });

    const enrichedInvoices = invoices.map((invoice) => {
      const overdueInvoices = invoice.client.invoices.filter(
        (i) => i.status === InvoiceStatus.OVERDUE,
      );

      let decision = 'APPROVE';
      let reason = 'Client à jour de paiement. Aucun incident signalé.';
      let warningLevel = 'success';

      if (overdueInvoices.length > 0) {
        decision = 'WARN';
        reason = `Risque de recouvrement : ce client a déjà ${overdueInvoices.length} facture(s) impayée(s).`;
        warningLevel = 'warning';
      }

      return {
        id: invoice.id,
        reference: invoice.reference,
        clientName: invoice.client.companyName,
        dueDate: invoice.dueDate,
        total: Number(invoice.total),
        overdueCount: overdueInvoices.length,
        recommendation: {
          decision,
          reason,
          warningLevel,
        },
      };
    });

    return {
      leaveRequests: enrichedLeaveRequests,
      quotes: enrichedQuotes,
      invoices: enrichedInvoices,
    };
  }

  /**
   * 2. Financial Health Dashboard: Monthly Metrics, KPI Alerts, Trend Chart Data
   */
  async getFinancialHealth() {
    this.logger.log('Calculating Financial Health metrics...');

    // Fetch payments and expenses
    const payments = await this.prisma.payment.findMany({});
    const expenses = await this.prisma.expense.findMany({
      where: { isApproved: true },
    });
    const invoices = await this.prisma.invoice.findMany({});

    // Group by month
    const monthlyData: { [key: string]: { revenue: number; expenses: number } } = {};

    payments.forEach((p) => {
      const date = new Date(p.paidAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { revenue: 0, expenses: 0 };
      monthlyData[monthKey].revenue += Number(p.amount);
    });

    expenses.forEach((e) => {
      const date = new Date(e.expenseDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { revenue: 0, expenses: 0 };
      monthlyData[monthKey].expenses += Number(e.amount);
    });

    // Ensure we have at least some recent months filled for the UI
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, expenses: 0 };
      }
    }

    // Convert to array and sort
    const trends = Object.entries(monthlyData)
      .map(([month, data]) => {
        const netProfit = data.revenue - data.expenses;
        const profitMargin = data.revenue > 0 ? (netProfit / data.revenue) * 100 : 0;
        return {
          month, // e.g. "2026-06"
          revenue: data.revenue,
          expenses: data.expenses,
          netProfit,
          profitMargin,
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    // Calculate current month vs previous month
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    const currentRevenue = monthlyData[currentMonthKey]?.revenue || 0;
    const currentExpenses = monthlyData[currentMonthKey]?.expenses || 0;
    const currentProfit = currentRevenue - currentExpenses;

    const prevRevenue = monthlyData[prevMonthKey]?.revenue || 0;
    const prevExpenses = monthlyData[prevMonthKey]?.expenses || 0;
    const prevProfit = prevRevenue - prevExpenses;

    // Calculate growth percentages
    const revenueGrowth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const profitMargin = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;

    // Unpaid Invoices Amount
    const unpaidInvoices = invoices.filter(
      (inv) => inv.status === InvoiceStatus.SENT || inv.status === InvoiceStatus.OVERDUE,
    );
    const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total) - Number(inv.paidAmount || 0), 0);
    const overdueInvoices = invoices.filter((inv) => inv.status === InvoiceStatus.OVERDUE);
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.total) - Number(inv.paidAmount || 0), 0);

    // Dynamic Alerts logic
    const alerts = [];
    if (profitMargin < 15 && currentRevenue > 0) {
      alerts.push({
        id: 'low_margin',
        title: 'Marge bénéficiaire faible',
        description: `Marge de ${profitMargin.toFixed(1)}% ce mois-ci, en dessous du seuil cible de 15%.`,
        type: 'warning',
      });
    }

    if (overdueAmount > 10000) {
      alerts.push({
        id: 'high_overdue',
        title: 'Retards de paiement importants',
        description: `Le montant total des factures en retard est de ${overdueAmount.toLocaleString()} TND.`,
        type: 'danger',
      });
    }

    const totalExpensesThisYear = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    // Alert if expenses are higher than 80% of revenue
    const totalRevenueThisYear = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    if (totalExpensesThisYear > totalRevenueThisYear * 0.8 && totalRevenueThisYear > 0) {
      alerts.push({
        id: 'high_expense_ratio',
        title: 'Ratio de dépenses élevé',
        description: `Les dépenses représentent ${(
          (totalExpensesThisYear / totalRevenueThisYear) *
          100
        ).toFixed(1)}% des revenus cette année.`,
        type: 'warning',
      });
    }

    return {
      kpis: {
        revenue: currentRevenue,
        revenueGrowth,
        expenses: currentExpenses,
        netProfit: currentProfit,
        profitMargin,
        unpaidAmount,
        overdueAmount,
      },
      alerts,
      trends,
    };
  }

  /**
   * 3. Project Risk Detection: Milestones delayed, overdue tasks, over budget issues
   */
  async getProjectRisks() {
    this.logger.log('Detecting Project Risks and budget alerts...');

    const projects = await this.prisma.project.findMany({
      where: { status: ProjectStatus.ACTIVE },
      include: {
        client: true,
        milestones: true,
        tasks: true,
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    const now = new Date();
    const risks = projects.map((project) => {
      const overdueTasks = project.tasks.filter(
        (t) => t.status !== TaskStatus.DONE && t.status !== TaskStatus.CANCELLED && t.dueDate && new Date(t.dueDate) < now,
      );

      const missedMilestones = project.milestones.filter(
        (m) => m.status !== 'COMPLETED' && new Date(m.dueDate) < now,
      );

      // Simple budget check
      const totalBudget = Number(project.budget || 0);
      
      // Sum estimated actual labor hours or other expenses
      const taskActualHours = project.tasks.reduce((sum, t) => sum + Number(t.actualHours || 0), 0);
      const taskEstimatedHours = project.tasks.reduce((sum, t) => sum + Number(t.estimatedHours || 0), 0);

      // Estimate labor cost at 50 TND / hour
      const estimatedCost = taskActualHours * 50;
      const budgetExceeded = estimatedCost > totalBudget;

      const riskFactors = [];
      if (overdueTasks.length > 0) riskFactors.push(`${overdueTasks.length} tâches en retard`);
      if (missedMilestones.length > 0) riskFactors.push(`${missedMilestones.length} jalons dépassés`);
      if (budgetExceeded) riskFactors.push(`Budget de main d'œuvre estimé dépassé (${estimatedCost} TND / ${totalBudget} TND)`);

      let riskLevel = 'LOW';
      let advice = 'Le projet progresse comme prévu.';
      let badgeColor = 'success';

      if (riskFactors.length >= 2 || missedMilestones.length > 0) {
        riskLevel = 'HIGH';
        advice = `Réallouer les ressources. Contacter le chef de projet ${
          project.members.find((m) => m.role === 'MANAGER')?.user.firstName || ''
        } pour réviser le calendrier ou réassigner les ${overdueTasks.length} tâches en souffrance.`;
        badgeColor = 'danger';
      } else if (riskFactors.length === 1) {
        riskLevel = 'MEDIUM';
        advice = `Surveiller la tâche en retard. S'assurer que le développeur assigné a le soutien requis.`;
        badgeColor = 'warning';
      }

      return {
        id: project.id,
        name: project.name,
        clientName: project.client?.companyName || 'Sans client',
        budget: totalBudget,
        riskLevel,
        badgeColor,
        riskFactors,
        advice,
        overdueTasksCount: overdueTasks.length,
        missedMilestonesCount: missedMilestones.length,
        taskActualHours,
        taskEstimatedHours,
      };
    });

    return risks;
  }

  /**
   * 4. Employee Performance & Productivity Scores
   */
  async getEmployeeAnalytics() {
    this.logger.log('Calculating employee analytics and workload ratings...');

    const employees = await this.prisma.employeeProfile.findMany({
      include: {
        user: {
          include: {
            assignedTasks: true,
          },
        },
        department: true,
      },
    });

    const now = new Date();
    const rankings = employees.map((emp) => {
      const tasks = emp.user.assignedTasks;
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === TaskStatus.DONE).length;
      const activeTasks = tasks.filter(
        (t) => t.status !== TaskStatus.DONE && t.status !== TaskStatus.CANCELLED,
      ).length;
      const overdueTasks = tasks.filter(
        (t) => t.status !== TaskStatus.DONE && t.status !== TaskStatus.CANCELLED && t.dueDate && new Date(t.dueDate) < now,
      ).length;

      // Productivity Rating Algorithm
      // Base is 70, +completed*5, -overdue*15, -active*2
      let score = 70;
      if (completedTasks > 0) score += completedTasks * 5;
      if (overdueTasks > 0) score -= overdueTasks * 15;
      if (activeTasks > 2) score -= (activeTasks - 2) * 3;

      // Cap between 10 and 100
      const productivityScore = Math.max(10, Math.min(100, score));

      return {
        id: emp.id,
        name: `${emp.user.firstName} ${emp.user.lastName}`,
        email: emp.user.email,
        jobTitle: emp.jobTitle || 'Collaborateur',
        department: emp.department?.name || 'Aucun',
        activeTasksCount: activeTasks,
        completedTasksCount: completedTasks,
        overdueTasksCount: overdueTasks,
        productivityScore,
      };
    });

    // Sort by productivity score descending
    return rankings.sort((a, b) => b.productivityScore - a.productivityScore);
  }

  /**
   * 5. Smart Task Assignment Recommendation
   * Finds the best matching employees for a given project or department based on workload.
   */
  async getSmartAssignmentSuggestions(projectId?: string) {
    this.logger.log(`Fetching task assignment suggestions for project: ${projectId || 'All'}`);

    const employees = await this.prisma.employeeProfile.findMany({
      include: {
        user: {
          include: {
            assignedTasks: {
              where: {
                status: {
                  notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
                },
              },
            },
          },
        },
        department: true,
      },
    });

    let targetDepartmentName = '';
    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          client: true,
        },
      });
      // Deduce category or department
      if (project?.name.toLowerCase().includes('design') || project?.name.toLowerCase().includes('branding')) {
        targetDepartmentName = 'Creative & Design';
      } else if (project?.name.toLowerCase().includes('app') || project?.name.toLowerCase().includes('dashboard') || project?.name.toLowerCase().includes('software')) {
        targetDepartmentName = 'Engineering & Development';
      }
    }

    const suggestions = employees.map((emp) => {
      const activeTasksCount = emp.user.assignedTasks.length;
      const isDeptMatch = emp.department?.name === targetDepartmentName;

      // Smart score: lower workload = higher score, dept match = big boost
      let score = 100 - activeTasksCount * 10;
      if (isDeptMatch) score += 30;

      // Cap score
      score = Math.max(10, Math.min(100, score));

      let recommendationLabel = 'Recommandé';
      let priorityOrder = 2; // Lower is better
      if (activeTasksCount >= 4) {
        recommendationLabel = 'Surchargé';
        priorityOrder = 3;
      } else if (score > 85) {
        recommendationLabel = 'Idéal';
        priorityOrder = 1;
      }

      return {
        userId: emp.user.id,
        name: `${emp.user.firstName} ${emp.user.lastName}`,
        email: emp.user.email,
        jobTitle: emp.jobTitle,
        department: emp.department?.name || 'Aucun',
        activeTasksCount,
        score,
        recommendationLabel,
        priorityOrder,
      };
    });

    // Sort by priority order, then score descending
    return suggestions.sort((a, b) => {
      if (a.priorityOrder !== b.priorityOrder) {
        return a.priorityOrder - b.priorityOrder;
      }
      return b.score - a.score;
    });
  }

  /**
   * 6. Client & Lead Scoring
   */
  async getClientAndLeadScores() {
    this.logger.log('Evaluating Lead and Client health scores...');

    // A. Clients Health Evaluation
    const clients = await this.prisma.client.findMany({
      include: {
        invoices: true,
        projects: true,
      },
    });

    const clientScores = clients.map((client) => {
      const totalInvoices = client.invoices.length;
      const overdueInvoices = client.invoices.filter((i) => i.status === InvoiceStatus.OVERDUE);
      const paidInvoices = client.invoices.filter((i) => i.status === InvoiceStatus.PAID);

      const activeProjects = client.projects.filter(
        (p) => p.status === ProjectStatus.ACTIVE,
      ).length;

      // Base Client score = 80
      // Deduct for unpaid/overdue invoices
      // Add bonus for active projects and high paid invoices
      let score = 80;
      if (overdueInvoices.length > 0) score -= overdueInvoices.length * 15;
      if (paidInvoices.length > 0) score += Math.min(20, paidInvoices.length * 4);
      if (activeProjects > 0) score += 5;

      const healthScore = Math.max(10, Math.min(100, score));
      
      let status = 'Sain';
      let statusColor = 'success';
      if (healthScore < 50) {
        status = 'À Risque';
        statusColor = 'danger';
      } else if (healthScore < 75) {
        status = 'Moyen';
        statusColor = 'warning';
      }

      return {
        id: client.id,
        companyName: client.companyName,
        industry: client.industry || 'Non spécifiée',
        activeProjects,
        totalInvoices,
        overdueCount: overdueInvoices.length,
        healthScore,
        status,
        statusColor,
      };
    });

    // B. Leads Evaluation based on budget, company size, and status
    const leads = await this.prisma.lead.findMany({});
    const leadScores = leads.map((lead) => {
      const companySize = lead.companySize || 10;
      const estValue = Number(lead.estimatedValue || 0);

      // Lead Scoring Algorithm
      // 1. Company Size (Max 35 points) -> size >= 100 gets 35, otherwise size/100 * 35
      const sizeScore = companySize >= 100 ? 35 : (companySize / 100) * 35;
      // 2. Budget / Value (Max 40 points) -> value >= 100,000 gets 40, otherwise value/100000 * 40
      const valueScore = estValue >= 100000 ? 40 : (estValue / 100000) * 40;
      // 3. Status Weight (Max 25 points)
      let statusWeight = 5;
      if (lead.status === 'WON') statusWeight = 25;
      else if (lead.status === 'NEGOTIATION') statusWeight = 20;
      else if (lead.status === 'PROPOSAL_SENT') statusWeight = 15;
      else if (lead.status === 'QUALIFIED') statusWeight = 10;

      const score = Math.round(sizeScore + valueScore + statusWeight);
      const leadScore = Math.max(5, Math.min(100, score));

      let priority = 'Basse';
      let priorityColor = 'success';
      if (leadScore > 75) {
        priority = 'Haute (Hot Lead)';
        priorityColor = 'danger';
      } else if (leadScore > 45) {
        priority = 'Moyenne';
        priorityColor = 'warning';
      }

      return {
        id: lead.id,
        companyName: lead.companyName,
        contactName: lead.contactName,
        estimatedValue: estValue,
        companySize,
        status: lead.status,
        leadScore,
        priority,
        priorityColor,
      };
    });

    return {
      clients: clientScores.sort((a, b) => a.healthScore - b.healthScore), // Worst health first to highlight danger
      leads: leadScores.sort((a, b) => b.leadScore - a.leadScore), // Best leads first
    };
  }

  /**
   * 7. Executive Dashboard Overview
   * Combines aggregates for a quick high level management summary
   */
  async getExecutiveSummary() {
    this.logger.log('Compiling Executive Summary...');

    const finance = await this.getFinancialHealth();
    const projects = await this.getProjectRisks();
    const employees = await this.getEmployeeAnalytics();
    const partners = await this.getClientAndLeadScores();
    const decisions = await this.getDecisionCenter();

    // Sum details
    const totalActiveProjects = projects.length;
    const highRiskProjectsCount = projects.filter((p) => p.riskLevel === 'HIGH').length;
    const pendingDecisionsCount =
      decisions.leaveRequests.length + decisions.quotes.length + decisions.invoices.length;

    // Get top leads (Hot leads)
    const hotLeads = partners.leads.filter((l) => l.leadScore > 75).slice(0, 3);

    return {
      financials: finance.kpis,
      alerts: finance.alerts,
      activeProjectsCount: totalActiveProjects,
      highRiskProjectsCount,
      pendingDecisionsCount,
      topPerformers: employees.slice(0, 3),
      hotLeads,
    };
  }
}
