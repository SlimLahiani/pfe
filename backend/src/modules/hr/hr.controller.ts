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
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { HrService } from './hr.service';
import { CreateEmployeeProfileDto } from './dto/create-employee-profile.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateSalaryDto } from './dto/create-salary.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { QueryEmployeesDto } from './dto/query-employees.dto';
import { QueryLeaveRequestsDto } from './dto/query-leave-requests.dto';
import { CreateVacancyDto } from './dto/create-vacancy.dto';
import { QueryVacanciesDto } from './dto/query-vacancies.dto';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { QueryCandidatesDto } from './dto/query-candidates.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { RequirePermissions } from '../../core/decorators/permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { LeaveStatus, LeaveType } from '@prisma/client';
import { PdfService } from '../document/pdf.service';

@Controller('hr')
@UseGuards(JwtAuthGuard, PermissionsGuard, RolesGuard)
export class HrController {
  constructor(
    private readonly hrService: HrService,
    private readonly pdfService: PdfService,
  ) {}

  // ─── Employee Profiles ────────────────────────────────────────────────────────

  @Get('employees')
  @RequirePermissions('hr:read')
  findAllEmployees(@Query() query: QueryEmployeesDto) {
    return this.hrService.findAllEmployees(query);
  }

  @Get('employees/:id')
  @RequirePermissions('hr:read')
  findEmployeeById(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.hrService.findEmployeeById(id, currentUser);
  }

  @Post('employees')
  @RequirePermissions('hr:write')
  createEmployeeProfile(@Body() dto: CreateEmployeeProfileDto) {
    return this.hrService.createEmployeeProfile(dto);
  }

  @Patch('employees/:id')
  @RequirePermissions('hr:write')
  updateEmployeeProfile(
    @Param('id') id: string,
    @Body() dto: Partial<CreateEmployeeProfileDto>,
    @CurrentUser() currentUser: any,
  ) {
    return this.hrService.updateEmployeeProfile(id, dto, currentUser);
  }

  @Delete('employees/:id')
  @RequirePermissions('hr:write')
  deleteEmployeeProfile(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.hrService.deleteEmployeeProfile(id, currentUser);
  }

  @Patch('employees/:id/restore')
  @RequirePermissions('hr:write')
  restoreEmployeeProfile(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.hrService.restoreEmployeeProfile(id, currentUser);
  }

  // ─── Departments ──────────────────────────────────────────────────────────────

  @Get('departments')
  @RequirePermissions('hr:read')
  findAllDepartments(
    @Query('showArchived') showArchived?: string,
    @Query('isArchived') isArchived?: string,
  ) {
    const show = showArchived === 'true' || isArchived === 'true';
    return this.hrService.findAllDepartments({ showArchived: show });
  }

  @Post('departments')
  @RequirePermissions('hr:write')
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.hrService.createDepartment(dto);
  }

  @Patch('departments/:id')
  @RequirePermissions('hr:write')
  updateDepartment(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.hrService.updateDepartment(id, dto);
  }

  @Delete('departments/:id')
  @RequirePermissions('hr:write')
  deleteDepartment(@Param('id') id: string) {
    return this.hrService.deleteDepartment(id);
  }

  @Patch('departments/:id/restore')
  @RequirePermissions('hr:write')
  restoreDepartment(@Param('id') id: string) {
    return this.hrService.restoreDepartment(id);
  }

  // ─── Contracts ────────────────────────────────────────────────────────────────

  @Get('employees/:id/contracts')
  @RequirePermissions('hr:read')
  getContracts(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.hrService.getContracts(id, currentUser);
  }

  @Post('employees/:id/contracts')
  @RequirePermissions('hr:write')
  createContract(@Param('id') id: string, @Body() dto: CreateContractDto) {
    return this.hrService.createContract(id, dto);
  }

  @Delete('employees/:id/contracts/:contractId')
  @RequirePermissions('hr:write')
  deleteContract(@Param('id') employeeId: string, @Param('contractId') contractId: string) {
    return this.hrService.deleteContract(employeeId, contractId);
  }

  // ─── Salaries ─────────────────────────────────────────────────────────────────

  @Get('employees/:id/salaries')
  @RequirePermissions('hr:read')
  getSalaries(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.hrService.getSalaries(id, currentUser);
  }

  @Post('employees/:id/salaries')
  @RequirePermissions('hr:write')
  createSalary(@Param('id') id: string, @Body() dto: CreateSalaryDto) {
    return this.hrService.createSalary(id, dto);
  }

  // ─── Leave Requests ───────────────────────────────────────────────────────────

  @Get('leave-requests')
  @RequirePermissions('hr:read')
  findAllLeaveRequests(@Query() query: QueryLeaveRequestsDto, @CurrentUser() user: any) {
    return this.hrService.findAllLeaveRequests(query, user);
  }

  @Post('leave-requests')
  @RequirePermissions('hr:read')
  createLeaveRequestSelf(
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.hrService.createLeaveRequestSelf(user.id, dto);
  }

  @Post('employees/:id/leave-requests')
  @RequirePermissions('hr:read')
  createLeaveRequest(
    @Param('id') id: string,
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.hrService.createLeaveRequest(id, user.id, dto, user);
  }

  @Patch('leave-requests/:id/review')
  @RequirePermissions('hr:write')
  @Roles('GERANT', 'RESPONSABLE_RH')
  reviewLeaveRequest(
    @Param('id') id: string,
    @Body() dto: ReviewLeaveRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.hrService.reviewLeaveRequest(id, user.id, dto);
  }

  @Patch('leave-requests/:id')
  @RequirePermissions('hr:read')
  updateLeaveRequest(
    @Param('id') id: string,
    @Body() dto: UpdateLeaveRequestDto,
  ) {
    return this.hrService.updateLeaveRequest(id, dto);
  }

  @Delete('leave-requests/:id')
  @RequirePermissions('hr:write')
  deleteLeaveRequest(@Param('id') id: string) {
    return this.hrService.deleteLeaveRequest(id);
  }

  @Patch('leave-requests/:id/restore')
  @RequirePermissions('hr:write')
  restoreLeaveRequest(@Param('id') id: string) {
    return this.hrService.restoreLeaveRequest(id);
  }

  // ─── Leave Balances ───────────────────────────────────────────────────────────

  @Get('employees/:id/leave-balances')
  @RequirePermissions('hr:read')
  getLeaveBalances(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.hrService.getLeaveBalances(id, currentUser);
  }

  @Patch('employees/:id/leave-balances/:type/:year')
  @RequirePermissions('hr:write')
  updateLeaveBalance(
    @Param('id') id: string,
    @Param('type') type: LeaveType,
    @Param('year') year: string,
    @Body() dto: { totalDays: number; usedDays?: number; pendingDays?: number },
  ) {
    return this.hrService.updateLeaveBalance(id, type, parseInt(year, 10), dto);
  }

  // ─── HR Dashboard & Analytics Endpoints ────────────────────────────────────────

  @Get('dashboard')
  @RequirePermissions('hr:read')
  getHRDashboard() {
    return this.hrService.getHRDashboard();
  }

  @Get('analytics')
  @RequirePermissions('hr:read')
  getHRAnalytics() {
    return this.hrService.getHRAnalytics();
  }

  @Get('recommendations')
  @RequirePermissions('hr:read')
  getHRRecommendations() {
    return this.hrService.getHRRecommendations();
  }

  // ─── Attendance System Endpoints ──────────────────────────────────────────────

  @Get('attendance/today')
  @RequirePermissions('hr:read')
  getAttendanceTodayReport() {
    return this.hrService.getAttendanceTodayReport();
  }

  @Get('attendance/my')
  @RequirePermissions('hr:read')
  getMyAttendance(@CurrentUser() user: any) {
    return this.hrService.getMyAttendance(user.id);
  }

  @Get('employees/:id/attendance')
  @RequirePermissions('hr:read')
  getAttendance(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.hrService.getAttendance(id, currentUser);
  }

  @Post('attendance/check-in')
  @RequirePermissions('hr:read')
  checkIn(@CurrentUser() user: any) {
    return this.hrService.checkIn(user.id);
  }

  @Post('attendance/check-out')
  @RequirePermissions('hr:read')
  checkOut(@CurrentUser() user: any) {
    return this.hrService.checkOut(user.id);
  }

  // ─── Salary Management Endpoints ──────────────────────────────────────────────

  @Get('employees/:id/payslips')
  @RequirePermissions('hr:read')
  getPayslips(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.hrService.getPayslips(id, currentUser);
  }

  @Post('employees/:id/payslips')
  @RequirePermissions('hr:write')
  createPayslip(
    @Param('id') id: string,
    @Body() dto: { month: number; year: number; bonuses?: number; deductions?: number; notes?: string; status?: string },
  ) {
    return this.hrService.createPayslip(id, dto);
  }

  @Patch('payslips/:id/status')
  @RequirePermissions('hr:write')
  updatePayslipStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.hrService.updatePayslipStatus(id, status);
  }

  @Delete('payslips/:id')
  @RequirePermissions('hr:write')
  deletePayslip(@Param('id') id: string) {
    return this.hrService.deletePayslip(id);
  }

  @Get('payslips/:id/pdf')
  @RequirePermissions('hr:read')
  async downloadPayslipPdf(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() currentUser: any,
  ) {
    const payslip = await this.hrService.getPayslipById(id, currentUser);
    const employee = payslip.employee;
    const employeeName = `${employee.user.firstName}-${employee.user.lastName}`.toUpperCase();
    const originalFileName = `FICHE-PAIE-${employeeName}-${payslip.month}.pdf`;

    const pdfBuffer = await this.pdfService.generatePayslipPdf(payslip, employee);
    await this.pdfService.archiveDocument(
      pdfBuffer,
      originalFileName,
      'PAYSLIP',
      payslip.id,
      undefined,
      employee.userId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
      'Content-Length': pdfBuffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.end(pdfBuffer);
  }

  // ─── Employee Lifecycle & Onboarding Checklists ─────────────────────────────────

  @Get('employees/:id/history')
  @RequirePermissions('hr:read')
  getEmployeeHistory(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.hrService.getEmployeeHistory(id, currentUser);
  }

  @Post('employees/:id/history')
  @RequirePermissions('hr:write')
  addHistoryEvent(
    @Param('id') id: string,
    @Body() dto: { eventType: string; title: string; description?: string; notes?: string },
  ) {
    return this.hrService.addHistoryEvent(id, dto);
  }

  @Get('employees/:id/onboarding')
  @RequirePermissions('hr:read')
  getOnboardingTasks(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.hrService.getOnboardingTasks(id, currentUser);
  }

  @Patch('employees/:id/onboarding/checklist/:taskId')
  @RequirePermissions('hr:write')
  toggleOnboardingTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body('isCompleted') isCompleted: boolean,
  ) {
    return this.hrService.toggleOnboardingTask(id, taskId, isCompleted);
  }

  // ─── PDF Document Generation Endpoints ─────────────────────────────────────────

  @Get('employees/:id/generate-pdf/:docType')
  @RequirePermissions('hr:read')
  async downloadGeneratedDocument(
    @Param('id') id: string,
    @Param('docType') docType: string,
    @Res() res: Response,
  ) {
    const employee = await this.hrService.findEmployeeById(id);
    let pdfBuffer: Buffer;
    let originalFileName = `document-${docType}-${id}.pdf`;
    let entityType = '';
    const employeeName = `${employee.user.firstName}-${employee.user.lastName}`.toUpperCase();

    switch (docType) {
      case 'work-certificate':
        pdfBuffer = await this.pdfService.generateEmployeeCertificatePdf(employee);
        originalFileName = `ATTESTATION-TRAVAIL-${employeeName}.pdf`;
        entityType = 'WORK_CERTIFICATE';
        break;
      case 'salary-certificate':
        const salaries = await this.hrService.getSalaries(id);
        const salaryDetails = salaries.length > 0 ? salaries[0] : null;
        pdfBuffer = await this.pdfService.generateSalaryCertificatePdf(employee, salaryDetails);
        originalFileName = `ATTESTATION-SALAIRE-${employeeName}.pdf`;
        entityType = 'SALARY_CERTIFICATE';
        break;
      case 'internship-certificate':
        pdfBuffer = await this.pdfService.generateInternshipCertificatePdf(employee);
        originalFileName = `ATTESTATION-STAGE-${employeeName}.pdf`;
        entityType = 'INTERNSHIP_CERTIFICATE';
        break;
      case 'contract':
        const contracts = await this.hrService.getContracts(id);
        const activeContract = contracts.length > 0 ? contracts[0] : null;
        if (!activeContract) {
          throw new BadRequestException('Aucun contrat actif trouvé pour cet employé.');
        }
        pdfBuffer = await this.pdfService.generateEmploymentContractPdf(employee, activeContract);
        originalFileName = `CONTRAT-${employeeName}.pdf`;
        entityType = 'EMPLOYMENT_CONTRACT';
        break;
      default:
        throw new BadRequestException(`Type de document invalide : ${docType}`);
    }

    await this.pdfService.archiveDocument(
      pdfBuffer,
      originalFileName,
      entityType,
      id,
      undefined,
      employee.userId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
      'Content-Length': pdfBuffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.end(pdfBuffer);
  }

  @Get('leave-requests/:id/pdf')
  @RequirePermissions('hr:read')
  async downloadLeaveApprovalPdf(@Param('id') id: string, @Res() res: Response) {
    const leaveRequest = await this.hrService.findLeaveRequestById(id);
    if (!leaveRequest) {
      throw new NotFoundException('Demande de congé introuvable.');
    }
    const employee = leaveRequest.employee;
    const employeeName = `${employee.user.firstName}-${employee.user.lastName}`.toUpperCase();
    const originalFileName = `APPROBATION-CONGE-${employeeName}.pdf`;

    const pdfBuffer = await this.pdfService.generateLeaveApprovalPdf(leaveRequest);
    await this.pdfService.archiveDocument(
      pdfBuffer,
      originalFileName,
      'LEAVE_APPROVAL',
      leaveRequest.id,
      undefined,
      employee.userId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFileName)}"`,
      'Content-Length': pdfBuffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.end(pdfBuffer);
  }

  // ─── Recruitment - Job Vacancies ──────────────────────────────────────────────

  @Get('vacancies')
  @RequirePermissions('hr:read')
  findAllVacancies(@Query() query: QueryVacanciesDto) {
    return this.hrService.findAllVacancies(query);
  }

  @Get('vacancies/:id')
  @RequirePermissions('hr:read')
  findVacancyById(@Param('id') id: string) {
    return this.hrService.findVacancyById(id);
  }

  @Post('vacancies')
  @RequirePermissions('hr:write')
  createVacancy(@Body() dto: CreateVacancyDto) {
    return this.hrService.createVacancy(dto);
  }

  @Patch('vacancies/:id')
  @RequirePermissions('hr:write')
  updateVacancy(@Param('id') id: string, @Body() dto: Partial<CreateVacancyDto>) {
    return this.hrService.updateVacancy(id, dto);
  }

  @Delete('vacancies/:id')
  @RequirePermissions('hr:write')
  deleteVacancy(@Param('id') id: string) {
    return this.hrService.deleteVacancy(id);
  }

  @Patch('vacancies/:id/restore')
  @RequirePermissions('hr:write')
  restoreVacancy(@Param('id') id: string) {
    return this.hrService.restoreVacancy(id);
  }

  // ─── Recruitment - Candidates ──────────────────────────────────────────────────

  @Get('candidates')
  @RequirePermissions('hr:read')
  findAllCandidates(@Query() query: QueryCandidatesDto) {
    return this.hrService.findAllCandidates(query);
  }

  @Get('candidates/:id')
  @RequirePermissions('hr:read')
  findCandidateById(@Param('id') id: string) {
    return this.hrService.findCandidateById(id);
  }

  @Post('candidates')
  @RequirePermissions('hr:write')
  createCandidate(@Body() dto: CreateCandidateDto) {
    return this.hrService.createCandidate(dto);
  }

  @Patch('candidates/:id')
  @RequirePermissions('hr:write')
  updateCandidate(@Param('id') id: string, @Body() dto: Partial<CreateCandidateDto>) {
    return this.hrService.updateCandidate(id, dto);
  }

  @Delete('candidates/:id')
  @RequirePermissions('hr:write')
  deleteCandidate(@Param('id') id: string) {
    return this.hrService.deleteCandidate(id);
  }

  @Patch('candidates/:id/restore')
  @RequirePermissions('hr:write')
  restoreCandidate(@Param('id') id: string) {
    return this.hrService.restoreCandidate(id);
  }
}
