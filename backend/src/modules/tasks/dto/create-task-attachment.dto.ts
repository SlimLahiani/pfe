import { IsNotEmpty, IsString, IsInt, IsUrl } from 'class-validator';

export class CreateTaskAttachmentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUrl()
  @IsNotEmpty()
  url: string;

  @IsInt()
  size: number;

  @IsString()
  @IsNotEmpty()
  mimeType: string;
}
