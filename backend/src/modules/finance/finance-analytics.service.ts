import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceStatus } from '@prisma/client';

@Injectable()
export class FinanceAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFinancialKPIs() {
    const invoices = await this.prisma.invoice.findMany({
      include: {
        payments: true,
        client: true,
      },
    });

    const emailLogs = await this.prisma.invoiceEmailLog.findMany();

    const totalSentCount = invoices.filter((i) => i.status !== 'DRAFT').length;
    const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.total), 0);
    const totalCollected = invoices.reduce((sum, i) => sum + Number(i.paidAmount), 0);
    const totalUnpaid = totalInvoiced - totalCollected;

    // Email rates
    const totalEmailsSent = emailLogs.length;
    const totalOpened = emailLogs.filter((l) => l.openedAt !== null).length;
    const totalClicked = emailLogs.filter((l) => l.clickedAt !== null).length;

    const openRate = totalEmailsSent > 0 ? (totalOpened / totalEmailsSent) * 100 : 0;
    const clickRate = totalEmailsSent > 0 ? (totalClicked / totalEmailsSent) * 100 : 0;

    // Average payment delay
    let paymentDelaySum = 0;
    let paymentCount = 0;

    for (const invoice of invoices) {
      for (const payment of invoice.payments) {
        const issueDate = new Date(invoice.issueDate);
        const paidDate = new Date(payment.paidAt);
        const diffTime = Math.abs(paidDate.getTime() - issueDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        paymentDelaySum += diffDays;
        paymentCount++;
      }
    }

    const avgPaymentDelay = paymentCount > 0 ? Math.round(paymentDelaySum / paymentCount) : 15; // default 15 days fallback

    // Most profitable clients
    const clientProfitMap = new Map<string, { name: string; total: number }>();
    const clientOverdueMap = new Map<string, { name: string; total: number }>();

    for (const invoice of invoices) {
      const clientId = invoice.clientId;
      const clientName = invoice.client.companyName;

      // Profitable calculation
      const currentProfit = clientProfitMap.get(clientId) || { name: clientName, total: 0 };
      currentProfit.total += Number(invoice.total);
      clientProfitMap.set(clientId, currentProfit);

      // Overdue calculation
      if (invoice.status === InvoiceStatus.OVERDUE || (invoice.status === InvoiceStatus.PARTIALLY_PAID && new Date(invoice.dueDate) < new Date())) {
        const currentOverdue = clientOverdueMap.get(clientId) || { name: clientName, total: 0 };
        currentOverdue.total += Number(invoice.total) - Number(invoice.paidAmount);
        clientOverdueMap.set(clientId, currentOverdue);
      }
    }

    const topClients = Array.from(clientProfitMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const worstOverdueClients = Array.from(clientOverdueMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return {
      kpis: {
        totalSentCount,
        totalInvoiced,
        totalCollected,
        totalUnpaid,
        openRate,
        clickRate,
        avgPaymentDelay,
      },
      topClients,
      worstOverdueClients,
    };
  }

  async getCashFlowTrends() {
    const payments = await this.prisma.payment.findMany({
      orderBy: { paidAt: 'asc' },
    });

    const expenses = await this.prisma.expense.findMany({
      where: { isApproved: true },
      orderBy: { expenseDate: 'asc' },
    });

    // Group by month
    const monthlyData: Record<string, { revenue: number; expenses: number; cashflow: number }> = {};

    for (const p of payments) {
      const date = new Date(p.paidAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, expenses: 0, cashflow: 0 };
      }
      monthlyData[monthKey].revenue += Number(p.amount);
    }

    for (const e of expenses) {
      const date = new Date(e.expenseDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, expenses: 0, cashflow: 0 };
      }
      monthlyData[monthKey].expenses += Number(e.amount);
    }

    const labels = Object.keys(monthlyData).sort();
    const datasets = labels.map((l) => {
      const item = monthlyData[l];
      return {
        month: l,
        revenue: item.revenue,
        expenses: item.expenses,
        cashflow: item.revenue - item.expenses,
      };
    });

    return datasets;
  }

  async getAiFinanceInsights() {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
      include: {
        client: true,
      },
    });

    const now = new Date();
    const insights: any[] = [];
    const alerts: any[] = [];
    const suggestions: any[] = [];

    let totalOverdue = 0;
    const riskClients = new Set<string>();

    for (const invoice of invoices) {
      const dueDate = new Date(invoice.dueDate);
      const diffTime = now.getTime() - dueDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        totalOverdue += Number(invoice.total) - Number(invoice.paidAmount);
        riskClients.add(invoice.client.companyName);

        if (diffDays > 15) {
          alerts.push({
            type: 'HIGH_RISK',
            message: `Risque critique : Facture ${invoice.reference} de ${invoice.client.companyName} en retard de ${diffDays} jours (${Number(invoice.total).toFixed(3)} TND)`,
          });

          suggestions.push({
            action: 'MANUAL_REMINDER',
            invoiceId: invoice.id,
            clientName: invoice.client.companyName,
            reference: invoice.reference,
            message: `Lancer une relance téléphonique directe pour la facture ${invoice.reference}.`,
          });
        } else {
          alerts.push({
            type: 'WARNING',
            message: `Retard de paiement : Facture ${invoice.reference} de ${invoice.client.companyName} en retard de ${diffDays} jours`,
          });

          suggestions.push({
            action: 'AUTO_REMINDER',
            invoiceId: invoice.id,
            clientName: invoice.client.companyName,
            reference: invoice.reference,
            message: `Envoyer une relance par e-mail automatique de J+7 pour la facture ${invoice.reference}.`,
          });
        }
      }
    }

    // Cash flow forecast
    const monthlyCashflow = await this.getCashFlowTrends();
    let forecastCash = 0;
    if (monthlyCashflow.length > 0) {
      const lastMonth = monthlyCashflow[monthlyCashflow.length - 1];
      // Forecast next month cash flow by averaging last 3 months
      const last3Months = monthlyCashflow.slice(-3);
      const avgCashflow = last3Months.reduce((sum, item) => sum + item.cashflow, 0) / Math.max(1, last3Months.length);
      forecastCash = avgCashflow;
    }

    insights.push({
      topic: 'Trésorerie Prévisionnelle',
      value: `${forecastCash.toFixed(3)} TND`,
      description: 'Estimation du flux net de trésorerie pour le mois prochain basé sur la tendance des 3 derniers mois.',
    });

    insights.push({
      topic: 'Facturation en Souffrance',
      value: `${totalOverdue.toFixed(3)} TND`,
      description: `Actuellement en attente de recouvrement sur ${riskClients.size} client(s) à risque.`,
    });

    return {
      insights,
      alerts,
      suggestions,
      summary: {
        totalOverdue,
        riskClientsCount: riskClients.size,
        forecastNextMonthCashflow: forecastCash,
      },
    };
  }
}
