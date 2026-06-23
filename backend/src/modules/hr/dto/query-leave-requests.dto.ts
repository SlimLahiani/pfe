import { IsEnum, IsOptional, IsUUID, IsDateString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../core/dto/pagination.dto';
import { LeaveStatus, LeaveType } from '@prisma/client';

export class QueryLeaveRequestsDto extends PaginationDto {
  @IsEnum(LeaveStatus)
  @IsOptional()
  status?: LeaveStatus;

  @IsEnum(LeaveType)
  @IsOptional()
  type?: LeaveType;

  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isArchived?: boolean;
}
