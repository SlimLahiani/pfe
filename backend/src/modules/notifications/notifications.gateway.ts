import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: 'notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers.authorization || client.handshake.auth?.token;
      if (!authHeader) {
        this.logger.warn(`[NOTIFY] Client ${client.id} rejected: no auth token`);
        client.disconnect();
        return;
      }

      const token = authHeader.replace('Bearer ', '').trim();
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'agencyos-super-secret-key-2026',
      });

      client.data = { userId: payload.sub, email: payload.email, role: payload.role };

      // Join a private room for targeted notifications
      await client.join(`user_${payload.sub}`);

      this.logger.log(`[NOTIFY] ✅ Connected: ${client.id} | User: ${payload.email} (${payload.sub})`);

      client.emit('authenticated', {
        message: 'Connected to CREATIVART Real-Time Notification System',
        userId: payload.sub,
      });
    } catch (e) {
      this.logger.error(`[NOTIFY] ❌ Auth failed for ${client.id}: ${e.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(
      `[NOTIFY] 🔌 Disconnected: ${client.id} | User: ${client.data?.email || 'unauthenticated'}`,
    );
  }

  /**
   * Send a notification event to a specific user's private room.
   * Also emits `notification_created` for legacy consumers.
   */
  sendToUser(userId: string, event: string, data: any) {
    this.logger.log(`[NOTIFY] 📢 Sending '${event}' to user_${userId}`);
    this.server.to(`user_${userId}`).emit(event, data);
    if (event === 'notification') {
      this.server.to(`user_${userId}`).emit('notification_created', data);
    }
  }

  /**
   * Broadcast a notification event to all connected clients.
   */
  broadcast(event: string, data: any) {
    this.logger.log(`[NOTIFY] 📢 Broadcasting '${event}' to all clients`);
    this.server.emit(event, data);
  }
}
