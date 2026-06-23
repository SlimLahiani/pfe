import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateVacancyDto {
  @IsString()
  title: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  requirements?: string;

  @IsString()
  @IsOptional()
  salaryRange?: string;

  @IsString()
  @IsOptional()
  status?: string; // OPEN, CLOSED, DRAFT
}
