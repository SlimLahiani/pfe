import { IsOptional, IsString, IsDateString } from 'class-validator';

export class GenerateHrReportDto {
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}
