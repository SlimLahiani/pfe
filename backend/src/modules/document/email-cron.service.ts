import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailAutomationService } from './email-automation.service';
import { InvoiceStatus } from '@prisma/client';

@Injectable()
export class EmailCronService implements OnModuleInit {
  private intervalId: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailAutomationService: EmailAutomationService,
  ) {}

  onModuleInit() {
    console.log('⏰ Invoice Email Cron & Automation Service Initialized.');
    // Run the checker on startup after 10 seconds, then every 1 hour
    setTimeout(() => this.runCronChecks(), 10000);
    this.intervalId = setInterval(() => this.runCronChecks(), 3600000);
  }

  async runCronChecks() {
    console.log('⏰ Running automatic invoice checks and reminders...');
    try {
      await this.updateOverdueInvoices();
      await this.sendAutomaticReminders();
    } catch (err) {
      console.error('Error running automatic invoice checks:', err);
    }
  }

  private async updateOverdueInvoices() {
    const now = new Date();
    const result = await this.prisma.invoice.updateMany({
      where: {
        dueDate: { lt: now },
        status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.APPROVED, InvoiceStatus.PARTIALLY_PAID] },
      },
      data: {
        status: InvoiceStatus.OVERDUE,
      },
    });

    if (result.count > 0) {
      console.log(`✅ Marked ${result.count} invoices as OVERDUE.`);
    }
  }

  private async sendAutomaticReminders() {
    const settings = await this.prisma.emailSettings.findFirst();
    if (settings && !settings.autoReminderEnabled) {
      console.log('ℹ️ Automatic reminders are disabled in settings.');
      return;
    }

    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID] },
      },
      include: {
        client: true,
      },
    });

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const invoice of invoices) {
      const dueDate = new Date(invoice.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = now.getTime() - dueDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); // negative before due date, positive after

      // Reminder intervals: -7, -3, -1, 0, 3, 7, 15, 30
      const targetIntervals = [-7, -3, -1, 0, 3, 7, 15, 30];

      if (targetIntervals.includes(diffDays)) {
        // Check if we already sent a reminder today to avoid duplicates
        const startOfToday = new Date(now);
        const alreadySent = await this.prisma.invoiceEmailLog.findFirst({
          where: {
            invoiceId: invoice.id,
            createdAt: { gte: startOfToday },
            subject: { contains: 'Relance' },
          },
        });

        if (alreadySent) {
          continue;
        }

        const typeLabel = diffDays < 0 ? 'Rappel' : diffDays === 0 ? 'Jour J' : 'Retard';
        console.log(`✉️ Sending auto-reminder (${typeLabel}) for invoice ${invoice.reference} (diff days: ${diffDays})`);

        const subject = `[Relance] Facture ${invoice.reference} - Échéance le ${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}`;
        const body = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #ef4444; text-align: center;">CREATIVART - Rappel de Paiement</h2>
            <p>Bonjour <strong>${invoice.client.companyName}</strong>,</p>
            <p>Sauf erreur ou omission de notre part, nous n'avons pas reçu le règlement de la facture <strong>${invoice.reference}</strong> d'un montant de <strong>${Number(invoice.total).toFixed(3)} ${invoice.currency}</strong>.</p>
            <p>Cette facture ${diffDays < 0 ? `arrive à échéance dans ${Math.abs(diffDays)} jours` : diffDays === 0 ? `est due aujourd'hui` : `a un retard de ${diffDays} jours`}.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #cbd5e1; font-weight: bold;">Facture N°</td>
                <td style="padding: 8px; border-bottom: 1px solid #cbd5e1;">${invoice.reference}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #cbd5e1; font-weight: bold;">Date d'échéance</td>
                <td style="padding: 8px; border-bottom: 1px solid #cbd5e1; color: #ef4444; font-weight: bold;">${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #cbd5e1; font-weight: bold;">Montant Restant</td>
                <td style="padding: 8px; border-bottom: 1px solid #cbd5e1; font-weight: bold; color: #4f46e5;">${(Number(invoice.total) - Number(invoice.paidAmount)).toFixed(3)} ${invoice.currency}</td>
              </tr>
            </table>
            <p style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:5173/finance/invoices?detail=${invoice.id}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Consulter & Régler la Facture</a>
            </p>
            <p>Si vous avez déjà procédé au règlement de cette facture, merci de ne pas tenir compte de cette relance.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
            <p style="font-size: 11px; color: #64748b; text-align: center;">
              CREATIVART S.A.R.L. Les Berges du Lac 2, Tunis, 1053, Tunisie
            </p>
          </div>
        `;

        await this.emailAutomationService.sendInvoiceEmail(invoice.id, subject, body);
      }
    }
  }
}
