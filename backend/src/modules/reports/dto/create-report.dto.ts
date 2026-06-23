import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ReportType } from '@prisma/client';

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(ReportType)
  type: ReportType;

  @IsOptional()
  filters?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isShared?: boolean;

  @IsOptional()
  @IsString()
  subType?: string;

  @IsOptional()
  @IsString()
  reportingPeriod?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}
