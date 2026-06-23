import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { ChatRoomType } from '@prisma/client';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.chatService.findAllRooms(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.chatService.findRoomById(id, user.id);
  }

  @Post()
  create(@Body() dto: any, @CurrentUser() user: any) {
    return this.chatService.createRoom(dto, user.id);
  }

  @Post('private')
  createPrivate(@Body('userId') targetUserId: string, @CurrentUser() user: any) {
    return this.chatService.createRoom({
      type: ChatRoomType.DIRECT,
      userIds: [targetUserId],
    }, user.id);
  }

  @Post('group')
  createGroup(@Body() dto: { name: string; userIds: string[] }, @CurrentUser() user: any) {
    return this.chatService.createRoom({
      name: dto.name,
      type: ChatRoomType.GROUP,
      userIds: dto.userIds,
    }, user.id);
  }
}
