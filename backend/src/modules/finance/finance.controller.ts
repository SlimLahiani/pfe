import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { QueryQuotesDto } from './dto/query-quotes.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { RequirePermissions } from '../../core/decorators/permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { InvoiceStatus } from '@prisma/client';

@Controller('finance')
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ─── Dashboard & Analytics ──────────────────────────────────────────────────

  @Get('dashboard')
  @RequirePermissions('finance:read')
  getDashboardKPIs() {
    return this.financeService.getDashboardKPIs();
  }

  @Get('analytics/revenue')
  @RequirePermissions('finance:read')
  getRevenueTrend() {
    return this.financeService.getRevenueTrend();
  }

  @Get('analytics/expenses')
  @RequirePermissions('finance:read')
  getExpenseBreakdown() {
    return this.financeService.getExpenseBreakdown();
  }

  @Get('analytics/cashflow')
  @RequirePermissions('finance:read')
  getCashFlow() {
    return this.financeService.getCashFlow();
  }

  @Get('analytics/aging')
  @RequirePermissions('finance:read')
  getInvoiceAging() {
    return this.financeService.getInvoiceAging();
  }

  @Get('analytics/top-clients')
  @RequirePermissions('finance:read')
  getTopClients() {
    return this.financeService.getTopClients();
  }

  // ─── Quotes ──────────────────────────────────────────────────────────────────


  @Get('quotes')
  @RequirePermissions('finance:read')
  findAllQuotes(@Query() query: QueryQuotesDto) {
    return this.financeService.findAllQuotes(query);
  }

  @Get('quotes/:id')
  @RequirePermissions('finance:read')
  findQuoteById(@Param('id') id: string) {
    return this.financeService.findQuoteById(id);
  }

  @Post('quotes')
  @RequirePermissions('finance:write')
  @Roles('GERANT', 'SECRETAIRE')
  createQuote(@Body() dto: CreateQuoteDto, @CurrentUser() user: any) {
    return this.financeService.createQuote(dto, user.id);
  }

  @Patch('quotes/:id')
  @RequirePermissions('finance:write')
  updateQuote(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.financeService.updateQuote(id, dto);
  }

  @Delete('quotes/:id')
  @RequirePermissions('finance:write')
  deleteQuote(@Param('id') id: string) {
    return this.financeService.deleteQuote(id);
  }

  @Patch('quotes/:id/restore')
  @RequirePermissions('finance:write')
  restoreQuote(@Param('id') id: string) {
    return this.financeService.restoreQuote(id);
  }

  @Post('quotes/:id/reminder')
  @RequirePermissions('finance:write')
  sendQuoteReminder(@Param('id') id: string) {
    return this.financeService.sendQuoteReminder(id);
  }

  @Patch('quotes/:id/submit')
  @RequirePermissions('finance:write')
  @Roles('GERANT', 'SECRETAIRE')
  submitQuote(@Param('id') id: string, @CurrentUser() user: any) {
    return this.financeService.submitQuoteForApproval(id, user.id);
  }

  @Patch('quotes/:id/approve')
  @RequirePermissions('finance:write')
  @Roles('GERANT')
  approveQuote(@Param('id') id: string, @CurrentUser() user: any) {
    return this.financeService.approveQuote(id, user.id);
  }

  @Post('quotes/:id/convert')
  @RequirePermissions('finance:write')
  @Roles('GERANT', 'SECRETAIRE')
  convertQuoteToInvoice(@Param('id') id: string, @CurrentUser() user: any) {
    return this.financeService.convertQuoteToInvoice(id, user.id);
  }

  @Patch('quotes/:id/reject')
  @RequirePermissions('finance:write')
  @Roles('GERANT')
  rejectQuote(@Param('id') id: string, @Body('reason') reason: string, @CurrentUser() user: any) {
    return this.financeService.rejectQuote(id, user.id, reason);
  }

  // ─── Invoices ────────────────────────────────────────────────────────────────

  @Get('invoices')
  @RequirePermissions('finance:read')
  findAllInvoices(@Query() query: QueryInvoicesDto) {
    return this.financeService.findAllInvoices(query);
  }

  @Get('invoices/:id')
  @RequirePermissions('finance:read')
  findInvoiceById(@Param('id') id: string) {
    return this.financeService.findInvoiceById(id);
  }

  @Post('invoices')
  @RequirePermissions('finance:write')
  @Roles('GERANT', 'SECRETAIRE')
  createInvoice(@Body() dto: CreateInvoiceDto, @CurrentUser() user: any) {
    return this.financeService.createInvoice(dto, user.id);
  }

  @Patch('invoices/:id')
  @RequirePermissions('finance:write')
  updateInvoice(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.financeService.updateInvoice(id, dto);
  }

  @Patch('invoices/:id/status')
  @RequirePermissions('finance:write')
  updateInvoiceStatus(@Param('id') id: string, @Body('status') status: InvoiceStatus) {
    return this.financeService.updateInvoiceStatus(id, status);
  }

  @Delete('invoices/:id')
  @RequirePermissions('finance:write')
  deleteInvoice(@Param('id') id: string) {
    return this.financeService.deleteInvoice(id);
  }

  @Patch('invoices/:id/restore')
  @RequirePermissions('finance:write')
  restoreInvoice(@Param('id') id: string) {
    return this.financeService.restoreInvoice(id);
  }

  @Post('invoices/:id/reminder')
  @RequirePermissions('finance:write')
  sendInvoiceReminder(@Param('id') id: string) {
    return this.financeService.sendInvoiceReminder(id);
  }

  @Patch('invoices/:id/submit')
  @RequirePermissions('finance:write')
  @Roles('GERANT', 'SECRETAIRE')
  submitInvoice(@Param('id') id: string, @CurrentUser() user: any) {
    return this.financeService.submitInvoiceForApproval(id, user.id);
  }

  @Patch('invoices/:id/approve')
  @RequirePermissions('finance:write')
  @Roles('GERANT')
  approveInvoice(@Param('id') id: string, @CurrentUser() user: any) {
    return this.financeService.approveInvoice(id, user.id);
  }

  @Patch('invoices/:id/reject')
  @RequirePermissions('finance:write')
  @Roles('GERANT')
  rejectInvoice(@Param('id') id: string, @Body('reason') reason: string, @CurrentUser() user: any) {
    return this.financeService.rejectInvoice(id, user.id, reason);
  }

  // ─── Payments ────────────────────────────────────────────────────────────────

  @Get('invoices/:id/payments')
  @RequirePermissions('finance:read')
  getPaymentsForInvoice(@Param('id') id: string) {
    return this.financeService.getPaymentsForInvoice(id);
  }

  @Post('invoices/:id/payments')
  @RequirePermissions('finance:write')
  addPayment(@Param('id') id: string, @Body() dto: CreatePaymentDto) {
    return this.financeService.addPayment(id, dto);
  }

  // ─── Expenses ────────────────────────────────────────────────────────────────

  @Get('expenses')
  @RequirePermissions('finance:read')
  findAllExpenses(@Query() query: QueryExpensesDto) {
    return this.financeService.findAllExpenses(query);
  }

  @Post('expenses')
  @RequirePermissions('finance:write')
  createExpense(@Body() dto: CreateExpenseDto, @CurrentUser() user: any) {
    return this.financeService.createExpense(dto, user.id);
  }

  @Patch('expenses/:id/approve')
  @RequirePermissions('finance:write')
  approveExpense(
    @Param('id') id: string,
    @Body('isApproved') isApproved: boolean,
    @CurrentUser() user: any,
  ) {
    return this.financeService.approveExpense(id, user.id, isApproved);
  }

  @Patch('expenses/:id')
  @RequirePermissions('finance:write')
  updateExpense(@Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.financeService.updateExpense(id, dto);
  }

  @Delete('expenses/:id')
  @RequirePermissions('finance:write')
  deleteExpense(@Param('id') id: string) {
    return this.financeService.deleteExpense(id);
  }

  @Patch('expenses/:id/restore')
  @RequirePermissions('finance:write')
  restoreExpense(@Param('id') id: string) {
    return this.financeService.restoreExpense(id);
  }

  // ─── Expense Categories ──────────────────────────────────────────────────────

  @Get('expenses/categories')
  @RequirePermissions('finance:read')
  findAllCategories() {
    return this.financeService.findAllCategories();
  }

  @Post('expenses/categories')
  @RequirePermissions('finance:write')
  createCategory(@Body() dto: CreateExpenseCategoryDto) {
    return this.financeService.createCategory(dto);
  }
}
