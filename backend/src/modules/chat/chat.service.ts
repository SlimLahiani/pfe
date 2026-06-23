import { Injectable, NotFoundException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatRoomType, MessageStatus, NotificationType } from '@prisma/client';

@Injectable()
export class ChatService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.ensureGlobalChatExists();
    await this.ensureHrChatExists();
    await this.ensureFinanceChatExists();
    await this.ensureManagementChatExists();
    await this.ensureMarketingChatExists();
  }

  async ensureGlobalChatExists() {
    try {
      const globalChat = await this.prisma.chatRoom.findFirst({
        where: { name: 'Global Chat', type: ChatRoomType.GROUP },
      });

      if (!globalChat) {
        const allUsers = await this.prisma.user.findMany({ select: { id: true } });
        await this.prisma.chatRoom.create({
          data: {
            name: 'Global Chat',
            type: ChatRoomType.GROUP,
            members: { create: allUsers.map((u) => ({ userId: u.id })) },
          },
        });
        console.log('Seeded Global Chat room with all users.');
      }
    } catch (err) {
      console.warn('Failed to seed global chat room: ', err.message);
    }
  }

  async ensureHrChatExists() {
    try {
      let hrChat = await this.prisma.chatRoom.findFirst({ where: { name: 'HR Team' } });
      if (!hrChat) {
        const hrUsers = await this.prisma.user.findMany({
          where: { role: { name: { in: ['GERANT', 'RESPONSABLE_RH'] } } },
          select: { id: true },
        });
        hrChat = await this.prisma.chatRoom.create({
          data: {
            name: 'HR Team',
            type: ChatRoomType.GROUP,
            members: { create: hrUsers.map((u) => ({ userId: u.id })) },
          },
        });
      }
      return hrChat;
    } catch (err) {
      console.warn('Failed to seed HR chat: ', err.message);
    }
  }

  async ensureFinanceChatExists() {
    try {
      let finChat = await this.prisma.chatRoom.findFirst({ where: { name: 'Finance Team' } });
      if (!finChat) {
        const finUsers = await this.prisma.user.findMany({
          where: { role: { name: { in: ['GERANT', 'RESPONSABLE_FINANCIER', 'SECRETAIRE'] } } },
          select: { id: true },
        });
        finChat = await this.prisma.chatRoom.create({
          data: {
            name: 'Finance Team',
            type: ChatRoomType.GROUP,
            members: { create: finUsers.map((u) => ({ userId: u.id })) },
          },
        });
      }
      return finChat;
    } catch (err) {
      console.warn('Failed to seed Finance chat: ', err.message);
    }
  }

  async ensureManagementChatExists() {
    try {
      let mgtChat = await this.prisma.chatRoom.findFirst({ where: { name: 'Management Team' } });
      if (!mgtChat) {
        const mgtUsers = await this.prisma.user.findMany({
          where: { role: { name: { in: ['GERANT', 'RESPONSABLE_RH', 'RESPONSABLE_FINANCIER'] } } },
          select: { id: true },
        });
        mgtChat = await this.prisma.chatRoom.create({
          data: {
            name: 'Management Team',
            type: ChatRoomType.GROUP,
            members: { create: mgtUsers.map((u) => ({ userId: u.id })) },
          },
        });
      }
      return mgtChat;
    } catch (err) {
      console.warn('Failed to seed Management chat: ', err.message);
    }
  }

  async ensureMarketingChatExists() {
    try {
      let mktChat = await this.prisma.chatRoom.findFirst({ where: { name: 'Marketing Team' } });
      if (!mktChat) {
        const mktUsers = await this.prisma.user.findMany({
          where: {
            OR: [
              { role: { name: { in: ['GERANT', 'SECRETAIRE'] } } },
              { employeeProfile: { department: { name: { contains: 'marketing', mode: 'insensitive' } } } }
            ]
          },
          select: { id: true },
        });
        mktChat = await this.prisma.chatRoom.create({
          data: {
            name: 'Marketing Team',
            type: ChatRoomType.GROUP,
            members: { create: mktUsers.map((u) => ({ userId: u.id })) },
          },
        });
      }
      return mktChat;
    } catch (err) {
      console.warn('Failed to seed Marketing chat: ', err.message);
    }
  }

  async findAllRooms(userId: string) {
    // Self-healing: auto-enroll user in Global Chat
    const globalChat = await this.prisma.chatRoom.findFirst({
      where: { name: 'Global Chat', type: ChatRoomType.GROUP },
      include: { members: true },
    });

    if (globalChat) {
      const isMember = globalChat.members.some((m) => m.userId === userId);
      if (!isMember) {
        await this.prisma.chatRoomMember.create({ data: { roomId: globalChat.id, userId } });
      }
    } else {
      await this.ensureGlobalChatExists();
    }

    // Self-healing: auto-enroll and generate project chats
    const projects = await this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: true,
        chatRooms: { include: { members: true } },
      },
    });

    for (const project of projects) {
      if (project.chatRooms.length === 0) {
        await this.prisma.chatRoom.create({
          data: {
            name: `${project.name}`,
            type: ChatRoomType.GROUP,
            projectId: project.id,
            members: { create: project.members.map((m) => ({ userId: m.userId })) },
          },
        });
      } else {
        const chatRoom = project.chatRooms[0];
        const isMember = chatRoom.members.some((m) => m.userId === userId);
        if (!isMember) {
          await this.prisma.chatRoomMember.create({ data: { roomId: chatRoom.id, userId } });
        }
      }
    }

    return this.prisma.chatRoom.findMany({
      where: { members: { some: { userId } } },
      include: {
        project: { select: { id: true, name: true } },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
                role: { select: { name: true, description: true } },
                employeeProfile: {
                  select: {
                    jobTitle: true,
                    department: { select: { name: true } },
                  },
                },
                presence: {
                  select: {
                    isOnline: true,
                    lastSeen: true,
                  },
                },
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          where: { isDeleted: false },
          include: {
            sender: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findRoomById(id: string, userId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
                role: { select: { name: true, description: true } },
                employeeProfile: {
                  select: {
                    jobTitle: true,
                    department: { select: { name: true } },
                  },
                },
                presence: {
                  select: {
                    isOnline: true,
                    lastSeen: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!room) throw new NotFoundException(`Chat room with ID "${id}" not found`);
    const isMember = room.members.some((member) => member.userId === userId);
    if (!isMember) throw new ForbiddenException('You are not a member of this chat room');
    return room;
  }

  async createRoom(dto: CreateChatRoomDto, creatorId: string) {
    const userIds = Array.from(new Set([creatorId, ...dto.userIds]));

    if (dto.type === ChatRoomType.DIRECT && userIds.length === 2) {
      const existing = await this.prisma.chatRoom.findFirst({
        where: {
          type: ChatRoomType.DIRECT,
          AND: [
            { members: { some: { userId: userIds[0] } } },
            { members: { some: { userId: userIds[1] } } },
          ],
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      if (existing && existing.members.length === 2) return existing;
    }

    return this.prisma.chatRoom.create({
      data: {
        name: dto.name,
        type: dto.type,
        members: { create: userIds.map((userId) => ({ userId })) },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async getMessages(roomId: string, userId: string) {
    await this.findRoomById(roomId, userId);

    return this.prisma.message.findMany({
      where: { roomId, isDeleted: false },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        replyTo: {
          include: {
            sender: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        attachmentFiles: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(roomId: string, dto: SendMessageDto, senderId: string) {
    await this.findRoomById(roomId, senderId);

    const attachmentData = dto.attachments ? dto.attachments.map((a: any) => ({
      name: a.name || 'File',
      url: a.url || '',
      size: Number(a.size) || 0,
      type: a.type || 'application/octet-stream',
    })) : [];

    const message = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          roomId,
          senderId,
          content: dto.content || '',
          attachmentUrl: dto.attachmentUrl,
          replyToId: dto.replyToId,
          attachments: dto.attachments ?? [],
          status: MessageStatus.SENT,
          attachmentFiles: {
            create: attachmentData,
          },
        },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
          replyTo: {
            include: {
              sender: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          attachmentFiles: true,
        },
      });

      await tx.chatRoom.update({ where: { id: roomId }, data: { updatedAt: new Date() } });

      return msg;
    });

    // Fire notifications asynchronously outside the transaction to prevent deadlocks and blocking
    try {
      const otherMembers = await this.prisma.chatRoomMember.findMany({
        where: { roomId, userId: { not: senderId } },
      });

      const senderName = `${message.sender.firstName} ${message.sender.lastName}`;
      const notificationContent = dto.content ? dto.content.substring(0, 100) : 'Fichier joint';
      
      Promise.all(
        otherMembers.map((member) =>
          this.notificationsService.createNotification(
            member.userId,
            NotificationType.NEW_MESSAGE,
            `Nouveau message de ${senderName}`,
            notificationContent,
            roomId,
          ).catch((err) => {
            console.warn(`Failed to create notification for user ${member.userId}:`, err.message);
          })
        )
      ).catch(() => {});
    } catch (err) {
      console.warn('Failed to retrieve members for notifications:', err.message);
    }

    return message;
  }

  async editMessage(messageId: string, content: string, userId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('You can only edit your own messages');

    return this.prisma.message.update({
      where: { id: messageId },
      data: { content, isEdited: true, editedAt: new Date() },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        replyTo: { include: { sender: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('You can only delete your own messages');

    return this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, content: 'This message was deleted' },
    });
  }

  async markMessagesAsRead(roomId: string, userId: string) {
    await this.prisma.message.updateMany({
      where: { roomId, senderId: { not: userId }, status: { not: MessageStatus.SEEN } },
      data: { status: MessageStatus.SEEN },
    });

    await this.prisma.chatRoomMember.updateMany({
      where: { roomId, userId },
      data: { lastReadAt: new Date() },
    });
  }

  async getUnreadCount(userId: string) {
    const rooms = await this.prisma.chatRoom.findMany({
      where: { members: { some: { userId } } },
      include: { members: { where: { userId } } },
    });

    const counts: Record<string, number> = {};
    for (const room of rooms) {
      const lastRead = room.members[0]?.lastReadAt;
      const count = await this.prisma.message.count({
        where: {
          roomId: room.id,
          senderId: { not: userId },
          isDeleted: false,
          createdAt: lastRead ? { gt: lastRead } : undefined,
        },
      });
      if (count > 0) counts[room.id] = count;
    }
    return counts;
  }

  async updateUserPresence(userId: string, isOnline: boolean) {
    return this.prisma.userPresence.upsert({
      where: { userId },
      create: {
        userId,
        isOnline,
        lastSeen: new Date(),
      },
      update: {
        isOnline,
        lastSeen: new Date(),
      },
    });
  }

  async markMessageAsDelivered(messageId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (msg && msg.status !== MessageStatus.SEEN) {
      return this.prisma.message.update({
        where: { id: messageId },
        data: { status: MessageStatus.DELIVERED },
      });
    }
  }
}
