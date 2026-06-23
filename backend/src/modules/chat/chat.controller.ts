import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  findAllRooms(@CurrentUser() user: any) {
    return this.chatService.findAllRooms(user.id);
  }

  @Get('rooms/:roomId')
  findRoomById(@Param('roomId') roomId: string, @CurrentUser() user: any) {
    return this.chatService.findRoomById(roomId, user.id);
  }

  @Post('rooms')
  createRoom(@Body() dto: CreateChatRoomDto, @CurrentUser() user: any) {
    return this.chatService.createRoom(dto, user.id);
  }

  @Get('rooms/:roomId/messages')
  getMessages(@Param('roomId') roomId: string, @CurrentUser() user: any) {
    return this.chatService.getMessages(roomId, user.id);
  }

  @Post('rooms/:roomId/messages')
  sendMessage(
    @Param('roomId') roomId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.chatService.sendMessage(roomId, dto, user.id);
  }

  @Patch('messages/:messageId')
  editMessage(
    @Param('messageId') messageId: string,
    @Body('content') content: string,
    @CurrentUser() user: any,
  ) {
    return this.chatService.editMessage(messageId, content, user.id);
  }

  @Delete('messages/:messageId')
  deleteMessage(
    @Param('messageId') messageId: string,
    @CurrentUser() user: any,
  ) {
    return this.chatService.deleteMessage(messageId, user.id);
  }

  @Post('rooms/:roomId/read')
  markRead(@Param('roomId') roomId: string, @CurrentUser() user: any) {
    return this.chatService.markMessagesAsRead(roomId, user.id);
  }

  @Get('unread-counts')
  getUnreadCounts(@CurrentUser() user: any) {
    return this.chatService.getUnreadCount(user.id);
  }
}
