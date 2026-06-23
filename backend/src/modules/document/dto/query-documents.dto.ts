import { IsEnum, IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../core/dto/pagination.dto';
import { DocumentType } from '@prisma/client';

export class QueryDocumentsDto extends PaginationDto {
  @IsEnum(DocumentType)
  @IsOptional()
  type?: DocumentType;

  @IsUUID()
  @IsOptional()
  clientId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  entityType?: string;

  @IsOptional()
  entityId?: string;
}
