import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsDateString, IsUUID } from 'class-validator';

export class CreateExpenseDto {
  @IsUUID()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsDateString()
  expenseDate: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  projectId?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;
}
