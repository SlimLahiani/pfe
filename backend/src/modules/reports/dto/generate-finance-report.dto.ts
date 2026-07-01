import { IsOptional, IsString, IsDateString } from 'class-validator';

export class GenerateFinanceReportDto {
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}
