import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Response } from 'express';
import { DocumentService } from './document.service';
import { PdfService } from './pdf.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { RequirePermissions } from '../../core/decorators/permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';

@Controller('documents')
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly pdfService: PdfService,
  ) {}

  @Get('sample')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('documents:read')
  async downloadSamplePdf(
    @Res() res: Response,
    @CurrentUser() user: any,
    @Query('title') title?: string,
  ) {
    const docTitle = title || 'AgencyOS Operations Audit';
    const authorName = `${user.firstName} ${user.lastName} (${user.role})`;
    const content = `This document contains the primary system audit records for AgencyOS, validating the configuration of role-based access tokens, permissions mappings, database connectivity, and Socket.IO bindings. Any modifications to this report require appropriate manager authority levels.`;

    try {
      const pdfBuffer = await this.pdfService.generateSampleDocument(docTitle, authorName, content);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${docTitle.toLowerCase().replace(/\s+/g, '-')}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.end(pdfBuffer);
    } catch (err) {
      res.status(500).json({ message: 'Error compiling PDF document.', error: err.message });
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('documents:read')
  findAll(@Query() query: QueryDocumentsDto, @CurrentUser() user: any) {
    return this.documentService.findAll(query, user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('documents:read')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documentService.findOne(id, user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('documents:write')
  create(@Body() dto: CreateDocumentDto, @CurrentUser() user: any) {
    return this.documentService.create(dto, user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('documents:write')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: any,
  ) {
    return this.documentService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('documents:write')
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documentService.delete(id, user);
  }

  @Patch(':id/restore')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('documents:write')
  restore(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documentService.restore(id, user);
  }

  @Post(':id/tags')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('documents:write')
  addTag(@Param('id') id: string, @Body('tag') tag: string) {
    return this.documentService.addTag(id, tag);
  }

  @Delete(':id/tags/:tag')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('documents:write')
  removeTag(@Param('id') id: string, @Param('tag') tag: string) {
    return this.documentService.removeTag(id, tag);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = './uploads';
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      },
    }),
  }))
  uploadFile(@UploadedFile() file: any) {
    return {
      url: `/api/v1/documents/files/${file.filename}`,
      name: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  @Get('files/:filename')
  getUploadedFile(@Param('filename') filename: string, @Res() res: Response) {
    return res.sendFile(filename, { root: './uploads' });
  }

  @Get(':storedFileName/download')
  async downloadDocument(
    @Param('storedFileName') storedFileName: string,
    @Res() res: Response,
  ) {
    const doc = await this.documentService.findByStoredFileName(storedFileName);
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (!fs.existsSync(doc.path)) {
      return res.status(404).json({ message: 'File not found on disk' });
    }

    res.set({
      'Content-Type': doc.mimeType || 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.originalFileName)}"`,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });

    return res.sendFile(doc.storedFileName, { root: './storage/documents' });
  }
}
