import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { EmailAutomationService } from './email-automation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { RequirePermissions } from '../../core/decorators/permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PdfController {
  constructor(
    private readonly pdfService: PdfService,
    private readonly emailAutomationService: EmailAutomationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('finance/quotes/:id/pdf')
  @RequirePermissions('finance:read')
  async getQuotePdf(@Param('id') id: string, @Res() res: Response) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        client: true,
        items: true,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID "${id}" not found`);
    }

    const originalFileName = `DEVIS-${quote.reference}.pdf`;
    const pdfBuffer = await this.pdfService.generateQuotePdf(quote);
    await this.pdfService.archiveDocument(pdfBuffer, originalFileName, 'QUOTE', quote.id, quote.clientId, quote.createdById);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
      'Content-Length': pdfBuffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.end(pdfBuffer);
  }

  @Get('finance/invoices/:id/pdf')
  @RequirePermissions('finance:read')
  async getInvoicePdf(@Param('id') id: string, @Res() res: Response) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        items: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID "${id}" not found`);
    }

    const originalFileName = `FACTURE-${invoice.reference}.pdf`;
    const pdfBuffer = await this.pdfService.generateInvoicePdf(invoice);
    await this.pdfService.archiveDocument(pdfBuffer, originalFileName, 'INVOICE', invoice.id, invoice.clientId, invoice.createdById);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
      'Content-Length': pdfBuffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.end(pdfBuffer);
  }

  @Get('hr/employees/:id/salary-certificate/pdf')
  @RequirePermissions('hr:read')
  async getSalaryCertificatePdf(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user: any,
  ) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID "${id}" not found`);
    }

    if (user && user.role?.name === 'COLLABORATEUR' && employee.userId !== user.id) {
      throw new ForbiddenException('Access denied: You can only download your own certificate.');
    }

    const employeeName = `${employee.user.firstName}-${employee.user.lastName}`.toUpperCase();
    const originalFileName = `ATTESTATION-SALAIRE-${employeeName}.pdf`;

    // Fetch active contract salary
    const activeContract = await this.prisma.contract.findFirst({
      where: { employeeId: id, isActive: true },
    });

    const salaryDetails = {
      amount: activeContract?.grossSalary ?? 0,
      currency: activeContract?.currency ?? 'TND',
    };

    const pdfBuffer = await this.pdfService.generateSalaryCertificatePdf(employee, salaryDetails);
    await this.pdfService.archiveDocument(pdfBuffer, originalFileName, 'SALARY_CERTIFICATE', employee.id, undefined, employee.userId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
      'Content-Length': pdfBuffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.end(pdfBuffer);
  }

  @Get('hr/leave-requests/:id/pdf')
  @RequirePermissions('hr:read')
  async getLeaveApprovalPdf(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user: any,
  ) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      throw new NotFoundException(`Leave request with ID "${id}" not found`);
    }

    if (user && user.role?.name === 'COLLABORATEUR' && leaveRequest.employee.userId !== user.id) {
      throw new ForbiddenException('Access denied: You can only download your own leave approval.');
    }

    const employeeName = `${leaveRequest.employee.user.firstName}-${leaveRequest.employee.user.lastName}`.toUpperCase();
    const originalFileName = `APPROBATION-CONGE-${employeeName}.pdf`;

    const pdfBuffer = await this.pdfService.generateLeaveApprovalPdf(leaveRequest);
    await this.pdfService.archiveDocument(pdfBuffer, originalFileName, 'LEAVE_APPROVAL', leaveRequest.id, undefined, leaveRequest.employee.userId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
      'Content-Length': pdfBuffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.end(pdfBuffer);
  }

  @Get('hr/employees/:id/certificate/pdf')
  @RequirePermissions('hr:read')
  async getEmployeeCertificatePdf(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user: any,
  ) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id },
      include: {
        user: true,
        department: true,
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID "${id}" not found`);
    }

    if (user && user.role?.name === 'COLLABORATEUR' && employee.userId !== user.id) {
      throw new ForbiddenException('Access denied: You can only download your own certificate.');
    }

    const employeeName = `${employee.user.firstName}-${employee.user.lastName}`.toUpperCase();
    const originalFileName = `ATTESTATION-TRAVAIL-${employeeName}.pdf`;

    const pdfBuffer = await this.pdfService.generateEmployeeCertificatePdf(employee);
    await this.pdfService.archiveDocument(pdfBuffer, originalFileName, 'WORK_CERTIFICATE', employee.id, undefined, employee.userId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
      'Content-Length': pdfBuffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.end(pdfBuffer);
  }

  @Post('finance/invoices/:id/generate-pdf')
  @RequirePermissions('finance:write')
  async forceGenerateInvoicePdf(@Param('id') id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { client: true, items: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID "${id}" not found`);
    }
    return this.pdfService.generateAndArchiveInvoicePdf(invoice);
  }

  @Get('finance/invoices/:id/download')
  @RequirePermissions('finance:read')
  async downloadInvoicePdf(@Param('id') id: string, @Res() res: Response) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { client: true, items: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID "${id}" not found`);
    }
    const originalFileName = `FACTURE-${invoice.reference}.pdf`;
    const pdfBuffer = await this.pdfService.generateInvoicePdf(invoice);
    await this.pdfService.archiveDocument(pdfBuffer, originalFileName, 'INVOICE', invoice.id, invoice.clientId, invoice.createdById);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
      'Content-Length': pdfBuffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.end(pdfBuffer);
  }

  @Get('finance/invoices/:id/preview')
  @RequirePermissions('finance:read')
  async previewInvoicePdf(@Param('id') id: string, @Res() res: Response) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { client: true, items: true },
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID "${id}" not found`);
    }
    const originalFileName = `FACTURE-${invoice.reference}.pdf`;
    const pdfBuffer = await this.pdfService.generateInvoicePdf(invoice);
    await this.pdfService.archiveDocument(pdfBuffer, originalFileName, 'INVOICE', invoice.id, invoice.clientId, invoice.createdById);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${encodeURIComponent(originalFileName)}"`,
      'Content-Length': pdfBuffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.end(pdfBuffer);
  }

  @Post('finance/invoices/:id/send')
  @RequirePermissions('finance:write')
  async sendInvoiceEmail(
    @Param('id') id: string,
    @Body('subject') subject?: string,
    @Body('message') message?: string,
  ) {
    const result = await this.emailAutomationService.sendInvoiceEmail(id, subject, message);
    await this.prisma.invoice.update({
      where: { id },
      data: { status: 'SENT' },
    });
    return result;
  }

  @Post('finance/invoices/:id/resend')
  @RequirePermissions('finance:write')
  async resendInvoiceEmail(
    @Param('id') id: string,
    @Body('subject') subject?: string,
    @Body('message') message?: string,
  ) {
    return this.emailAutomationService.sendInvoiceEmail(id, subject, message);
  }

  @Get('finance/invoices/:id/email-history')
  @RequirePermissions('finance:read')
  async getInvoiceEmailHistory(@Param('id') id: string) {
    return this.prisma.invoiceEmailLog.findMany({
      where: { invoiceId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('finance/invoices/:id/tracking')
  @RequirePermissions('finance:read')
  async getInvoiceTracking(@Param('id') id: string) {
    const logs = await this.prisma.invoiceEmailLog.findMany({
      where: { invoiceId: id },
      select: {
        status: true,
        sentAt: true,
        openedAt: true,
        clickedAt: true,
      },
    });

    const totalSent = logs.filter(l => l.sentAt !== null).length;
    const totalOpened = logs.filter(l => l.openedAt !== null).length;
    const totalClicked = logs.filter(l => l.clickedAt !== null).length;

    return {
      logs,
      summary: {
        totalSent,
        totalOpened,
        totalClicked,
        openedRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
        clickedRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
      },
    };
  }

  @Post('finance/invoices/:id/reminder')
  @RequirePermissions('finance:write')
  async sendInvoiceManualReminder(
    @Param('id') id: string,
    @Body('subject') subject?: string,
    @Body('message') message?: string,
  ) {
    // Generate Relance email subject and body if not provided
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID "${id}" not found`);
    }

    const finalSubject = subject || `[Relance] Rappel de Paiement - Facture ${invoice.reference}`;
    const finalBody = message || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #ef4444; text-align: center;">RAPPEL DE PAIEMENT - Facture ${invoice.reference}</h2>
        <p>Bonjour ${invoice.client.companyName},</p>
        <p>Sauf erreur de notre part, le paiement de la facture ${invoice.reference} de ${Number(invoice.total).toFixed(3)} ${invoice.currency} n'a pas encore été enregistré.</p>
        <p>Nous vous prions de bien vouloir régulariser cette situation dans les plus brefs délais.</p>
        <p style="text-align: center; margin: 20px 0;">
          <a href="http://localhost:5173/finance/invoices?detail=${invoice.id}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Régler la facture en ligne</a>
        </p>
        <p>Cordialement,</p>
        <p>Le service financier CREATIVART</p>
      </div>
    `;

    return this.emailAutomationService.sendInvoiceEmail(id, finalSubject, finalBody);
  }

  @Get('finance/reminders')
  @RequirePermissions('finance:read')
  async getAllReminders() {
    return this.prisma.invoiceEmailLog.findMany({
      where: {
        subject: { contains: 'Relance' },
      },
      include: {
        invoice: { select: { reference: true } },
        client: { select: { companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
