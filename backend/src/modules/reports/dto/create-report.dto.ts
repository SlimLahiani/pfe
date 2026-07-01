import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsObject, IsDateString, IsUUID } from 'class-validator';
import { ReportType } from '@prisma/client';

export class CreateReportDto {
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  name: string;

  @IsEnum(ReportType, { message: 'type must be a valid ReportType enum value' })
  type: ReportType;

  @IsOptional()
  @IsObject({ message: 'filters must be a JSON object' })
  filters?: Record<string, any>;

  @IsBoolean({ message: 'isShared must be a boolean' })
  @IsOptional()
  isShared?: boolean;

  @IsOptional()
  data?: any;

  @IsOptional()
  charts?: any;

  @IsOptional()
  @IsString({ message: 'subType must be a string' })
  subType?: string;

  @IsOptional()
  @IsString({ message: 'reportingPeriod must be a string' })
  reportingPeriod?: string;

  @IsOptional()
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  departmentId?: string;

  @IsOptional()
  @IsString({ message: 'title must be a string' })
  title?: string;

  @IsOptional()
  @IsDateString({}, { message: 'periodStart must be a valid ISO Date string' })
  periodStart?: string;

  @IsOptional()
  @IsDateString({}, { message: 'periodEnd must be a valid ISO Date string' })
  periodEnd?: string;


  @IsOptional()
  @IsObject({ message: 'notes must be a JSON object' })
  notes?: Record<string, any>;

  @IsOptional()
  @IsString({ message: 'status must be a string' })
  status?: string;

  @IsOptional()
  @IsString({ message: 'workflowStatus must be a string' })
  workflowStatus?: string;
}
