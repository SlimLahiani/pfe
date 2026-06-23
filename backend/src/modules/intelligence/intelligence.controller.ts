import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IntelligenceService } from './intelligence.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';

@Controller('intelligence')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('GERANT', 'RESPONSABLE_RH', 'RESPONSABLE_FINANCIER')
export class IntelligenceController {
  constructor(private readonly intelligenceService: IntelligenceService) {}

  @Get('summary')
  getExecutiveSummary() {
    return this.intelligenceService.getExecutiveSummary();
  }

  @Get('decision-center')
  getDecisionCenter() {
    return this.intelligenceService.getDecisionCenter();
  }

  @Get('financial-health')
  @Roles('GERANT', 'RESPONSABLE_FINANCIER')
  getFinancialHealth() {
    return this.intelligenceService.getFinancialHealth();
  }

  @Get('project-risks')
  getProjectRisks() {
    return this.intelligenceService.getProjectRisks();
  }

  @Get('employee-analytics')
  @Roles('GERANT', 'RESPONSABLE_RH')
  getEmployeeAnalytics() {
    return this.intelligenceService.getEmployeeAnalytics();
  }

  @Get('assignment-suggestions')
  getAssignmentSuggestions(@Query('projectId') projectId?: string) {
    return this.intelligenceService.getSmartAssignmentSuggestions(projectId);
  }

  @Get('client-lead-scores')
  getClientAndLeadScores() {
    return this.intelligenceService.getClientAndLeadScores();
  }
}
