import { IsOptional, IsUUID, IsBoolean, IsDateString, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../core/dto/pagination.dto';

export class QueryExpensesDto extends PaginationDto {
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isApproved?: boolean;

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
