import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ProjectMemberRole } from '@prisma/client';

export class AddMemberDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsEnum(ProjectMemberRole)
  role?: ProjectMemberRole;
}
