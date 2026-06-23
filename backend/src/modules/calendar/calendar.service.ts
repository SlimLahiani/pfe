import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { QueryCalendarEventsDto } from './dto/query-calendar-events.dto';
import { Prisma } from '@prisma/client';
import { paginate, getPaginationParams } from '../../core/dto/paginated-response';

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryCalendarEventsDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'startDate',
      sortOrder = 'asc',
      type,
      startDate,
      endDate,
      userId,
      isArchived = false,
    } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const where: Prisma.CalendarEventWhereInput = {
      isArchived,
      ...(type && { type }),
      ...((startDate || endDate) && {
        AND: [
          ...(startDate ? [{ startDate: { gte: new Date(startDate) } }] : []),
          ...(endDate ? [{ endDate: { lte: new Date(endDate) } }] : []),
        ],
      }),
      ...(userId && {
        OR: [
          { createdById: userId },
          { attendees: { some: { userId } } },
        ],
      }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const validSortFields: Record<string, keyof Prisma.CalendarEventOrderByWithRelationInput> = {
      startDate: 'startDate',
      endDate: 'endDate',
      createdAt: 'createdAt',
      title: 'title',
    };
    const orderBy: Prisma.CalendarEventOrderByWithRelationInput = {
      [validSortFields[sortBy] ?? 'startDate']: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.calendarEvent.findMany({
        where,
        skip,
        take,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          attendees: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
            },
          },
        },
        orderBy,
      }),
      this.prisma.calendarEvent.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        attendees: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Calendar event with ID "${id}" not found`);
    }

    return event;
  }

  async create(dto: CreateCalendarEventDto, creatorId: string) {
    const startDate = dto.startDate || dto.startTime;
    const endDate = dto.endDate || dto.endTime;
    if (!startDate || !endDate) {
      throw new BadRequestException('Start date and end date are required.');
    }
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.calendarEvent.create({
        data: {
          title: dto.title,
          description: dto.description,
          type: dto.type,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          allDay: dto.allDay ?? false,
          location: dto.location,
          projectId: dto.projectId,
          taskId: dto.taskId,
          createdById: creatorId,
        },
      });

      if (dto.attendeeIds && dto.attendeeIds.length > 0) {
        // Include creator as attendee
        const allAttendees = Array.from(new Set([creatorId, ...dto.attendeeIds]));
        await tx.eventAttendee.createMany({
          data: allAttendees.map((userId) => ({
            eventId: event.id,
            userId,
          })),
          skipDuplicates: true,
        });
      }

      return this.findOne(event.id);
    });
  }

  async update(id: string, dto: Partial<CreateCalendarEventDto>) {
    await this.findOne(id);
    const startDate = dto.startDate || dto.startTime;
    const endDate = dto.endDate || dto.endTime;

    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type && { type: dto.type }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(dto.allDay !== undefined && { allDay: dto.allDay }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.projectId !== undefined && { projectId: dto.projectId }),
        ...(dto.taskId !== undefined && { taskId: dto.taskId }),
      },
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.calendarEvent.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
  }

  async restore(id: string) {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Calendar event with ID "${id}" not found`);
    }
    return this.prisma.calendarEvent.update({
      where: { id },
      data: { isArchived: false, deletedAt: null },
    });
  }

  async respondToEvent(eventId: string, userId: string, accepted: boolean) {
    const attendee = await this.prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (!attendee) {
      throw new NotFoundException('You are not invited to this event');
    }

    return this.prisma.eventAttendee.update({
      where: { eventId_userId: { eventId, userId } },
      data: { accepted },
    });
  }

  async inviteAttendee(eventId: string, userId: string) {
    await this.findOne(eventId);
    try {
      return await this.prisma.eventAttendee.create({
        data: { eventId, userId },
      });
    } catch {
      throw new BadRequestException('User is already invited to this event');
    }
  }

  async removeAttendee(eventId: string, userId: string) {
    await this.findOne(eventId);
    const attendee = await this.prisma.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!attendee) {
      throw new NotFoundException('Attendee not found for this event');
    }
    return this.prisma.eventAttendee.delete({
      where: { eventId_userId: { eventId, userId } },
    });
  }
}
