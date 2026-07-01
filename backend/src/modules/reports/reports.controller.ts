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
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateReportScheduleDto } from './dto/create-report-schedule.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { GenerateHrReportDto } from './dto/generate-hr-report.dto';
import { GenerateFinanceReportDto } from './dto/generate-finance-report.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { RequirePermissions } from '../../core/decorators/permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { ReportType } from '@prisma/client';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ─── List & Detail ────────────────────────────────────────────────────────────

  @Get()
  @RequirePermissions('reports:read')
  async findAll(
    @Query('type') type?: ReportType,
    @Query('isArchived') isArchived?: string,
    @Query('workflowStatus') workflowStatus?: string,
    @Query('departmentId') departmentId?: string,
    @CurrentUser() user?: any,
  ) {
    const list = await this.reportsService.findAll(user, {
      type,
      isArchived: isArchived === 'true',
      workflowStatus,
      departmentId,
    });
    return { data: list };
  }

  @Get('ceo')
  @RequirePermissions('reports:read')
  @Roles('GERANT')
  async findCeoReports(
    @CurrentUser() user: any,
  ) {
    const list = await this.reportsService.findAll(user, {
      isArchived: false,
    });
    const ceoReports = list.filter(r => r.workflowStatus !== 'DRAFT');
    return { data: ceoReports };
  }

  @Get('dashboard')
  @RequirePermissions('reports:read')
  async getDashboardStats(@CurrentUser() user: any) {
    const list = await this.reportsService.findAll(user, { isArchived: false });
    const total = list.length;
    const pending = list.filter(r => r.workflowStatus === 'SUBMITTED').length;
    const approved = list.filter(r => r.workflowStatus === 'APPROVED').length;
    const rejected = list.filter(r => r.workflowStatus === 'REJECTED').length;
    return {
      data: {
        total,
        pending,
        approved,
        rejected,
      }
    };
  }

  @Get('analytics/compare')
  @RequirePermissions('reports:read')
  @Roles('GERANT')
  getComparisonAnalytics() {
    return this.reportsService.getComparisonAnalytics();
  }

  @Get('analytics/ceo-summary')
  @RequirePermissions('reports:read')
  @Roles('GERANT')
  getCeoSummary() {
    return this.reportsService.getCeoSummary();
  }

  // ─── Generate (Auto-fill data) ────────────────────────────────────────────────

  @Post('generate/hr')
  @RequirePermissions('reports:read')
  @Roles('RESPONSABLE_RH', 'GERANT')
  generateHrData(@Body() dto: GenerateHrReportDto, @CurrentUser() user: any) {
    return this.reportsService.generateHrReportData(dto, user);
  }

  @Post('generate/finance')
  @RequirePermissions('reports:read')
  @Roles('RESPONSABLE_FINANCIER', 'GERANT')
  generateFinanceData(@Body() dto: GenerateFinanceReportDto, @CurrentUser() user: any) {
    return this.reportsService.generateFinanceReportData(dto, user);
  }

  // ─── PDF/Excel Export ─────────────────────────────────────────────────────────

  @Get('export/pdf/:id')
  @RequirePermissions('reports:read')
  async exportPdf(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportPdf(id, user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id/pdf')
  @RequirePermissions('reports:read')
  async exportPdfAlt(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    return this.exportPdf(id, user, res);
  }

  @Get('export/excel/:id')
  @RequirePermissions('reports:read')
  async exportExcel(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportExcel(id, user);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="report-${id}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ─── Single Report ────────────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('reports:read')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.findOne(id, user);
  }

  @Get(':id/data')
  @RequirePermissions('reports:read')
  getReportData(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.getReportData(id, user);
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions('reports:write')
  create(@Body() dto: CreateReportDto, @CurrentUser() user: any) {
    console.log('[ReportsController] create() payload received:', dto);
    return this.reportsService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('reports:write')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @CurrentUser() user: any,
  ) {
    console.log('[ReportsController] Saving report:', dto);
    return this.reportsService.update(id, dto, user);
  }

  @Post(':id/save')
  @RequirePermissions('reports:write')
  async saveReportDraft(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('reports:write')
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.delete(id, user);
  }

  @Patch(':id/restore')
  @RequirePermissions('reports:write')
  restore(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.restore(id, user);
  }

  // ─── Workflow ─────────────────────────────────────────────────────────────────

  @Post(':id/submit')
  @RequirePermissions('reports:write')
  @HttpCode(HttpStatus.OK)
  submitReport(@Param('id') id: string, @CurrentUser() user: any) {
    console.log("Submitting report:", id);
    return this.reportsService.submitReport(id, user);
  }

  @Post(':id/return-to-draft')
  @RequirePermissions('reports:write')
  @HttpCode(HttpStatus.OK)
  returnToDraft(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.returnToDraft(id, user);
  }

  @Patch(':id/approve')
  @RequirePermissions('reports:write')
  @Roles('GERANT')
  approveReport(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('comment') comment?: string,
  ) {
    return this.reportsService.approveReport(id, user.id, comment);
  }

  @Patch(':id/reject')
  @RequirePermissions('reports:write')
  @Roles('GERANT')
  rejectReport(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('reason') reason: string,
  ) {
    return this.reportsService.rejectReport(id, user.id, reason);
  }

  @Post(':id/approve')
  @RequirePermissions('reports:write')
  @Roles('GERANT')
  approveReportPost(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('comment') comment?: string,
  ) {
    return this.reportsService.approveReport(id, user.id, comment);
  }

  @Post(':id/reject')
  @RequirePermissions('reports:write')
  @Roles('GERANT')
  rejectReportPost(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('reason') reason: string,
  ) {
    return this.reportsService.rejectReport(id, user.id, reason);
  }

  @Patch(':id/request-modifications')
  @RequirePermissions('reports:write')
  @Roles('GERANT')
  requestModifications(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('comment') comment: string,
  ) {
    return this.reportsService.requestModifications(id, user.id, comment);
  }

  // ─── Comments ─────────────────────────────────────────────────────────────────

  @Post(':id/comments')
  @RequirePermissions('reports:write')
  @HttpCode(HttpStatus.CREATED)
  addComment(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: AddCommentDto,
  ) {
    return this.reportsService.addComment(id, user, dto);
  }

  @Get(':id/comments')
  @RequirePermissions('reports:read')
  getComments(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.getComments(id, user);
  }

  // ─── History ──────────────────────────────────────────────────────────────────

  @Get(':id/history')
  @RequirePermissions('reports:read')
  getHistory(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.getHistory(id, user);
  }

  // ─── Run (Legacy) ─────────────────────────────────────────────────────────────

  @Get(':id/run')
  @RequirePermissions('reports:read')
  runReport(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.runReport(id, user);
  }

  // ─── Schedules ────────────────────────────────────────────────────────────────

  @Post(':id/schedules')
  @RequirePermissions('reports:write')
  createSchedule(
    @Param('id') id: string,
    @Body() dto: CreateReportScheduleDto,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.createSchedule(id, dto, user);
  }
}
