import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BaseCrudService } from '../../common/base-crud.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { QuoteStatus, InvoiceStatus, Prisma } from '@prisma/client';
import { QueryQuotesDto } from './dto/query-quotes.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { paginate, getPaginationParams } from '../../core/dto/paginated-response';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../notifications/email.service';
import { PdfService } from '../document/pdf.service';

@Injectable()
export class FinanceService extends BaseCrudService<any> {
  constructor(
    prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly pdfService: PdfService,
  ) {
    super(prisma);
  }

  async generateQuoteReference(tx?: Prisma.TransactionClient): Promise<string> {
    const prismaClient = tx || this.prisma;
    const currentYear = new Date().getFullYear();
    const prefix = `QUO-${currentYear}-`;
    const latestQuote = await prismaClient.quote.findFirst({
      where: {
        reference: {
          startsWith: prefix,
        },
      },
      orderBy: {
        reference: 'desc',
      },
      select: {
        reference: true,
      },
    });

    let nextNum = 1;
    if (latestQuote) {
      const parts = latestQuote.reference.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextNum = lastSeq + 1;
      }
    }
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }

  async generateInvoiceReference(tx?: Prisma.TransactionClient): Promise<string> {
    const prismaClient = tx || this.prisma;
    const currentYear = new Date().getFullYear();
    const prefix = `INV-${currentYear}-`;
    const latestInvoice = await prismaClient.invoice.findFirst({
      where: {
        reference: {
          startsWith: prefix,
        },
      },
      orderBy: {
        reference: 'desc',
      },
      select: {
        reference: true,
      },
    });

    let nextNum = 1;
    if (latestInvoice) {
      const parts = latestInvoice.reference.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextNum = lastSeq + 1;
      }
    }
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }

  // ─── Quotes ──────────────────────────────────────────────────────────────────

  async findAllQuotes(query: QueryQuotesDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      clientId,
      dateFrom,
      dateTo,
      isArchived = false,
    } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const where: Prisma.QuoteWhereInput = {
      isArchived,
      ...(status && { status }),
      ...(clientId && { clientId }),
      ...((dateFrom || dateTo) && {
        issueDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
      ...(search && {
        reference: { contains: search, mode: 'insensitive' },
      }),
    };

    const validSortFields: Record<string, keyof Prisma.QuoteOrderByWithRelationInput> = {
      createdAt: 'createdAt',
      issueDate: 'issueDate',
      total: 'total',
    };
    const orderBy: Prisma.QuoteOrderByWithRelationInput = {
      [validSortFields[sortBy] ?? 'createdAt']: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.quote.findMany({
        where,
        skip,
        take,
        include: {
          client: { select: { id: true, companyName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          invoice: { select: { id: true } },
        },
        orderBy,
      }),
      this.prisma.quote.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findQuoteById(id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: {
        client: true,
        project: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: true,
        invoice: true,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID "${id}" not found`);
    }

    return quote;
  }

  async createQuote(dto: CreateQuoteDto, creatorId: string) {
    const reference = await this.generateQuoteReference();
    const taxRate = 19.0; // default 19%

    // Calculate totals
    let subtotal = 0;
    const itemsData = dto.items.map((item) => {
      const discount = item.discount || 0;
      const total = item.quantity * item.unitPrice * (1 - discount / 100);
      subtotal += total;
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount,
        total,
      };
    });

    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    return this.prisma.quote.create({
      data: {
        reference,
        clientId: dto.clientId,
        projectId: dto.projectId,
        createdById: creatorId,
        status: QuoteStatus.DRAFT,
        validUntil: new Date(dto.validUntil),
        currency: dto.currency || 'TND',
        subtotal,
        taxRate,
        taxAmount,
        total,
        notes: dto.notes,
        items: {
          create: itemsData,
        },
      },
      include: {
        items: true,
      },
    });
  }

  async updateQuote(id: string, dto: UpdateQuoteDto) {
    const quote = await this.findQuoteById(id);

    if (quote.status !== QuoteStatus.DRAFT && dto.status === undefined) {
      throw new BadRequestException('Only quotes in DRAFT status can be modified.');
    }

    let subtotal = Number(quote.subtotal);
    let taxAmount = Number(quote.taxAmount);
    let total = Number(quote.total);
    const taxRate = 19.0; // default 19%

    let itemsData: any[] | undefined = undefined;

    if (dto.items) {
      subtotal = 0;
      itemsData = dto.items.map((item) => {
        const discount = item.discount || 0;
        const itemTotal = item.quantity * item.unitPrice * (1 - discount / 100);
        subtotal += itemTotal;
        return {
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount,
          total: itemTotal,
        };
      });
      taxAmount = subtotal * (taxRate / 100);
      total = subtotal + taxAmount;
    }

    return this.prisma.$transaction(async (tx) => {
      if (itemsData !== undefined) {
        await tx.quoteItem.deleteMany({
          where: { quoteId: id },
        });
      }

      const updated = await tx.quote.update({
        where: { id },
        data: {
          ...(dto.clientId && { clientId: dto.clientId }),
          ...(dto.projectId !== undefined && { projectId: dto.projectId }),
          ...(dto.validUntil && { validUntil: new Date(dto.validUntil) }),
          ...(dto.currency && { currency: dto.currency }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.terms !== undefined && { terms: dto.terms }),
          ...(dto.status && { status: dto.status }),
          ...(itemsData !== undefined && {
            subtotal,
            taxAmount,
            total,
            items: {
              create: itemsData,
            },
          }),
        },
        include: {
          items: true,
        },
      });

      // If quote is approved/accepted, generate project and invoice if not already present
      if (dto.status === QuoteStatus.APPROVED || dto.status === QuoteStatus.ACCEPTED) {
        let projectId = updated.projectId;
        if (!projectId) {
          let projectCode = '[PRJ-001]';
          const latestProject = await tx.project.findFirst({
            where: {
              name: {
                startsWith: '[PRJ-',
              },
            },
            orderBy: {
              name: 'desc',
            },
            select: {
              name: true,
            },
          });

          if (latestProject && latestProject.name) {
            const match = latestProject.name.match(/^\[PRJ-(\d+)\]/);
            if (match) {
              const lastSeq = parseInt(match[1], 10);
              if (!isNaN(lastSeq)) {
                projectCode = `[PRJ-${String(lastSeq + 1).padStart(3, '0')}]`;
              }
            }
          }

          const project = await tx.project.create({
            data: {
              name: `${projectCode} Projet - ${updated.reference}`,
              description: `Généré automatiquement à partir de l'approbation du devis ${updated.reference}. Notes: ${updated.notes || ''}`,
              status: 'PLANNING',
              clientId: updated.clientId,
              budget: updated.total,
              currency: updated.currency,
            },
          });
          projectId = project.id;

          // Update quote with new project ID
          await tx.quote.update({
            where: { id },
            data: { projectId },
          });
        }

        // Check if invoice already exists
        const existingInvoice = await tx.invoice.findFirst({
          where: { quoteId: id },
        });

        if (!existingInvoice) {
          const invoiceReference = await this.generateInvoiceReference(tx);
          const taxRate = 19.0;
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 30); // 30 days payment term

          const itemsDataQuote = updated.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            total: item.total,
          }));

          await tx.invoice.create({
            data: {
              reference: invoiceReference,
              clientId: updated.clientId,
              quoteId: updated.id,
              projectId: projectId,
              createdById: updated.createdById,
              status: InvoiceStatus.DRAFT,
              dueDate: dueDate,
              currency: updated.currency,
              subtotal: updated.subtotal,
              taxRate: taxRate,
              taxAmount: updated.taxAmount,
              total: updated.total,
              notes: updated.notes,
              items: {
                create: itemsDataQuote,
              },
            },
          });
        }
      }

      return updated;
    });
  }

  async convertQuoteToInvoice(quoteId: string, creatorId: string) {
    const quote = await this.findQuoteById(quoteId);
    if (quote.invoice) {
      throw new BadRequestException('Une facture existe déjà pour ce devis.');
    }
    if (quote.status === QuoteStatus.DRAFT || quote.status === QuoteStatus.REJECTED) {
      throw new BadRequestException('Ce devis doit être approuvé ou accepté avant d\'être converti.');
    }

    const taxRate = 19.0;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days payment term

    const itemsData = quote.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount || 0),
      total: Number(item.total),
    }));

    let projectId = quote.projectId;
    return this.prisma.$transaction(async (tx) => {
      // Create project if it doesn't exist
      if (!projectId) {
        let projectCode = '[PRJ-001]';
        const latestProject = await tx.project.findFirst({
          where: {
            name: {
              startsWith: '[PRJ-',
            },
          },
          orderBy: {
            name: 'desc',
          },
          select: {
            name: true,
          },
        });

        if (latestProject && latestProject.name) {
          const match = latestProject.name.match(/^\[PRJ-(\d+)\]/);
          if (match) {
            const lastSeq = parseInt(match[1], 10);
            if (!isNaN(lastSeq)) {
              projectCode = `[PRJ-${String(lastSeq + 1).padStart(3, '0')}]`;
            }
          }
        }

        const project = await tx.project.create({
          data: {
            name: `${projectCode} Projet - ${quote.reference}`,
            description: `Généré automatiquement à partir de la conversion du devis ${quote.reference}. Notes: ${quote.notes || ''}`,
            status: 'PLANNING',
            clientId: quote.clientId,
            budget: quote.total,
            currency: quote.currency,
          },
        });
        projectId = project.id;
      }

      const invoiceReference = await this.generateInvoiceReference(tx);
      const invoice = await tx.invoice.create({
        data: {
          reference: invoiceReference,
          clientId: quote.clientId,
          quoteId: quote.id,
          projectId: projectId,
          createdById: creatorId,
          status: InvoiceStatus.DRAFT,
          dueDate: dueDate,
          currency: quote.currency,
          subtotal: quote.subtotal,
          taxRate,
          taxAmount: quote.taxAmount,
          total: quote.total,
          notes: quote.notes,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: true,
        },
      });

      await tx.quote.update({
        where: { id: quoteId },
        data: {
          status: QuoteStatus.ACCEPTED,
          projectId: projectId,
        },
      });

      return invoice;
    });
  }

  async deleteQuote(id: string) {
    await this.findQuoteById(id);
    return this.prisma.quote.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
  }

  async restoreQuote(id: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id } });
    if (!quote) {
      throw new NotFoundException(`Quote with ID "${id}" not found`);
    }
    return this.prisma.quote.update({
      where: { id },
      data: { isArchived: false, deletedAt: null },
    });
  }

  // ─── Invoices ────────────────────────────────────────────────────────────────

  async findAllInvoices(query: QueryInvoicesDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      clientId,
      overdue,
      isArchived = false,
    } = query;
    const { skip, take } = getPaginationParams(page, limit);

    const where: Prisma.InvoiceWhereInput = {
      isArchived,
      ...(status && { status }),
      ...(clientId && { clientId }),
      ...(overdue && {
        dueDate: { lt: new Date() },
        status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED] },
      }),
      ...(search && {
        reference: { contains: search, mode: 'insensitive' },
      }),
    };

    const validSortFields: Record<string, keyof Prisma.InvoiceOrderByWithRelationInput> = {
      createdAt: 'createdAt',
      dueDate: 'dueDate',
      total: 'total',
    };
    const orderBy: Prisma.InvoiceOrderByWithRelationInput = {
      [validSortFields[sortBy] ?? 'createdAt']: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        include: {
          client: { select: { id: true, companyName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findInvoiceById(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        quote: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        items: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID "${id}" not found`);
    }

    return invoice;
  }

  async createInvoice(dto: CreateInvoiceDto, creatorId: string) {
    const taxRate = 19.0; // default 19%

    let subtotal = 0;
    let itemsData: any[] = [];
    let projectId = dto.projectId;

    if (dto.quoteId) {
      const quote = await this.findQuoteById(dto.quoteId);
      if (quote.invoice) {
        throw new BadRequestException('Invoice already exists for this quote.');
      }
      if (quote.status !== QuoteStatus.APPROVED && quote.status !== QuoteStatus.ACCEPTED) {
        throw new BadRequestException('Only approved or accepted quotes can be used to generate invoices.');
      }
      projectId = projectId || quote.projectId;
      subtotal = Number(quote.subtotal);
      itemsData = quote.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        total: item.total,
      }));
    } else if (dto.items) {
      itemsData = dto.items.map((item) => {
        const discount = item.discount || 0;
        const total = item.quantity * item.unitPrice * (1 - discount / 100);
        subtotal += total;
        return {
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount,
          total,
        };
      });
    } else {
      throw new BadRequestException('Provide items or quoteId to create invoice.');
    }

    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    return this.prisma.$transaction(async (tx) => {
      const reference = await this.generateInvoiceReference(tx);
      const invoice = await tx.invoice.create({
        data: {
          reference,
          clientId: dto.clientId,
          quoteId: dto.quoteId,
          projectId,
          createdById: creatorId,
          status: InvoiceStatus.DRAFT,
          dueDate: new Date(dto.dueDate),
          currency: dto.currency || 'TND',
          subtotal,
          taxRate,
          taxAmount,
          total,
          notes: dto.notes,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: true,
        },
      });

      if (dto.quoteId) {
        await tx.quote.update({
          where: { id: dto.quoteId },
          data: { status: QuoteStatus.ACCEPTED },
        });
      }

      return invoice;
    }).then(async (invoice) => {
      try {
        const fullInvoice = await this.prisma.invoice.findUnique({
          where: { id: invoice.id },
          include: { client: true, items: true },
        });
        if (fullInvoice) {
          await this.pdfService.generateAndArchiveInvoicePdf(fullInvoice);
        }
      } catch (err) {
        console.error('Error generating PDF on createInvoice:', err);
      }
      return invoice;
    });
  }

  async updateInvoiceStatus(id: string, status: InvoiceStatus) {
    await this.findInvoiceById(id);
    return this.prisma.invoice.update({
      where: { id },
      data: { status },
    });
  }

  async updateInvoice(id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findInvoiceById(id);

    let subtotal = Number(invoice.subtotal);
    let taxAmount = Number(invoice.taxAmount);
    let total = Number(invoice.total);
    const taxRate = 19.0; // default 19%

    let itemsData: any[] | undefined = undefined;

    if (dto.items) {
      subtotal = 0;
      itemsData = dto.items.map((item) => {
        const discount = item.discount || 0;
        const itemTotal = item.quantity * item.unitPrice * (1 - discount / 100);
        subtotal += itemTotal;
        return {
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount,
          total: itemTotal,
        };
      });
      taxAmount = subtotal * (taxRate / 100);
      total = subtotal + taxAmount;
    }

    return this.prisma.$transaction(async (tx) => {
      if (itemsData !== undefined) {
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: id },
        });
      }

      return tx.invoice.update({
        where: { id },
        data: {
          ...(dto.clientId && { clientId: dto.clientId }),
          ...(dto.projectId && { projectId: dto.projectId }),
          ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
          ...(dto.currency && { currency: dto.currency }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.status && { status: dto.status }),
          ...(itemsData !== undefined && {
            subtotal,
            taxAmount,
            total,
            items: {
              create: itemsData,
            },
          }),
        },
        include: {
          items: true,
        },
      });
    });
  }

  async deleteInvoice(id: string) {
    await this.findInvoiceById(id);
    return this.prisma.invoice.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
  }

  async restoreInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID "${id}" not found`);
    }
    return this.prisma.invoice.update({
      where: { id },
      data: { isArchived: false, deletedAt: null },
    });
  }

  // ─── Payments ────────────────────────────────────────────────────────────────

  async getPaymentsForInvoice(invoiceId: string) {
    await this.findInvoiceById(invoiceId);
    return this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { paidAt: 'desc' },
    });
  }

  async addPayment(invoiceId: string, dto: CreatePaymentDto) {
    const invoice = await this.findInvoiceById(invoiceId);

    const paidAmount = Number(invoice.paidAmount) + dto.amount;
    const total = Number(invoice.total);

    let status = invoice.status;
    if (paidAmount >= total) {
      status = InvoiceStatus.PAID;
    } else if (paidAmount > 0) {
      status = InvoiceStatus.PARTIALLY_PAID;
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: dto.amount,
          currency: dto.currency || 'TND',
          method: dto.method,
          paidAt: new Date(dto.paidAt),
          reference: dto.reference,
          notes: dto.notes,
        },
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount,
          status,
        },
      });

      return payment;
    });
  }

  // ─── Expenses ────────────────────────────────────────────────────────────────

  async findAllExpenses(query: QueryExpensesDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'expenseDate',
      sortOrder = 'desc',
      categoryId,
      status,
      isApproved,
      dateFrom,
      dateTo,
      isArchived = false,
    } = query;
    const { skip, take } = getPaginationParams(page, limit);

    let isApprovedFilter = isApproved;
    if (status !== undefined) {
      if (status === 'APPROVED') {
        isApprovedFilter = true;
      } else if (status === 'REJECTED') {
        isApprovedFilter = false;
      } else if (status === 'PENDING') {
        isApprovedFilter = null;
      }
    }

    const where: Prisma.ExpenseWhereInput = {
      isArchived,
      ...(categoryId && { categoryId }),
      ...(isApprovedFilter !== undefined && { isApproved: isApprovedFilter }),
      ...((dateFrom || dateTo) && {
        expenseDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
      ...(search && {
        description: { contains: search, mode: 'insensitive' },
      }),
    };

    const validSortFields: Record<string, keyof Prisma.ExpenseOrderByWithRelationInput> = {
      createdAt: 'createdAt',
      expenseDate: 'expenseDate',
      amount: 'amount',
    };
    const orderBy: Prisma.ExpenseOrderByWithRelationInput = {
      [validSortFields[sortBy] ?? 'expenseDate']: sortOrder,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        skip,
        take,
        include: {
          category: true,
          submittedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy,
      }),
      this.prisma.expense.count({ where }),
    ]);

    const mappedData = data.map((exp) => {
      let expenseStatus: 'APPROVED' | 'REJECTED' | 'PENDING' = 'PENDING';
      if (exp.isApproved === true) {
        expenseStatus = 'APPROVED';
      } else if (exp.isApproved === false) {
        expenseStatus = 'REJECTED';
      }
      return {
        ...exp,
        status: expenseStatus,
      };
    });

    return paginate(mappedData, total, page, limit);
  }

  async deleteExpense(id: string) {
    await this.findExpenseById(id);
    return this.prisma.expense.update({
      where: { id },
      data: { isArchived: true, deletedAt: new Date() },
    });
  }

  async restoreExpense(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new NotFoundException(`Expense with ID "${id}" not found`);
    }
    return this.prisma.expense.update({
      where: { id },
      data: { isArchived: false, deletedAt: null },
    });
  }

  async findExpenseById(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        category: true,
        submittedBy: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        approvalWorkflow: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!expense) {
      throw new NotFoundException(`Expense with ID "${id}" not found`);
    }

    let status: 'APPROVED' | 'REJECTED' | 'PENDING' = 'PENDING';
    if (expense.isApproved === true) {
      status = 'APPROVED';
    } else if (expense.isApproved === false) {
      status = 'REJECTED';
    }

    return { ...expense, status };
  }

  async createExpense(dto: CreateExpenseDto, submitterId: string) {
    const expense = await this.prisma.expense.create({
      data: {
        categoryId: dto.categoryId,
        submittedById: submitterId,
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency || 'TND',
        expenseDate: new Date(dto.expenseDate),
        receiptUrl: dto.receiptUrl,
        notes: dto.notes,
        projectId: dto.projectId,
        departmentId: dto.departmentId,
      },
    });

    return { ...expense, status: 'PENDING' as const };
  }

  async updateExpense(id: string, dto: UpdateExpenseDto) {
    const expense = await this.findExpenseById(id);

    if (expense.status !== 'PENDING') {
      throw new BadRequestException('Seules les dépenses en attente (PENDING) peuvent être modifiées.');
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.description && { description: dto.description }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.expenseDate && { expenseDate: new Date(dto.expenseDate) }),
        ...(dto.receiptUrl !== undefined && { receiptUrl: dto.receiptUrl }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.projectId !== undefined && { projectId: dto.projectId }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
      },
    });

    let status: 'APPROVED' | 'REJECTED' | 'PENDING' = 'PENDING';
    if (updated.isApproved === true) {
      status = 'APPROVED';
    } else if (updated.isApproved === false) {
      status = 'REJECTED';
    }

    return { ...updated, status };
  }

  async approveExpense(expenseId: string, approvedById: string, isApproved: boolean) {
    await this.findExpenseById(expenseId);

    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.update({
        where: { id: expenseId },
        data: {
          isApproved,
          approvedById,
        },
      });

      if (isApproved && expense.departmentId) {
        const dept = await tx.department.findUnique({
          where: { id: expense.departmentId },
        });
        if (dept && dept.budget !== null) {
          const newBudget = Number(dept.budget) - Number(expense.amount);
          await tx.department.update({
            where: { id: expense.departmentId },
            data: { budget: new Prisma.Decimal(newBudget) },
          });
        }
      }

      await tx.expenseApprovalWorkflow.create({
        data: {
          expenseId,
          userId: approvedById,
          status: isApproved ? 'APPROVED' : 'REJECTED',
          notes: isApproved
            ? 'Approuvé par le gérant/responsable financier.'
            : 'Rejeté par le gérant/responsable financier.',
        },
      });

      return {
        ...expense,
        status: isApproved ? ('APPROVED' as const) : ('REJECTED' as const),
      };
    });
  }

  // ─── Expense Categories ──────────────────────────────────────────────────────

  async findAllCategories() {
    return this.prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(dto: CreateExpenseCategoryDto) {
    const exists = await this.prisma.expenseCategory.findUnique({
      where: { name: dto.name },
    });

    if (exists) {
      throw new BadRequestException(`Category with name "${dto.name}" already exists`);
    }

    return this.prisma.expenseCategory.create({
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async sendInvoiceReminder(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: {
          include: {
            contacts: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID "${invoiceId}" not found`);
    }

    const primaryContact = invoice.client.contacts.find((c) => c.isPrimary) || invoice.client.contacts[0];
    const email = primaryContact?.email || 'billing@client.com';
    const recipientName = primaryContact ? `${primaryContact.firstName} ${primaryContact.lastName}` : invoice.client.companyName;

    const emailHtml = `
      <h3>Invoice Reminder: ${invoice.reference}</h3>
      <p>Dear ${recipientName},</p>
      <p>This is a friendly reminder that invoice <strong>${invoice.reference}</strong> for the total amount of <strong>${Number(invoice.total).toFixed(2)} ${invoice.currency}</strong> is currently pending payment. The due date was <strong>${new Date(invoice.dueDate).toLocaleDateString()}</strong>.</p>
      <p>Please arrange the bank transfer at your earliest convenience. If you have already processed the payment, please ignore this email.</p>
      <hr/>
      <p>Best regards,<br/>AgencyOS Billing Team</p>
    `;

    try {
      await this.emailService.sendMail(email, `Overdue Invoice Reminder: ${invoice.reference}`, emailHtml);
    } catch (err) {
      // Allow local console logs to capture it if SMTP isn't set up
    }

    await this.notificationsService.createNotification(
      invoice.createdById,
      'SYSTEM',
      `Sent reminder for Invoice ${invoice.reference}`,
      `Invoice reminder successfully sent to client: ${recipientName} (${email}).`,
    );

    return { success: true, emailSentTo: email };
  }

  async sendQuoteReminder(quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        client: {
          include: {
            contacts: true,
          },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID "${quoteId}" not found`);
    }

    const primaryContact = quote.client.contacts.find((c) => c.isPrimary) || quote.client.contacts[0];
    const email = primaryContact?.email || 'contact@client.com';
    const recipientName = primaryContact ? `${primaryContact.firstName} ${primaryContact.lastName}` : quote.client.companyName;

    const emailHtml = `
      <h3>Proposal Reminder: ${quote.reference}</h3>
      <p>Dear ${recipientName},</p>
      <p>We hope you are doing well. We are writing to follow up on our business proposal <strong>${quote.reference}</strong> for the total amount of <strong>${Number(quote.total).toFixed(2)} ${quote.currency}</strong>.</p>
      <p>Please note that this proposal remains valid until <strong>${new Date(quote.validUntil).toLocaleDateString()}</strong>. If you require any clarifications or adjustments, we are at your disposal.</p>
      <hr/>
      <p>Best regards,<br/>AgencyOS Sales Team</p>
    `;

    try {
      await this.emailService.sendMail(email, `Proposal Reminder: ${quote.reference}`, emailHtml);
    } catch (err) {
      // Handled
    }

    await this.notificationsService.createNotification(
      quote.createdById,
      'SYSTEM',
      `Sent reminder for Quote ${quote.reference}`,
      `Quote proposal reminder successfully sent to client: ${recipientName} (${email}).`,
    );

    return { success: true, emailSentTo: email };
  }

  // ─── Quote Approval Workflow ─────────────────────────────────────────────────

  async submitQuoteForApproval(id: string, userId: string) {
    const quote = await this.findQuoteById(id);
    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT quotes can be submitted for approval.');
    }
    const updated = await this.prisma.quote.update({
      where: { id },
      data: { status: QuoteStatus.PENDING_APPROVAL },
    });
    // Notify all CEO users
    const ceoUsers = await this.prisma.user.findMany({ where: { role: { name: 'GERANT' } }, select: { id: true } });
    for (const ceo of ceoUsers) {
      await this.notificationsService.createNotification(
        ceo.id,
        'SYSTEM',
        `Quote ${quote.reference} Pending Approval`,
        `A new quote requires your approval.`,
      );
    }
    return updated;
  }

  async approveQuote(id: string, approverId: string) {
    const quote = await this.findQuoteById(id);
    if (quote.status !== QuoteStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only PENDING_APPROVAL quotes can be approved.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const invoiceReference = await this.generateInvoiceReference(tx);
      const taxRate = 19.0;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // 30 days payment term

      let projectId = quote.projectId;
      if (!projectId) {
        let projectCode = '[PRJ-001]';
        const latestProject = await tx.project.findFirst({
          where: {
            name: {
              startsWith: '[PRJ-',
            },
          },
          orderBy: {
            name: 'desc',
          },
          select: {
            name: true,
          },
        });

        if (latestProject && latestProject.name) {
          const match = latestProject.name.match(/^\[PRJ-(\d+)\]/);
          if (match) {
            const lastSeq = parseInt(match[1], 10);
            if (!isNaN(lastSeq)) {
              projectCode = `[PRJ-${String(lastSeq + 1).padStart(3, '0')}]`;
            }
          }
        }

        const project = await tx.project.create({
          data: {
            name: `${projectCode} Projet - ${quote.reference}`,
            description: `Généré automatiquement à partir de l'approbation du devis ${quote.reference}. Notes: ${quote.notes || ''}`,
            status: 'PLANNING',
            clientId: quote.clientId,
            budget: quote.total,
            currency: quote.currency,
          },
        });
        projectId = project.id;
      }

      const u = await tx.quote.update({
        where: { id },
        data: { 
          status: QuoteStatus.APPROVED as QuoteStatus,
          projectId: projectId,
        },
      });

      await tx.quoteApprovalHistory.create({
        data: {
          quoteId: id,
          userId: approverId,
          status: 'APPROVED',
          notes: 'Approbation automatique de devis et génération de facture.',
        },
      });

      // Check if invoice already exists to avoid duplicate invoices
      const existingInvoice = await tx.invoice.findFirst({
        where: { quoteId: id },
      });

      if (!existingInvoice) {
        const itemsData = quote.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          total: item.total,
        }));

        await tx.invoice.create({
          data: {
            reference: invoiceReference,
            clientId: quote.clientId,
            quoteId: quote.id,
            projectId: projectId,
            createdById: quote.createdById,
            status: InvoiceStatus.DRAFT,
            dueDate: dueDate,
            currency: quote.currency,
            subtotal: quote.subtotal,
            taxRate: taxRate,
            taxAmount: quote.taxAmount,
            total: quote.total,
            notes: quote.notes,
            items: {
              create: itemsData,
            },
          },
        });
      }

      return u;
    });

    await this.notificationsService.createNotification(
      quote.createdById,
      'SYSTEM',
      `Quote ${quote.reference} Approved`,
      `Your quote has been approved and a draft invoice has been generated automatically.`,
    );
    return updated;
  }

  async rejectQuote(id: string, approverId: string, reason?: string) {
    const quote = await this.findQuoteById(id);
    if (quote.status !== QuoteStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only PENDING_APPROVAL quotes can be rejected.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.quote.update({
        where: { id },
        data: { status: QuoteStatus.REJECTED, notes: reason ? `[REJECTED] ${reason}` : quote.notes },
      });

      await tx.quoteApprovalHistory.create({
        data: {
          quoteId: id,
          userId: approverId,
          status: 'REJECTED',
          notes: reason || 'Rejeté par le gérant',
        },
      });

      return u;
    });

    await this.notificationsService.createNotification(
      quote.createdById,
      'SYSTEM',
      `Quote ${quote.reference} Rejected`,
      reason || 'Your quote has been rejected. Please review and revise.',
    );
    return updated;
  }

  // ─── Invoice Approval Workflow ───────────────────────────────────────────────

  async submitInvoiceForApproval(id: string, userId: string) {
    const invoice = await this.findInvoiceById(id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT invoices can be submitted for approval.');
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.PENDING_APPROVAL },
    });
    const ceoUsers = await this.prisma.user.findMany({ where: { role: { name: 'GERANT' } }, select: { id: true } });
    for (const ceo of ceoUsers) {
      await this.notificationsService.createNotification(
        ceo.id,
        'SYSTEM',
        `Invoice ${invoice.reference} Pending Approval`,
        `A new invoice requires your approval.`,
      );
    }
    return updated;
  }

  async approveInvoice(id: string, approverId: string) {
    const invoice = await this.findInvoiceById(id);
    if (invoice.status !== InvoiceStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only PENDING_APPROVAL invoices can be approved.');
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.APPROVED },
    });
    
    // Auto generate and archive PDF on validation (approval)
    try {
      const fullInvoice = await this.prisma.invoice.findUnique({
        where: { id },
        include: { client: true, items: true },
      });
      if (fullInvoice) {
        await this.pdfService.generateAndArchiveInvoicePdf(fullInvoice);
      }
    } catch (err) {
      console.error('Error generating PDF on approveInvoice:', err);
    }

    await this.notificationsService.createNotification(
      invoice.createdById,
      'SYSTEM',
      `Invoice ${invoice.reference} Approved`,
      `Your invoice has been approved and is ready to be sent to the client.`,
    );
    return updated;
  }

  async rejectInvoice(id: string, approverId: string, reason?: string) {
    const invoice = await this.findInvoiceById(id);
    if (invoice.status !== InvoiceStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only PENDING_APPROVAL invoices can be rejected.');
    }
    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.REJECTED, notes: reason ? `[REJECTED] ${reason}` : invoice.notes },
    });
    await this.notificationsService.createNotification(
      invoice.createdById,
      'SYSTEM',
      `Invoice ${invoice.reference} Rejected`,
      reason || 'Your invoice has been rejected. Please review and revise.',
    );
    return updated;
  }

  // ─── Dashboard & Analytics ────────────────────────────────────────────────────

  async getDashboardKPIs() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      totalRevenueResult,
      totalExpensesResult,
      outstandingResult,
      pendingQuotesCount,
      pendingApprovalsCount,
      monthlyRevenueResult,
      monthlyExpensesResult,
      totalInvoicesCount,
      paidInvoicesCount,
      overdueInvoicesCount,
    ] = await this.prisma.$transaction([
      // Total revenue (sum of paid amounts on all invoices)
      this.prisma.invoice.aggregate({
        _sum: { paidAmount: true },
        where: { status: { in: [InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID] } },
      }),
      // Total expenses (approved)
      this.prisma.expense.aggregate({
        _sum: { amount: true },
        where: { isApproved: true },
      }),
      // Outstanding invoices (sent but not fully paid)
      this.prisma.invoice.aggregate({
        _sum: { total: true },
        _count: true,
        where: { status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE, InvoiceStatus.APPROVED] } },
      }),
      // Pending quotes
      this.prisma.quote.count({ where: { status: QuoteStatus.PENDING_APPROVAL } }),
      // Pending invoice approvals
      this.prisma.invoice.count({ where: { status: { in: [InvoiceStatus.PENDING_APPROVAL] } } }),
      // Monthly revenue
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { paidAt: { gte: startOfMonth, lte: endOfMonth } },
      }),
      // Monthly expenses
      this.prisma.expense.aggregate({
        _sum: { amount: true },
        where: { isApproved: true, expenseDate: { gte: startOfMonth, lte: endOfMonth } },
      }),
      // Total invoices count
      this.prisma.invoice.count(),
      // Paid invoices count
      this.prisma.invoice.count({ where: { status: InvoiceStatus.PAID } }),
      // Overdue invoices
      this.prisma.invoice.count({
        where: { dueDate: { lt: now }, status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED] } },
      }),
    ]);

    const totalRevenue = Number(totalRevenueResult._sum.paidAmount ?? 0);
    const totalExpenses = Number(totalExpensesResult._sum.amount ?? 0);
    const netProfit = totalRevenue - totalExpenses;
    const outstandingAmount = Number(outstandingResult._sum.total ?? 0);
    const monthlyRevenue = Number(monthlyRevenueResult._sum.amount ?? 0);
    const monthlyExpenses = Number(monthlyExpensesResult._sum.amount ?? 0);
    const monthlyCashFlow = monthlyRevenue - monthlyExpenses;

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      outstandingInvoices: {
        count: outstandingResult._count,
        amount: outstandingAmount,
      },
      pendingQuotes: pendingQuotesCount,
      pendingApprovals: pendingApprovalsCount + pendingQuotesCount,
      monthlyCashFlow,
      monthlyRevenue,
      monthlyExpenses,
      totalInvoices: totalInvoicesCount,
      paidInvoices: paidInvoicesCount,
      overdueInvoices: overdueInvoicesCount,
      collectionRate: totalInvoicesCount > 0
        ? Math.round((paidInvoicesCount / totalInvoicesCount) * 100)
        : 0,
    };
  }

  async getRevenueTrend() {
    const months: { month: string; revenue: number; invoiceCount: number }[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const label = start.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

      const [paymentsAgg, invoiceCount] = await this.prisma.$transaction([
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: { paidAt: { gte: start, lte: end } },
        }),
        this.prisma.invoice.count({
          where: { status: InvoiceStatus.PAID, updatedAt: { gte: start, lte: end } },
        }),
      ]);

      months.push({
        month: label,
        revenue: Number(paymentsAgg._sum.amount ?? 0),
        invoiceCount,
      });
    }

    return months;
  }

  async getExpenseBreakdown() {
    const categories = await this.prisma.expenseCategory.findMany({
      include: {
        expenses: {
          where: { isApproved: true },
          select: { amount: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const breakdown = categories.map((cat) => {
      const total = cat.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        total,
        count: cat.expenses.length,
      };
    });

    const grandTotal = breakdown.reduce((sum, b) => sum + b.total, 0);

    return {
      categories: breakdown.map((b) => ({
        ...b,
        percentage: grandTotal > 0 ? Math.round((b.total / grandTotal) * 100) : 0,
      })),
      grandTotal,
    };
  }

  async getCashFlow() {
    const months: { month: string; revenue: number; expenses: number; net: number }[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const label = start.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

      const [revAgg, expAgg] = await this.prisma.$transaction([
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: { paidAt: { gte: start, lte: end } },
        }),
        this.prisma.expense.aggregate({
          _sum: { amount: true },
          where: { isApproved: true, expenseDate: { gte: start, lte: end } },
        }),
      ]);

      const revenue = Number(revAgg._sum.amount ?? 0);
      const expenses = Number(expAgg._sum.amount ?? 0);

      months.push({ month: label, revenue, expenses, net: revenue - expenses });
    }

    return months;
  }

  async getInvoiceAging() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const unpaidStatuses: InvoiceStatus[] = [
      InvoiceStatus.SENT,
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.OVERDUE,
      InvoiceStatus.APPROVED,
    ];

    const [current, thirtyDay, sixtyDay, ninetyPlus] = await this.prisma.$transaction([
      // Current (not yet overdue)
      this.prisma.invoice.aggregate({
        _sum: { total: true },
        _count: true,
        where: { status: { in: unpaidStatuses }, dueDate: { gte: now } },
      }),
      // 1-30 days overdue
      this.prisma.invoice.aggregate({
        _sum: { total: true },
        _count: true,
        where: { status: { in: unpaidStatuses }, dueDate: { lt: now, gte: thirtyDaysAgo } },
      }),
      // 31-60 days overdue
      this.prisma.invoice.aggregate({
        _sum: { total: true },
        _count: true,
        where: { status: { in: unpaidStatuses }, dueDate: { lt: thirtyDaysAgo, gte: sixtyDaysAgo } },
      }),
      // 61-90+ days overdue
      this.prisma.invoice.aggregate({
        _sum: { total: true },
        _count: true,
        where: { status: { in: unpaidStatuses }, dueDate: { lt: sixtyDaysAgo } },
      }),
    ]);

    return [
      { label: 'À jour', amount: Number(current._sum.total ?? 0), count: current._count, color: '#22c55e' },
      { label: '1-30 jours', amount: Number(thirtyDay._sum.total ?? 0), count: thirtyDay._count, color: '#f59e0b' },
      { label: '31-60 jours', amount: Number(sixtyDay._sum.total ?? 0), count: sixtyDay._count, color: '#f97316' },
      { label: '90+ jours', amount: Number(ninetyPlus._sum.total ?? 0), count: ninetyPlus._count, color: '#ef4444' },
    ];
  }

  async getTopClients(limit = 5) {
    const clients = await this.prisma.client.findMany({
      include: {
        invoices: {
          where: { status: { in: [InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID] } },
          select: { paidAmount: true, total: true },
        },
        _count: {
          select: { invoices: true, quotes: true },
        },
      },
    });

    const ranked = clients
      .map((c) => ({
        id: c.id,
        companyName: c.companyName,
        totalPaid: c.invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0),
        totalInvoiced: c.invoices.reduce((sum, inv) => sum + Number(inv.total), 0),
        invoiceCount: c._count.invoices,
        quoteCount: c._count.quotes,
      }))
      .sort((a, b) => b.totalPaid - a.totalPaid)
      .slice(0, limit);

    return ranked;
  }
}
