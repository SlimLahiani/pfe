import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateClientContactDto } from './dto/create-client-contact.dto';
import { CreateLeadActivityDto } from './dto/create-lead-activity.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { ActivityType, Prisma, LeadStatus, ProjectStatus, ProjectMemberRole } from '@prisma/client';
import { paginate, getPaginationParams } from '../../core/dto/paginated-response';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Leads ───────────────────────────────────────────────────────────────────

  async findAllLeads(query: QueryLeadsDto) {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc', status, source, assignedToId, showArchived } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const where: Prisma.LeadWhereInput = {
      isArchived: showArchived === true || query.isArchived === true,
      ...(status && { status }),
      ...(source && { source }),
      ...(assignedToId && { assignedToId }),
      ...(search && {
        OR: [
          { companyName: { contains: search, mode: 'insensitive' } },
          { contactName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const validSortFields: Record<string, keyof Prisma.LeadOrderByWithRelationInput> = {
      createdAt: 'createdAt',
      companyName: 'companyName',
      estimatedValue: 'estimatedValue',
      status: 'status',
    };
    const orderBy: Prisma.LeadOrderByWithRelationInput = {
      [validSortFields[sortBy] ?? 'createdAt']: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        skip,
        take,
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { notes: true, activities: true } },
        },
        orderBy,
      }),
      this.prisma.lead.count({ where }),
    ]);

    const mappedData = data.map(lead => {
      const names = (lead.contactName || '').split(' ');
      const firstName = names[0] || '';
      const lastName = names.slice(1).join(' ') || '';
      return {
        ...lead,
        company: lead.companyName,
        firstName,
        lastName,
      };
    });

    return paginate(mappedData, total, page, limit);
  }

  async findLeadById(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        notes: {
          include: { author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          include: { performedBy: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { occurredAt: 'desc' },
        },
        client: { select: { id: true, companyName: true } },
      },
    });

    if (!lead) throw new NotFoundException(`Lead with ID "${id}" not found`);
    const names = (lead.contactName || '').split(' ');
    const firstName = names[0] || '';
    const lastName = names.slice(1).join(' ') || '';
    return {
      ...lead,
      company: lead.companyName,
      firstName,
      lastName,
    };
  }

  async createLead(dto: CreateLeadDto, creatorId: string) {
    const companyName = dto.companyName || dto.company || 'Unknown Company';
    const contactName = dto.contactName || [dto.firstName, dto.lastName].filter(Boolean).join(' ') || 'Contact';
    const lead = await this.prisma.lead.create({
      data: {
        companyName,
        contactName,
        email: dto.email,
        phone: dto.phone,
        source: dto.source,
        status: dto.status,
        estimatedValue: dto.estimatedValue,
        currency: dto.currency || 'TND',
        description: dto.description,
        assignedToId: dto.assignedToId,
        createdById: creatorId,
      },
    });
    const names = (lead.contactName || '').split(' ');
    const firstName = names[0] || '';
    const lastName = names.slice(1).join(' ') || '';
    return {
      ...lead,
      company: lead.companyName,
      firstName,
      lastName,
    };
  }

  async updateLead(id: string, dto: UpdateLeadDto) {
    const lead = await this.findLeadById(id);
    const companyName = dto.companyName || dto.company;
    const contactName = dto.contactName || (dto.firstName || dto.lastName ? [dto.firstName, dto.lastName].filter(Boolean).join(' ') : undefined);

    const { company, firstName, lastName, ...rest } = dto;

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        ...rest,
        ...(companyName && { companyName }),
        ...(contactName && { contactName }),
      },
    });

    const names = (updated.contactName || '').split(' ');
    const fName = names[0] || '';
    const lName = names.slice(1).join(' ') || '';
    const updatedWithMapped = {
      ...updated,
      company: updated.companyName,
      firstName: fName,
      lastName: lName,
    };

    // Workflow: Lead Won -> Convert to Client -> Create Project
    if (dto.status === LeadStatus.WON && lead.status !== LeadStatus.WON) {
      // Check if client already exists for this lead
      let client = await this.prisma.client.findUnique({
        where: { leadId: id },
      });

      if (!client) {
        // Create Client
        client = await this.prisma.client.create({
          data: {
            companyName: lead.companyName,
            industry: 'Digital Services',
            website: lead.email ? `https://www.${lead.email.split('@')[1]}` : null,
            address: 'Tunis, Tunisia',
            city: 'Tunis',
            country: 'Tunisia',
            taxId: `MF-${Date.now()}`,
            isActive: true,
            leadId: id,
            createdById: lead.createdById,
          },
        });

        // Create Client Contact
        const names = lead.contactName.split(' ');
        const firstName = names[0] || 'Contact';
        const lastName = names.slice(1).join(' ') || lead.companyName;
        await this.prisma.clientContact.create({
          data: {
            clientId: client.id,
            firstName,
            lastName,
            email: lead.email,
            phone: lead.phone,
            position: 'Directeur',
            isPrimary: true,
          },
        });
      }

      // Create Project for this Client
      const projectExists = await this.prisma.project.findFirst({
        where: { clientId: client.id, name: `${lead.companyName} Project` },
      });

      if (!projectExists) {
        const project = await this.prisma.project.create({
          data: {
            name: `${lead.companyName} Project`,
            description: `Projet initial créé automatiquement à partir du Lead Won: ${lead.description || lead.companyName}`,
            status: ProjectStatus.PLANNING,
            clientId: client.id,
            budget: lead.estimatedValue,
            currency: lead.currency,
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 3600 * 1000), // 90 days from now
          },
        });

        // Add lead creator or assignee as manager
        const managerUserId = lead.assignedToId || lead.createdById;
        await this.prisma.projectMember.create({
          data: {
            projectId: project.id,
            userId: managerUserId,
            role: ProjectMemberRole.MANAGER,
          },
        });
      }
    }

    return updatedWithMapped;
  }

  async assignLead(id: string, assignedToId: string | null) {
    await this.findLeadById(id);
    return this.prisma.lead.update({ where: { id }, data: { assignedToId } });
  }

  async deleteLead(id: string) {
    await this.findLeadById(id);
    return this.prisma.lead.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
  }

  async restoreLead(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException(`Lead with ID "${id}" not found`);
    return this.prisma.lead.update({
      where: { id },
      data: { isArchived: false, deletedAt: null },
    });
  }

  // ─── Lead Notes ──────────────────────────────────────────────────────────────

  async getLeadNotes(leadId: string) {
    await this.findLeadById(leadId);
    return this.prisma.leadNote.findMany({
      where: { leadId },
      include: { author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addLeadNote(leadId: string, content: string, authorId: string) {
    await this.findLeadById(leadId);
    return this.prisma.leadNote.create({ data: { leadId, authorId, content } });
  }

  async deleteLeadNote(noteId: string) {
    const note = await this.prisma.leadNote.findUnique({ where: { id: noteId } });
    if (!note) throw new NotFoundException(`Lead note with ID "${noteId}" not found`);
    return this.prisma.leadNote.delete({ where: { id: noteId } });
  }

  // ─── Lead Activities ─────────────────────────────────────────────────────────

  async getLeadActivities(leadId: string) {
    await this.findLeadById(leadId);
    return this.prisma.leadActivity.findMany({
      where: { leadId },
      include: { performedBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async addLeadActivity(leadId: string, dto: CreateLeadActivityDto, performedById: string) {
    await this.findLeadById(leadId);
    return this.prisma.leadActivity.create({
      data: {
        leadId,
        type: dto.type,
        subject: dto.subject,
        description: dto.description,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        performedById,
      },
    });
  }

  // ─── Clients ─────────────────────────────────────────────────────────────────

  async findAllClients(query: QueryClientsDto) {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc', industry, showArchived } = query;
    const { skip, take } = getPaginationParams(page, limit);

    // Resolve isActive from either the boolean field or the string status alias
    let resolvedIsActive: boolean | undefined = query.isActive;
    if (resolvedIsActive === undefined && query.status !== undefined) {
      if (query.status === 'ACTIVE') resolvedIsActive = true;
      else if (query.status === 'INACTIVE') resolvedIsActive = false;
    }

    const where: Prisma.ClientWhereInput = {
      isArchived: showArchived === true || query.isArchived === true,
      ...(resolvedIsActive !== undefined && { isActive: resolvedIsActive }),
      ...(industry && { industry: { contains: industry, mode: 'insensitive' } }),
      ...(search && {
        OR: [
          { companyName: { contains: search, mode: 'insensitive' } },
          { industry: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const validSortFields: Record<string, keyof Prisma.ClientOrderByWithRelationInput> = {
      createdAt: 'createdAt',
      companyName: 'companyName',
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        skip,
        take,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          contacts: true,
          _count: { select: { contacts: true, projects: true, invoices: true } },
        },
        orderBy: { [validSortFields[sortBy] ?? 'createdAt']: sortOrder },
      }),
      this.prisma.client.count({ where }),
    ]);

    const mappedData = data.map(client => {
      const primaryContact = client.contacts.find(c => c.isPrimary) || client.contacts[0];
      return {
        ...client,
        name: client.companyName,
        email: primaryContact?.email || null,
        phone: primaryContact?.phone || null,
        status: client.isActive ? 'ACTIVE' : 'INACTIVE',
      };
    });

    return paginate(mappedData, total, page, limit);
  }

  async findClientById(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        contacts: true,
        projects: { select: { id: true, name: true, status: true } },
        lead: { select: { id: true, status: true } },
        _count: { select: { invoices: true, quotes: true } },
      },
    });

    if (!client) throw new NotFoundException(`Client with ID "${id}" not found`);
    const primaryContact = client.contacts.find(c => c.isPrimary) || client.contacts[0];
    return {
      ...client,
      name: client.companyName,
      email: primaryContact?.email || null,
      phone: primaryContact?.phone || null,
      status: client.isActive ? 'ACTIVE' : 'INACTIVE',
    };
  }

  async createClient(dto: CreateClientDto, creatorId: string) {
    const companyName = dto.companyName || dto.company || dto.name;
    if (!companyName) {
      throw new BadRequestException('Company name is required.');
    }

    let isActive = true;
    if (dto.isActive !== undefined) {
      isActive = dto.isActive;
    } else if (dto.status !== undefined) {
      isActive = dto.status === 'ACTIVE';
    }

    const client = await this.prisma.client.create({
      data: {
        companyName,
        industry: dto.industry,
        website: dto.website,
        address: dto.address,
        city: dto.city,
        country: dto.country || 'Tunisia',
        taxId: dto.taxId,
        isActive,
        leadId: dto.leadId,
        createdById: creatorId,
      },
    });

    if (dto.email || dto.phone || dto.name) {
      const names = (dto.name || 'Contact').split(' ');
      const firstName = names[0] || 'Contact';
      const lastName = names.slice(1).join(' ') || companyName;

      await this.prisma.clientContact.create({
        data: {
          clientId: client.id,
          firstName,
          lastName,
          email: dto.email || null,
          phone: dto.phone || null,
          position: 'Directeur',
          isPrimary: true,
        },
      });
    }

    return {
      ...client,
      name: client.companyName,
      email: dto.email || null,
      phone: dto.phone || null,
      status: client.isActive ? 'ACTIVE' : 'INACTIVE',
    };
  }

  async updateClient(id: string, dto: UpdateClientDto) {
    const existing = await this.findClientById(id);
    const companyName = dto.companyName || dto.company || dto.name;
    const { name, email, phone, company, status, isActive, ...rest } = dto;

    let resolvedIsActive = isActive;
    if (resolvedIsActive === undefined && status !== undefined) {
      resolvedIsActive = status === 'ACTIVE';
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data: {
        ...rest,
        ...(companyName && { companyName }),
        ...(resolvedIsActive !== undefined && { isActive: resolvedIsActive }),
      },
    });

    if (email !== undefined || phone !== undefined || name !== undefined) {
      const primaryContact = await this.prisma.clientContact.findFirst({
        where: { clientId: id, isPrimary: true },
      });

      if (primaryContact) {
        await this.prisma.clientContact.update({
          where: { id: primaryContact.id },
          data: {
            ...(email !== undefined && { email: email || null }),
            ...(phone !== undefined && { phone: phone || null }),
            ...(name !== undefined && {
              firstName: name.split(' ')[0] || 'Contact',
              lastName: name.split(' ').slice(1).join(' ') || updated.companyName,
            }),
          },
        });
      } else {
        const contactName = name || existing.name || 'Contact';
        await this.prisma.clientContact.create({
          data: {
            clientId: id,
            firstName: contactName.split(' ')[0] || 'Contact',
            lastName: contactName.split(' ').slice(1).join(' ') || updated.companyName,
            email: email || null,
            phone: phone || null,
            position: 'Directeur',
            isPrimary: true,
          },
        });
      }
    }

    const finalClient = await this.findClientById(id);
    return finalClient;
  }

  async deleteClient(id: string) {
    await this.findClientById(id);
    return this.prisma.client.update({
      where: { id },
      data: { isArchived: true, isActive: false, deletedAt: new Date() },
    });
  }

  async restoreClient(id: string) {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) throw new NotFoundException(`Client with ID "${id}" not found`);
    return this.prisma.client.update({
      where: { id },
      data: { isArchived: false, isActive: true, deletedAt: null },
    });
  }

  // ─── Client Contacts ─────────────────────────────────────────────────────────

  async getClientContacts(clientId: string) {
    await this.findClientById(clientId);
    return this.prisma.clientContact.findMany({
      where: { clientId },
      orderBy: { isPrimary: 'desc' },
    });
  }

  async addClientContact(clientId: string, dto: CreateClientContactDto) {
    await this.findClientById(clientId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.clientContact.updateMany({ where: { clientId, isPrimary: true }, data: { isPrimary: false } });
      }
      return tx.clientContact.create({
        data: {
          clientId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          position: dto.position,
          isPrimary: dto.isPrimary || false,
        },
      });
    });
  }

  async updateClientContact(contactId: string, dto: Partial<CreateClientContactDto>) {
    const contact = await this.prisma.clientContact.findUnique({ where: { id: contactId } });
    if (!contact) throw new NotFoundException(`Client contact "${contactId}" not found`);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary && !contact.isPrimary) {
        await tx.clientContact.updateMany({ where: { clientId: contact.clientId, isPrimary: true }, data: { isPrimary: false } });
      }
      return tx.clientContact.update({ where: { id: contactId }, data: { ...dto } });
    });
  }

  async deleteClientContact(contactId: string) {
    const contact = await this.prisma.clientContact.findUnique({ where: { id: contactId } });
    if (!contact) throw new NotFoundException(`Client contact "${contactId}" not found`);
    return this.prisma.clientContact.delete({ where: { id: contactId } });
  }
}
