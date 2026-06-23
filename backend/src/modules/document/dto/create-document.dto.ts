import { IsNotEmpty, IsString, IsEnum, IsInt, IsUrl, IsOptional, IsUUID, IsArray } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(DocumentType)
  type: DocumentType;

  @IsUrl()
  @IsNotEmpty()
  url: string;

  @IsInt()
  size: number;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  clientId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
