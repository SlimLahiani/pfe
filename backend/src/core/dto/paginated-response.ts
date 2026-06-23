export class PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
  }
}

/**
 * Helper to apply skip/take to a Prisma findMany call and return a PaginatedResponse.
 * Usage:
 *   const [data, total] = await prisma.$transaction([
 *     prisma.model.findMany({ where, skip, take }),
 *     prisma.model.count({ where }),
 *   ]);
 *   return paginate(data, total, page, limit);
 */
export function paginate<T>(data: T[], total: number, page: number, limit: number): PaginatedResponse<T> {
  return new PaginatedResponse(data, total, page, limit);
}

export function getPaginationParams(page = 1, limit = 20) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}
