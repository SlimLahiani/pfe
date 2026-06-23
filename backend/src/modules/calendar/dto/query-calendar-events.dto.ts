import { IsEnum, IsOptional, IsDateString, IsUUID, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../core/dto/pagination.dto';
import { EventType } from '@prisma/client';

export class QueryCalendarEventsDto extends PaginationDto {
  @IsEnum(EventType)
  @IsOptional()
  type?: EventType;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isArchived?: boolean;
}
