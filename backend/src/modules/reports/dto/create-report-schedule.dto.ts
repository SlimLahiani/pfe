import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsArray, IsEmail } from 'class-validator';

export class CreateReportScheduleDto {
  @IsString()
  @IsNotEmpty()
  cronExpr: string;

  @IsArray()
  @IsEmail({}, { each: true })
  recipients: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
