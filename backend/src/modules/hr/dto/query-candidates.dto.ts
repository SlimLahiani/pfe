import { IsOptional, IsString, IsUUID, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../core/dto/pagination.dto';

export class QueryCandidatesDto extends PaginationDto {
  @IsUUID()
  @IsOptional()
  vacancyId?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isArchived?: boolean;
}
