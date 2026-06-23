import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../core/dto/pagination.dto';

export class QueryClientsDto extends PaginationDto {
  /**
   * Filter by active status.
   * Also accepts 'ACTIVE' / 'INACTIVE' from the frontend for backwards compatibility.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === 'ACTIVE') return true;
    if (value === false || value === 'false' || value === 'INACTIVE') return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;

  /**
   * Alias for isActive accepted from the frontend as ?status=ACTIVE or ?status=INACTIVE
   */
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  showArchived?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isArchived?: boolean;
}
