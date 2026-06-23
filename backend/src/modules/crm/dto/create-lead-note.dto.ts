import { IsString, IsNotEmpty } from 'class-validator';

export class CreateLeadNoteDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
