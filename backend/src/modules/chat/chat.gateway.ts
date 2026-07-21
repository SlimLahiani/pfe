import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';

export const onlineUsers = new Map<string, { socketId: string; lastSeen: Date }>();

export function getOnlineUserIds(): string[] {
  return Array.from(onlineUsers.keys());
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: 'chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}

  // ─── Connection Lifecycle ─────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers.authorization || client.handshake.auth?.token;
      if (!authHeader) {
        this.logger.warn(`[CHAT] Client ${client.id} rejected: no auth token`);
        client.disconnect();
        return;
      }

      const token = authHeader.replace('Bearer ', '').trim();
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'agencyos-super-secret-key-2026',
      });

      client.data = { userId: payload.sub, email: payload.email, role: payload.role };
      onlineUsers.set(payload.sub, { socketId: client.id, lastSeen: new Date() });

      await this.chatService.updateUserPresence(payload.sub, true);

      // Broadcast user online event (both naming conventions)
      client.broadcast.emit('userOnline', { userId: payload.sub });
      client.broadcast.emit('user_online', { userId: payload.sub });

      // Send current online list to the newly connected client
      const onlineList = Array.from(onlineUsers.keys());
      client.emit('onlineUsers', onlineList);
      client.emit('online_users', onlineList);

      this.logger.log(`[CHAT] ✅ Connected: ${client.id} | User: ${payload.email} (${payload.sub})`);
    } catch (e) {
      this.logger.error(`[CHAT] ❌ Auth failed for ${client.id}: ${e.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      onlineUsers.delete(userId);
      const lastSeen = new Date();

      await this.chatService.updateUserPresence(userId, false);

      client.broadcast.emit('userOffline', { userId, lastSeen: lastSeen.toISOString() });
      client.broadcast.emit('user_offline', { userId, lastSeen: lastSeen.toISOString() });
      this.logger.log(`[CHAT] 🔌 Disconnected: ${client.id} | User: ${client.data.email}`);
    } else {
      this.logger.log(`[CHAT] 🔌 Disconnected: ${client.id} (unauthenticated)`);
    }
  }

  // ─── Room Management ──────────────────────────────────────────────────────

  private async joinRoomLogic(
    body: { roomId?: string; conversationId?: string },
    client: Socket,
  ) {
    try {
      const roomId = body.roomId || body.conversationId;
      if (!roomId) return;
      const userId = client.data.userId;
      await this.chatService.findRoomById(roomId, userId);
      await client.join(`room_${roomId}`);
      client.emit('joinedRoom', { roomId });
      client.emit('joined_conversation', { conversationId: roomId });
      await this.chatService.markMessagesAsRead(roomId, userId);
      this.logger.log(`[CHAT] User ${userId} joined room ${roomId}`);
    } catch (e) {
      this.logger.error(`[CHAT] joinRoom failed: ${e.message}`);
      client.emit('error', { message: 'Failed to join room' });
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() body: { roomId?: string; conversationId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    return this.joinRoomLogic(body, client);
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @MessageBody() body: { roomId?: string; conversationId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    return this.joinRoomLogic(body, client);
  }

  private async leaveRoomLogic(
    body: { roomId?: string; conversationId?: string },
    client: Socket,
  ) {
    const roomId = body.roomId || body.conversationId;
    if (!roomId) return;
    await client.leave(`room_${roomId}`);
    client.emit('leftRoom', { roomId });
    client.emit('left_conversation', { conversationId: roomId });
    this.logger.log(`[CHAT] User ${client.data?.userId} left room ${roomId}`);
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() body: { roomId?: string; conversationId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    return this.leaveRoomLogic(body, client);
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @MessageBody() body: { roomId?: string; conversationId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    return this.leaveRoomLogic(body, client);
  }

  // ─── Messaging ────────────────────────────────────────────────────────────

  private async sendMessageLogic(
    data: { roomId?: string; conversationId?: string; content: string; attachmentUrl?: string; replyToId?: string; attachments?: any[] },
    client: Socket,
  ) {
    try {
      const roomId = data.roomId || data.conversationId;
      if (!roomId) return;
      const userId = client.data.userId;
      this.logger.log(`[CHAT] 📨 Message from ${userId} in room ${roomId}`);
      const message = await this.chatService.sendMessage(
        roomId,
        {
          content: data.content,
          attachmentUrl: data.attachmentUrl,
          replyToId: data.replyToId,
          attachments: data.attachments,
        },
        userId,
      );

      // Emit to all room members (both naming conventions)
      this.server.to(`room_${roomId}`).emit('newMessage', message);
      this.server.to(`room_${roomId}`).emit('receive_message', message);
      this.server.to(`room_${roomId}`).emit('new_message', message);
    } catch (e) {
      this.logger.error(`[CHAT] ❌ sendMessage failed: ${e.message}`, e.stack);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { roomId?: string; conversationId?: string; content: string; attachmentUrl?: string; replyToId?: string; attachments?: any[] },
    @ConnectedSocket() client: Socket,
  ) {
    return this.sendMessageLogic(data, client);
  }

  @SubscribeMessage('send_message')
  async handleSendMessageAlt(
    @MessageBody() data: { roomId?: string; conversationId?: string; content: string; attachmentUrl?: string; replyToId?: string; attachments?: any[] },
    @ConnectedSocket() client: Socket,
  ) {
    return this.sendMessageLogic(data, client);
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @MessageBody() data: { messageId: string; content: string; roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      const updated = await this.chatService.editMessage(data.messageId, data.content, userId);
      this.server.to(`room_${data.roomId}`).emit('messageEdited', updated);
      this.logger.log(`[CHAT] ✏️ Message ${data.messageId} edited by ${userId}`);
    } catch (e) {
      this.logger.error(`[CHAT] ❌ editMessage failed: ${e.message}`);
      client.emit('error', { message: e.message || 'Failed to edit message' });
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @MessageBody() data: { messageId: string; roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = client.data.userId;
      const updated = await this.chatService.deleteMessage(data.messageId, userId);
      this.server.to(`room_${data.roomId}`).emit('messageDeleted', {
        messageId: data.messageId,
        roomId: data.roomId,
        message: updated,
      });
      this.logger.log(`[CHAT] 🗑️ Message ${data.messageId} deleted by ${userId}`);
    } catch (e) {
      this.logger.error(`[CHAT] ❌ deleteMessage failed: ${e.message}`);
      client.emit('error', { message: e.message || 'Failed to delete message' });
    }
  }

  // ─── Typing Indicators ────────────────────────────────────────────────────

  private typingLogic(
    data: { roomId?: string; conversationId?: string; isTyping?: boolean },
    client: Socket,
    isTyping: boolean,
  ) {
    const roomId = data.roomId || data.conversationId;
    if (!roomId) return;
    const userId = client.data.userId;

    client.to(`room_${roomId}`).emit('userTyping', { userId, roomId, isTyping });
    client.to(`room_${roomId}`).emit('user_typing', { userId, conversationId: roomId, isTyping });
    if (isTyping) {
      client.to(`room_${roomId}`).emit('typing', { userId, roomId });
    } else {
      client.to(`room_${roomId}`).emit('stop_typing', { userId, roomId });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { roomId?: string; conversationId?: string; isTyping?: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const isTyping = data.isTyping !== undefined ? data.isTyping : true;
    return this.typingLogic(data, client, isTyping);
  }

  @SubscribeMessage('typing_start')
  handleTypingStart(
    @MessageBody() data: { roomId?: string; conversationId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    return this.typingLogic(data, client, true);
  }

  @SubscribeMessage('stop_typing')
  handleStopTyping(
    @MessageBody() data: { roomId?: string; conversationId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    return this.typingLogic(data, client, false);
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @MessageBody() data: { roomId?: string; conversationId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    return this.typingLogic(data, client, false);
  }

  // ─── Read Receipts ────────────────────────────────────────────────────────

  private async markReadLogic(
    data: { roomId?: string; conversationId?: string },
    client: Socket,
  ) {
    const roomId = data.roomId || data.conversationId;
    if (!roomId) return;
    const userId = client.data.userId;
    await this.chatService.markMessagesAsRead(roomId, userId);
    client.to(`room_${roomId}`).emit('messagesRead', { userId, roomId });
    client.to(`room_${roomId}`).emit('message_read', { userId, roomId, conversationId: roomId });
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @MessageBody() data: { roomId?: string; conversationId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    return this.markReadLogic(data, client);
  }

  @SubscribeMessage('message_read')
  async handleMessageRead(
    @MessageBody() data: { roomId?: string; conversationId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    return this.markReadLogic(data, client);
  }

  @SubscribeMessage('mark_read')
  async handleMarkReadAlt(
    @MessageBody() data: { roomId?: string; conversationId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    return this.markReadLogic(data, client);
  }

  @SubscribeMessage('message_delivered')
  async handleMessageDelivered(
    @MessageBody() data: { messageId: string; roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    await this.chatService.markMessageAsDelivered(data.messageId);
    client.to(`room_${data.roomId}`).emit('message_delivered', {
      messageId: data.messageId,
      roomId: data.roomId,
      userId,
    });
  }

  // ─── WebRTC Signaling ─────────────────────────────────────────────────────

  @SubscribeMessage('webrtc_call_offer')
  async handleCallOffer(
    @MessageBody() data: { roomId: string; offer: any; callerId: string; callerName: string; isVideo: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const room = await this.chatService.findRoomById(data.roomId, client.data.userId);
      const senderId = client.data.userId;

      room.members.forEach((member) => {
        if (member.userId === senderId) return;
        const onlineSession = onlineUsers.get(member.userId);
        if (onlineSession) {
          this.server.to(onlineSession.socketId).emit('webrtc_incoming_call', {
            roomId: data.roomId,
            offer: data.offer,
            callerId: data.callerId,
            callerName: data.callerName,
            isVideo: data.isVideo,
          });
        }
      });
      this.logger.log(`[CHAT] 📞 WebRTC offer from ${data.callerId} in room ${data.roomId} dispatched to online members (video=${data.isVideo})`);
    } catch (err) {
      this.logger.error(`[CHAT] Failed to dispatch call offer: ${err.message}`);
    }
  }

  @SubscribeMessage('webrtc_call_accept')
  async handleCallAccept(
    @MessageBody() data: { roomId: string; callerId: string; acceptedByName?: string; answer?: any },
    @ConnectedSocket() client: Socket,
  ) {
    const onlineSession = onlineUsers.get(data.callerId);
    if (onlineSession) {
      this.server.to(onlineSession.socketId).emit('webrtc_accept_response', {
        roomId: data.roomId,
        acceptedBy: client.data.userId,
        acceptedByName: data.acceptedByName,
        answer: data.answer,
      });
    }
    this.logger.log(`[CHAT] 📞 WebRTC call accepted by ${client.data.userId} to caller ${data.callerId}`);
  }

  @SubscribeMessage('webrtc_call_answer')
  async handleCallAnswer(
    @MessageBody() data: { roomId: string; answer: any },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(`room_${data.roomId}`).emit('webrtc_call_accepted', {
      roomId: data.roomId,
      answer: data.answer,
    });
  }

  @SubscribeMessage('webrtc_ice_candidate')
  async handleIceCandidate(
    @MessageBody() data: { roomId: string; candidate: any },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(`room_${data.roomId}`).emit('webrtc_ice_candidate', {
      candidate: data.candidate,
      fromUserId: client.data.userId,
    });
  }

  @SubscribeMessage('webrtc_call_reject')
  async handleCallReject(
    @MessageBody() data: { roomId: string; callerId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const onlineSession = onlineUsers.get(data.callerId);
    if (onlineSession) {
      this.server.to(onlineSession.socketId).emit('webrtc_call_rejected', {
        roomId: data.roomId,
        rejectedBy: client.data.userId,
      });
    }
    this.logger.log(`[CHAT] 📞 WebRTC call rejected by ${client.data.userId} to caller ${data.callerId}`);
  }

  @SubscribeMessage('webrtc_call_end')
  async handleCallEnd(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const room = await this.chatService.findRoomById(data.roomId, client.data.userId);
      const senderId = client.data.userId;

      room.members.forEach((member) => {
        if (member.userId === senderId) return;
        const onlineSession = onlineUsers.get(member.userId);
        if (onlineSession) {
          this.server.to(onlineSession.socketId).emit('webrtc_call_ended', {
            roomId: data.roomId,
            endedBy: senderId,
          });
        }
      });
    } catch {}
    this.logger.log(`[CHAT] 📞 WebRTC call ended by ${client.data.userId} in room ${data.roomId}`);
  }

  @SubscribeMessage('webrtc_camera_state')
  async handleCameraState(
    @MessageBody() data: { roomId: string; isCameraOff: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(`room_${data.roomId}`).emit('webrtc_remote_camera_state', {
      userId: client.data.userId,
      isCameraOff: data.isCameraOff,
    });
  }
}
