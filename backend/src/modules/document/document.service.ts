import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { Prisma } from '@prisma/client';
import { paginate, getPaginationParams } from '../../core/dto/paginated-response';

@Injectable()
export class DocumentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDocumentDto, uploaderId: string) {
    const { tags, ...data } = dto;

    // Find latest document code starting with [DOC-
    let docCode = '[DOC-001]';
    const latestDoc = await this.prisma.document.findFirst({
      where: {
        title: {
          startsWith: '[DOC-',
        },
      },
      orderBy: {
        title: 'desc',
      },
      select: {
        title: true,
      },
    });

    if (latestDoc && latestDoc.title) {
      const match = latestDoc.title.match(/^\[DOC-(\d+)\]/);
      if (match) {
        const lastSeq = parseInt(match[1], 10);
        if (!isNaN(lastSeq)) {
          docCode = `[DOC-${String(lastSeq + 1).padStart(3, '0')}]`;
        }
      }
    }

    const docTitle = dto.title.startsWith('[DOC-') ? dto.title : `${docCode} ${dto.title}`;

    return this.prisma.document.create({
      data: {
        ...data,
        title: docTitle,
        uploadedById: uploaderId,
        tags: {
          create: tags?.map((tag) => ({ tag })) || [],
        },
      },
      include: {
        tags: true,
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, companyName: true } },
      },
    });
  }

  async findAll(query: QueryDocumentsDto, currentUser?: any) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      type,
      clientId,
      isArchived = false,
    } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const isEmployee = currentUser?.role?.name === 'COLLABORATEUR';

    const where: Prisma.DocumentWhereInput = {
      isArchived,
      ...(type && { type }),
      ...(clientId && { clientId }),
      ...(isEmployee && { uploadedById: currentUser.id }),
      ...(query.entityType && { entityType: query.entityType }),
      ...(query.entityId && { entityId: query.entityId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { tags: { some: { tag: { contains: search, mode: 'insensitive' } } } },
        ],
      }),
    };

    const validSortFields: Record<string, keyof Prisma.DocumentOrderByWithRelationInput> = {
      createdAt: 'createdAt',
      title: 'title',
      size: 'size',
    };
    const orderBy: Prisma.DocumentOrderByWithRelationInput = {
      [validSortFields[sortBy] ?? 'createdAt']: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        skip,
        take,
        include: {
          tags: true,
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          client: { select: { id: true, companyName: true } },
        },
        orderBy,
      }),
      this.prisma.document.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string, currentUser?: any) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        tags: true,
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, companyName: true } },
      },
    });

    if (!doc) {
      throw new NotFoundException(`Document with ID "${id}" not found`);
    }

    if (currentUser && currentUser.role?.name === 'COLLABORATEUR') {
      if (doc.uploadedById !== currentUser.id) {
        throw new ForbiddenException('Access denied: You do not own this document.');
      }
    }

    return doc;
  }

  async update(id: string, dto: UpdateDocumentDto, currentUser?: any) {
    await this.findOne(id, currentUser);
    const { tags, ...data } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (tags !== undefined) {
        await tx.documentTag.deleteMany({
          where: { documentId: id },
        });
      }

      return tx.document.update({
        where: { id },
        data: {
          ...data,
          ...(tags !== undefined && {
            tags: {
              create: tags.map((tag) => ({ tag })),
            },
          }),
        },
        include: {
          tags: true,
          uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          client: { select: { id: true, companyName: true } },
        },
      });
    });
  }

  async delete(id: string, currentUser?: any) {
    await this.findOne(id, currentUser);
    return this.prisma.document.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
  }

  async restore(id: string, currentUser?: any) {
    if (currentUser && currentUser.role?.name === 'COLLABORATEUR') {
      throw new ForbiddenException('Access denied: Employees cannot restore documents.');
    }
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) {
      throw new NotFoundException(`Document with ID "${id}" not found`);
    }
    return this.prisma.document.update({
      where: { id },
      data: { isArchived: false, deletedAt: null },
    });
  }

  async addTag(documentId: string, tag: string) {
    await this.findOne(documentId);
    try {
      return await this.prisma.documentTag.create({
        data: { documentId, tag },
      });
    } catch {
      throw new BadRequestException(`Tag "${tag}" already exists on this document`);
    }
  }

  async removeTag(documentId: string, tag: string) {
    await this.findOne(documentId);
    const tagRecord = await this.prisma.documentTag.findUnique({
      where: {
        documentId_tag: { documentId, tag },
      },
    });

    if (!tagRecord) {
      throw new NotFoundException(`Tag "${tag}" not found on this document`);
    }

    return this.prisma.documentTag.delete({
      where: {
        documentId_tag: { documentId, tag },
      },
    });
  }

  async findByStoredFileName(storedFileName: string) {
    return this.prisma.document.findFirst({
      where: { storedFileName },
    });
  }
}
