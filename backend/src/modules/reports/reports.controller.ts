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
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateReportScheduleDto } from './dto/create-report-schedule.dto';
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

  @Get()
  @RequirePermissions('reports:read')
  findAll(
    @Query('type') type?: ReportType,
    @Query('isArchived') isArchived?: string,
    @CurrentUser() user?: any,
  ) {
    return this.reportsService.findAll(user, { type, isArchived: isArchived === 'true' });
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

  @Get(':id')
  @RequirePermissions('reports:read')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions('reports:write')
  create(@Body() dto: CreateReportDto, @CurrentUser() user: any) {
    return this.reportsService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('reports:write')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateReportDto>,
    @CurrentUser() user: any,
  ) {
    return this.reportsService.update(id, dto, user);
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

  @Get(':id/run')
  @RequirePermissions('reports:read')
  runReport(@Param('id') id: string, @CurrentUser() user: any) {
    return this.reportsService.runReport(id, user);
  }

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
