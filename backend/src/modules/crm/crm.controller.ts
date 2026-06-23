import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Put,
} from '@nestjs/common';
import { CrmService } from './crm.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { CreateLeadNoteDto } from './dto/create-lead-note.dto';
import { CreateLeadActivityDto } from './dto/create-lead-activity.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateClientContactDto } from './dto/create-client-contact.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { RequirePermissions } from '../../core/decorators/permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@Controller('crm')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  // ─── Leads ───────────────────────────────────────────────────────────────────

  @Get('leads')
  @RequirePermissions('crm:read')
  findAllLeads(@Query() query: QueryLeadsDto) {
    return this.crmService.findAllLeads(query);
  }

  @Get('leads/:id')
  @RequirePermissions('crm:read')
  findLeadById(@Param('id') id: string) {
    return this.crmService.findLeadById(id);
  }

  @Post('leads')
  @RequirePermissions('crm:write')
  createLead(@Body() dto: CreateLeadDto, @CurrentUser() user: any) {
    return this.crmService.createLead(dto, user.id);
  }

  @Patch('leads/:id')
  @RequirePermissions('crm:write')
  updateLead(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.crmService.updateLead(id, dto);
  }

  @Put('leads/:id/assign')
  @RequirePermissions('crm:write')
  assignLead(@Param('id') id: string, @Body('assignedToId') assignedToId: string | null) {
    return this.crmService.assignLead(id, assignedToId);
  }

  @Delete('leads/:id')
  @RequirePermissions('crm:write')
  deleteLead(@Param('id') id: string) {
    return this.crmService.deleteLead(id);
  }

  @Patch('leads/:id/restore')
  @RequirePermissions('crm:write')
  restoreLead(@Param('id') id: string) {
    return this.crmService.restoreLead(id);
  }

  // ─── Lead Notes ──────────────────────────────────────────────────────────────

  @Get('leads/:id/notes')
  @RequirePermissions('crm:read')
  getLeadNotes(@Param('id') leadId: string) {
    return this.crmService.getLeadNotes(leadId);
  }

  @Post('leads/:id/notes')
  @RequirePermissions('crm:write')
  addLeadNote(
    @Param('id') leadId: string,
    @Body() dto: CreateLeadNoteDto,
    @CurrentUser() user: any,
  ) {
    return this.crmService.addLeadNote(leadId, dto.content, user.id);
  }

  @Delete('leads/notes/:noteId')
  @RequirePermissions('crm:write')
  deleteLeadNote(@Param('noteId') noteId: string) {
    return this.crmService.deleteLeadNote(noteId);
  }

  // ─── Lead Activities ─────────────────────────────────────────────────────────

  @Get('leads/:id/activities')
  @RequirePermissions('crm:read')
  getLeadActivities(@Param('id') leadId: string) {
    return this.crmService.getLeadActivities(leadId);
  }

  @Post('leads/:id/activities')
  @RequirePermissions('crm:write')
  addLeadActivity(
    @Param('id') leadId: string,
    @Body() dto: CreateLeadActivityDto,
    @CurrentUser() user: any,
  ) {
    return this.crmService.addLeadActivity(leadId, dto, user.id);
  }

  // ─── Clients ─────────────────────────────────────────────────────────────────

  @Get('clients')
  @RequirePermissions('crm:read')
  findAllClients(@Query() query: QueryClientsDto) {
    return this.crmService.findAllClients(query);
  }

  @Get('clients/:id')
  @RequirePermissions('crm:read')
  findClientById(@Param('id') id: string) {
    return this.crmService.findClientById(id);
  }

  @Post('clients')
  @RequirePermissions('crm:write')
  createClient(@Body() dto: CreateClientDto, @CurrentUser() user: any) {
    return this.crmService.createClient(dto, user.id);
  }

  @Patch('clients/:id')
  @RequirePermissions('crm:write')
  updateClient(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.crmService.updateClient(id, dto);
  }

  @Delete('clients/:id')
  @RequirePermissions('crm:write')
  deleteClient(@Param('id') id: string) {
    return this.crmService.deleteClient(id);
  }

  @Patch('clients/:id/restore')
  @RequirePermissions('crm:write')
  restoreClient(@Param('id') id: string) {
    return this.crmService.restoreClient(id);
  }

  // ─── Client Contacts ─────────────────────────────────────────────────────────

  @Get('clients/:id/contacts')
  @RequirePermissions('crm:read')
  getClientContacts(@Param('id') clientId: string) {
    return this.crmService.getClientContacts(clientId);
  }

  @Post('clients/:id/contacts')
  @RequirePermissions('crm:write')
  addClientContact(@Param('id') clientId: string, @Body() dto: CreateClientContactDto) {
    return this.crmService.addClientContact(clientId, dto);
  }

  @Patch('clients/contacts/:contactId')
  @RequirePermissions('crm:write')
  updateClientContact(
    @Param('contactId') contactId: string,
    @Body() dto: Partial<CreateClientContactDto>,
  ) {
    return this.crmService.updateClientContact(contactId, dto);
  }

  @Delete('clients/contacts/:contactId')
  @RequirePermissions('crm:write')
  deleteClientContact(@Param('contactId') contactId: string) {
    return this.crmService.deleteClientContact(contactId);
  }
}
