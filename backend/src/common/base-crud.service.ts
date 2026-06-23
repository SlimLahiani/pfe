// backend/src/common/base-crud.service.ts
import { PrismaService } from "../prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { paginate } from "../core/dto/paginated-response";

/**
 * Generic Base CRUD Service providing common operations for all entities.
 * Extend this class in module services and provide the specific Prisma model name.
 */
@Injectable()
export class BaseCrudService<T extends { id: string }> {
  constructor(protected readonly prisma: PrismaService) {}

  /**
   * Create a new record.
   */
  async create<M>(model: keyof PrismaClient, data: M) {
    // @ts-ignore – dynamic access to Prisma client
    return (this.prisma as any)[model].create({ data });
  }

  /**
   * Find many with pagination, sorting and filtering.
   */
  async findMany<M>(
    model: keyof PrismaClient,
    where: Prisma.PrismaClientKnownRequestError | Prisma.Enumerable<any> = {},
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {}
  ) {
    const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;
    const { skip, take } = this.getPaginationParams(page, limit);
    const orderBy: any = { [sortBy]: sortOrder };
    // @ts-ignore – dynamic access
    const [data, total] = await this.prisma.$transaction([
      (this.prisma as any)[model].findMany({ where, skip, take, orderBy }),
      (this.prisma as any)[model].count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  /**
   * Find one by ID.
   */
  async findOne<M>(model: keyof PrismaClient, id: string, include?: any) {
    // @ts-ignore dynamic access
    return (this.prisma as any)[model].findUnique({ where: { id }, include });
  }

  /**
   * Update a record.
   */
  async update<M>(model: keyof PrismaClient, id: string, data: M) {
    // @ts-ignore dynamic access
    return (this.prisma as any)[model].update({ where: { id }, data });
  }

  /**
   * Soft‑delete a record.
   */
  async softDelete(model: keyof PrismaClient, id: string) {
    // @ts-ignore dynamic access – assumes `isArchived` and `deletedAt` fields exist
    return (this.prisma as any)[model].update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft‑deleted record.
   */
  async restore(model: keyof PrismaClient, id: string) {
    // @ts-ignore dynamic access
    return (this.prisma as any)[model].update({
      where: { id },
      data: { isArchived: false, deletedAt: null },
    });
  }

  /**
   * Helper to compute pagination offsets.
   */
  private getPaginationParams(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const take = limit;
    return { skip, take };
  }
}
