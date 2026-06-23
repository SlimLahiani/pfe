import { Controller, Get, UseGuards } from '@nestjs/common';
import { FinanceAnalyticsService } from './finance-analytics.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { RequirePermissions } from '../../core/decorators/permissions.decorator';

@Controller('finance/analytics-dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceAnalyticsController {
  constructor(private readonly analyticsService: FinanceAnalyticsService) {}

  @Get('kpis')
  @RequirePermissions('finance:read')
  async getKPIs() {
    return this.analyticsService.getFinancialKPIs();
  }

  @Get('cashflow')
  @RequirePermissions('finance:read')
  async getCashflow() {
    return this.analyticsService.getCashFlowTrends();
  }

  @Get('ai-insights')
  @RequirePermissions('finance:read')
  async getAiInsights() {
    return this.analyticsService.getAiFinanceInsights();
  }
}
