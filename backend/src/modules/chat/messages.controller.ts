import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':conversationId')
  getMessages(@Param('conversationId') conversationId: string, @CurrentUser() user: any) {
    return this.chatService.getMessages(conversationId, user.id);
  }

  @Post()
  sendMessage(
    @Body() dto: { conversationId: string; content: string; attachmentUrl?: string; replyToId?: string; attachments?: any[] },
    @CurrentUser() user: any,
  ) {
    return this.chatService.sendMessage(
      dto.conversationId,
      {
        content: dto.content,
        attachmentUrl: dto.attachmentUrl,
        replyToId: dto.replyToId,
        attachments: dto.attachments,
      },
      user.id,
    );
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.chatService.markMessagesAsRead(id, user.id);
  }
}
