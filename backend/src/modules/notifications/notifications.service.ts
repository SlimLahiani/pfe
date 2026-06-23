import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { EmailService } from './email.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationType, Prisma } from '@prisma/client';
import { paginate, getPaginationParams } from '../../core/dto/paginated-response';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly emailService: EmailService,
  ) {}

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body?: string,
    resourceId?: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        resourceId,
      },
    });

    // Real-time socket push
    this.gateway.sendToUser(userId, 'notification', notification);

    // Send email alert
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.email) {
      const emailHtml = `
        <h3>Nouvelle notification : ${title}</h3>
        <p>${body || ''}</p>
        <hr/>
        <p>Ceci est une alerte automatique de CREATIVART. Veuillez vous connecter pour consulter la ressource.</p>
      `;
      try {
        await this.emailService.sendMail(user.email, title, emailHtml);
      } catch {
        // Swallow email exceptions to prevent blocking business flow
      }
    }

    return notification;
  }

  async findAll(userId: string, query: QueryNotificationsDto) {
    const { page = 1, limit = 20, isRead, type } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(isRead !== undefined && { isRead }),
      ...(type && { type }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException(`Notification with ID "${id}" not found`);
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async deleteNotification(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException(`Notification with ID "${id}" not found`);
    }

    return this.prisma.notification.delete({
      where: { id },
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }
}
