import { IsString, IsOptional, IsEnum, IsArray, IsNotEmpty } from 'class-validator';
import { ChatRoomType } from '@prisma/client';

export class CreateChatRoomDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(ChatRoomType)
  type: ChatRoomType;

  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}
