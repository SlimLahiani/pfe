import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportInsightService {
  constructor(private readonly prisma: PrismaService) {}

  async generateInsights(reportId: string, type: string, summary: any) {
    const insights: { insightText: string; severity: string }[] = [];

    if (type === 'FINANCIAL') {
      const rev = Number(summary.totalRevenue || 0);
      const exp = Number(summary.totalExpenses || 0);
      const payroll = Number(summary.payrollCost || 0);
      const profit = Number(summary.netProfit || 0);
      const convRate = Number(summary.quoteConversionRate || 0);

      insights.push({
        insightText: `Chiffre d'affaires de ${rev.toLocaleString()} TND généré à partir des factures encaissées.`,
        severity: 'INFO',
      });

      if (exp + payroll > rev) {
        insights.push({
          insightText: `Alerte financière : Les dépenses cumulées (${(exp + payroll).toLocaleString()} TND) dépassent les revenus encaissés (${rev.toLocaleString()} TND).`,
          severity: 'HIGH',
        });
      }

      if (payroll > rev * 0.45) {
        insights.push({
          insightText: `Attention : La charge salariale (${payroll.toLocaleString()} TND) pèse lourdement sur la structure, représentant plus de 45% des revenus.`,
          severity: 'MEDIUM',
        });
      }

      if (convRate < 50) {
        insights.push({
          insightText: `Opportunité : Taux de conversion des devis de ${convRate}%. Une optimisation des processus de relance est conseillée.`,
          severity: 'MEDIUM',
        });
      }
    } else if (type === 'HR') {
      const activeCount = summary.activeEmployees || 0;
      const attRate = summary.attendanceRate || 0;
      const leaveRate = summary.leaveRate || 0;

      insights.push({
        insightText: `Maintien des effectifs à un total de ${activeCount} employés actifs.`,
        severity: 'INFO',
      });

      if (attRate < 92) {
        insights.push({
          insightText: `Alerte RH : Taux de présence faible de ${attRate}%. Risque d'impact sur le bon fonctionnement des projets.`,
          severity: 'HIGH',
        });
      }

      if (leaveRate > 10) {
        insights.push({
          insightText: `Le taux de demande de congé est de ${leaveRate}%, entraînant des contraintes d'effectif temporaires.`,
          severity: 'MEDIUM',
        });
      }
    } else if (type === 'PROJECT') {
      const delayed = summary.delayedProjects || 0;
      const completionRate = summary.taskCompletionRate || 0;

      insights.push({
        insightText: `Taux d'achèvement des tâches opérationnelles : ${completionRate}%.`,
        severity: 'INFO',
      });

      if (delayed > 0) {
        insights.push({
          insightText: `Alerte Projet : ${delayed} projet(s) en cours présente(nt) des tâches importantes en retard.`,
          severity: 'HIGH',
        });
      }

      if (completionRate < 70) {
        insights.push({
          insightText: `Le volume global de tâches finalisées (${completionRate}%) indique un goulot d'étranglement potentiel.`,
          severity: 'MEDIUM',
        });
      }
    } else if (type === 'PRODUCTIVITY') {
      const avgScore = summary.averageProductivityScore || 0;
      insights.push({
        insightText: `Productivité moyenne de l'agence évaluée à ${avgScore}/100.`,
        severity: 'INFO',
      });

      if (avgScore < 75) {
        insights.push({
          insightText: `Alerte Performance : La productivité globale (${avgScore}/100) est inférieure à la cible de 75%.`,
          severity: 'HIGH',
        });
      }

      if (summary.highestProductiveDept) {
        insights.push({
          insightText: `Le département "${summary.highestProductiveDept}" affiche le meilleur score de productivité.`,
          severity: 'INFO',
        });
      }

      if (summary.lowestProductiveDept) {
        insights.push({
          insightText: `Des marges de progression sont identifiées pour le département "${summary.lowestProductiveDept}" qui présente les scores les plus bas.`,
          severity: 'WARNING',
        });
      }
    }

    return insights;
  }
}
