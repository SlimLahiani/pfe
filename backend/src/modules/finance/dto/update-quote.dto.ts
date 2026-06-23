import { IsEnum, IsOptional } from 'class-validator';
import { QuoteStatus } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';
import { CreateQuoteDto } from './create-quote.dto';

export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {
  @IsEnum(QuoteStatus)
  @IsOptional()
  status?: QuoteStatus;
}
