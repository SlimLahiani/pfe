import { IsString, IsEmail, IsOptional, IsUUID } from 'class-validator';

export class CreateCandidateDto {
  @IsUUID()
  @IsOptional()
  vacancyId?: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  resumeUrl?: string;

  @IsString()
  @IsOptional()
  status?: string; // APPLIED, SCREENING, INTERVIEW, OFFER, HIRED, REJECTED

  @IsString()
  @IsOptional()
  notes?: string;
}
