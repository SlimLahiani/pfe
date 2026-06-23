import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { Prisma } from '@prisma/client';
import { paginate, getPaginationParams } from '../../core/dto/paginated-response';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryAuditLogsDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      userId,
      resource,
      action,
      dateFrom,
      dateTo,
    } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const where: Prisma.AuditLogWhereInput = {
      ...(userId && { userId }),
      ...(resource && { resource: { contains: resource, mode: 'insensitive' } }),
      ...(action && { action: { contains: action, mode: 'insensitive' } }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
      ...(search && {
        OR: [
          { userEmail: { contains: search, mode: 'insensitive' } },
          { resource: { contains: search, mode: 'insensitive' } },
          { action: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const validSortFields: Record<string, keyof Prisma.AuditLogOrderByWithRelationInput> = {
      createdAt: 'createdAt',
      action: 'action',
      resource: 'resource',
    };
    const orderBy: Prisma.AuditLogOrderByWithRelationInput = {
      [validSortFields[sortBy] ?? 'createdAt']: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }
}
