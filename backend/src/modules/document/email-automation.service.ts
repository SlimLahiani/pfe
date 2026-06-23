import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailAutomationService {
  constructor(private readonly prisma: PrismaService) {}

  private async getTransporter(settings: any) {
    // Falls back to a mock/console transporter if credentials are not configured or invalid
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return null;
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendInvoiceEmail(invoiceId: string, customSubject?: string, customBody?: string): Promise<any> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true, createdBy: true },
    });

    if (!invoice) {
      throw new Error(`Invoice with ID "${invoiceId}" not found`);
    }

    const settings: any = await this.prisma.emailSettings.findFirst() || {
      senderName: 'CREATIVART Billing',
      senderEmail: 'billing@creativart.tn',
      trackingEnabled: true,
    };

    const clientEmail = invoice.client.website || `${invoice.client.companyName.toLowerCase().replace(/\s+/g, '')}@example.com`;
    const recipientEmail = clientEmail; // Fallback or direct email of client contact
    const recipientName = invoice.client.companyName;

    // Create log in PENDING status
    const log = await this.prisma.invoiceEmailLog.create({
      data: {
        invoiceId,
        clientId: invoice.clientId,
        recipientName,
        recipientEmail,
        subject: customSubject || `Facture ${invoice.reference} - CREATIVART`,
        message: customBody || '',
      },
    });

    // Compile templates
    const subject = customSubject || `Facture ${invoice.reference} - CREATIVART`;
    let body = customBody || this.getDefaultInvoiceTemplate();

    // Substitute variables
    body = this.replaceAllVariables(body, {
      clientName: recipientName,
      invoiceNumber: invoice.reference,
      invoiceDate: new Date(invoice.issueDate).toLocaleDateString('fr-FR'),
      dueDate: new Date(invoice.dueDate).toLocaleDateString('fr-FR'),
      amount: `${Number(invoice.total).toFixed(3)} ${invoice.currency}`,
      companyName: 'CREATIVART',
      paymentLink: `http://localhost:5173/finance/invoices?detail=${invoice.id}`,
      pdfLink: `http://localhost:3000/api/v1/finance/invoices/${invoice.id}/download`,
    });

    // Tracking injection
    if (settings.trackingEnabled) {
      // Open pixel
      const trackingPixel = `<img src="http://localhost:3000/api/v1/emails/track/open/${log.id}" width="1" height="1" style="display:none;"/>`;
      body += trackingPixel;

      // Wrap links
      body = body.replace(/href="([^"]*)"/g, (match, url) => {
        if (url.startsWith('http')) {
          return `href="http://localhost:3000/api/v1/emails/track/click/${log.id}?dest=${encodeURIComponent(url)}"`;
        }
        return match;
      });
    }

    const transporter = await this.getTransporter(settings);
    let status = 'SENT';
    let errorMessage: string | null = null;

    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"${settings.senderName}" <${settings.senderEmail}>`,
          to: recipientEmail,
          replyTo: settings.replyTo || undefined,
          subject,
          html: body,
        });
      } catch (err: any) {
        status = 'FAILED';
        errorMessage = err.message;
        console.error('Mail sending error:', err);
      }
    } else {
      console.log(`[CONSOLE MAIL LOGGER] - Email Settings or SMTP parameters are not set. Logging email content instead:`);
      console.log(`Subject: ${subject}`);
      console.log(`Recipient: ${recipientEmail}`);
      console.log(`Body excerpt: ${body.substring(0, 300)}...`);
    }

    // Update log
    const updatedLog = await this.prisma.invoiceEmailLog.update({
      where: { id: log.id },
      data: {
        status: status as any,
        errorMessage,
        sentAt: status === 'SENT' ? new Date() : null,
      },
    });

    return updatedLog;
  }

  async sendQuoteEmail(quoteId: string, customSubject?: string, customBody?: string): Promise<any> {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { client: true, createdBy: true, invoice: true },
    });

    if (!quote) {
      throw new Error(`Quote with ID "${quoteId}" not found`);
    }

    const settings: any = await this.prisma.emailSettings.findFirst() || {
      senderName: 'CREATIVART Billing',
      senderEmail: 'billing@creativart.tn',
      trackingEnabled: true,
    };

    const recipientEmail = `${quote.client.companyName.toLowerCase().replace(/\s+/g, '')}@example.com`;
    const recipientName = quote.client.companyName;

    // We can log Quote emails in InvoiceEmailLog as well by mapping them (since it shares Client relationship)
    // Wait, the InvoiceEmailLog schema requires invoiceId.
    // If a Quote needs email tracking, we can create a temporary or dummy/real invoice log, or associate it.
    // But since the model requires invoiceId, we will create a dummy or skip quote log tracking or link to a draft invoice if exists.
    // Let's check if the quote has an invoice.
    let invoiceIdForLog = quote.invoice?.id;
    if (!invoiceIdForLog) {
      // Find or create dummy invoice if needed, or simply associate with quote's generated invoice
      const invoice = await this.prisma.invoice.findFirst({ where: { quoteId } });
      if (invoice) {
        invoiceIdForLog = invoice.id;
      }
    }

    let log: any = null;
    if (invoiceIdForLog) {
      log = await this.prisma.invoiceEmailLog.create({
        data: {
          invoiceId: invoiceIdForLog,
          clientId: quote.clientId,
          recipientName,
          recipientEmail,
          subject: customSubject || `Devis ${quote.reference} - CREATIVART`,
          message: customBody || '',
        },
      });
    }

    const subject = customSubject || `Devis ${quote.reference} - CREATIVART`;
    let body = customBody || this.getDefaultQuoteTemplate();

    body = this.replaceAllVariables(body, {
      clientName: recipientName,
      invoiceNumber: quote.reference,
      invoiceDate: new Date(quote.issueDate).toLocaleDateString('fr-FR'),
      dueDate: new Date(quote.validUntil).toLocaleDateString('fr-FR'),
      amount: `${Number(quote.total).toFixed(3)} ${quote.currency}`,
      companyName: 'CREATIVART',
      paymentLink: `http://localhost:5173/finance/quotes?detail=${quote.id}`,
      pdfLink: `http://localhost:3000/api/v1/finance/quotes/${quote.id}/pdf`,
    });

    if (settings.trackingEnabled && log) {
      const trackingPixel = `<img src="http://localhost:3000/api/v1/emails/track/open/${log.id}" width="1" height="1" style="display:none;"/>`;
      body += trackingPixel;

      body = body.replace(/href="([^"]*)"/g, (match, url) => {
        if (url.startsWith('http')) {
          return `href="http://localhost:3000/api/v1/emails/track/click/${log.id}?dest=${encodeURIComponent(url)}"`;
        }
        return match;
      });
    }

    const transporter = await this.getTransporter(settings);
    let status = 'SENT';
    let errorMessage: string | null = null;

    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"${settings.senderName}" <${settings.senderEmail}>`,
          to: recipientEmail,
          subject,
          html: body,
        });
      } catch (err: any) {
        status = 'FAILED';
        errorMessage = err.message;
      }
    }

    if (log) {
      await this.prisma.invoiceEmailLog.update({
        where: { id: log.id },
        data: {
          status: status as any,
          errorMessage,
          sentAt: status === 'SENT' ? new Date() : null,
        },
      });
    }

    return { status, errorMessage };
  }

  private replaceAllVariables(template: string, vars: Record<string, string>): string {
    let output = template;
    for (const [key, value] of Object.entries(vars)) {
      output = output.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return output;
  }

  private getDefaultInvoiceTemplate(): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e1b4b; text-align: center;">CREATIVART - Facture Professionnelle</h2>
        <p>Bonjour <strong>{{clientName}}</strong>,</p>
        <p>Nous vous remercions pour votre confiance. Vous trouverez ci-joint la facture <strong>{{invoiceNumber}}</strong> d'un montant de <strong>{{amount}}</strong>.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #cbd5e1; font-weight: bold;">Référence</td>
            <td style="padding: 8px; border-bottom: 1px solid #cbd5e1;">{{invoiceNumber}}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #cbd5e1; font-weight: bold;">Date d'émission</td>
            <td style="padding: 8px; border-bottom: 1px solid #cbd5e1;">{{invoiceDate}}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #cbd5e1; font-weight: bold;">Échéance</td>
            <td style="padding: 8px; border-bottom: 1px solid #cbd5e1; color: #ef4444; font-weight: bold;">{{dueDate}}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #cbd5e1; font-weight: bold;">Total à payer</td>
            <td style="padding: 8px; border-bottom: 1px solid #cbd5e1; font-weight: bold; color: #4f46e5;">{{amount}}</td>
          </tr>
        </table>
        <p style="text-align: center; margin: 30px 0;">
          <a href="{{paymentLink}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Consulter / Payer en Ligne</a>
        </p>
        <p>Vous pouvez également télécharger directement le PDF en <a href="{{pdfLink}}">cliquant ici</a>.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="font-size: 11px; color: #64748b; text-align: center;">
          CREATIVART S.A.R.L. Les Berges du Lac 2, Tunis, 1053, Tunisie
        </p>
      </div>
    `;
  }

  private getDefaultQuoteTemplate(): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e1b4b; text-align: center;">CREATIVART - Proposition Commerciale</h2>
        <p>Bonjour <strong>{{clientName}}</strong>,</p>
        <p>Suite à nos échanges, nous avons le plaisir de vous soumettre notre devis commercial <strong>{{invoiceNumber}}</strong> pour votre projet.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #cbd5e1; font-weight: bold;">Devis N°</td>
            <td style="padding: 8px; border-bottom: 1px solid #cbd5e1;">{{invoiceNumber}}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #cbd5e1; font-weight: bold;">Valide jusqu'au</td>
            <td style="padding: 8px; border-bottom: 1px solid #cbd5e1;">{{dueDate}}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #cbd5e1; font-weight: bold;">Montant total</td>
            <td style="padding: 8px; border-bottom: 1px solid #cbd5e1; font-weight: bold; color: #4f46e5;">{{amount}}</td>
          </tr>
        </table>
        <p style="text-align: center; margin: 30px 0;">
          <a href="{{paymentLink}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Valider & Signer le Devis</a>
        </p>
        <p>Télécharger la version PDF <a href="{{pdfLink}}">ici</a>.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="font-size: 11px; color: #64748b; text-align: center;">
          CREATIVART S.A.R.L. Les Berges du Lac 2, Tunis, 1053, Tunisie
        </p>
      </div>
    `;
  }
}
