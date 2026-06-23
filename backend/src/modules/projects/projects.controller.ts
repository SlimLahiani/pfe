import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { RequirePermissions } from '../../core/decorators/permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // ─── Projects ────────────────────────────────────────────────────────────────

  @Get()
  @RequirePermissions('projects:read')
  findAll(@Query() query: QueryProjectsDto, @CurrentUser() user: any) {
    return this.projectsService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermissions('projects:read')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.findOne(id, user);
  }

  @Post()
  @RequirePermissions('projects:write')
  create(@Body() createProjectDto: CreateProjectDto, @CurrentUser() user: any) {
    return this.projectsService.create(createProjectDto, user.id);
  }

  @Patch(':id')
  @RequirePermissions('projects:write')
  update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.update(id, updateProjectDto, user);
  }

  @Patch(':id/archive')
  @RequirePermissions('projects:write')
  archive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.archive(id, user);
  }

  @Patch(':id/unarchive')
  @RequirePermissions('projects:write')
  unarchive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.unarchive(id, user);
  }

  @Delete(':id')
  @RequirePermissions('projects:write')
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.archive(id, user);
  }

  @Patch(':id/restore')
  @RequirePermissions('projects:write')
  restore(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.unarchive(id, user);
  }

  // ─── Members ─────────────────────────────────────────────────────────────────

  @Get(':id/members')
  @RequirePermissions('projects:read')
  getMembers(@Param('id') projectId: string, @CurrentUser() user: any) {
    return this.projectsService.getMembers(projectId, user);
  }

  @Post(':id/members')
  @RequirePermissions('projects:write')
  addMember(
    @Param('id') projectId: string,
    @Body() addMemberDto: AddMemberDto,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.addMember(projectId, addMemberDto, user);
  }

  @Delete(':id/members/:userId')
  @RequirePermissions('projects:write')
  removeMember(
    @Param('id') projectId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.removeMember(projectId, userId, user);
  }

  // ─── Milestones ───────────────────────────────────────────────────────────────

  @Get(':id/milestones')
  @RequirePermissions('projects:read')
  getMilestones(@Param('id') projectId: string, @CurrentUser() user: any) {
    return this.projectsService.getMilestones(projectId, user);
  }

  @Post(':id/milestones')
  @RequirePermissions('projects:write')
  createMilestone(
    @Param('id') projectId: string,
    @Body() createMilestoneDto: CreateMilestoneDto,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.createMilestone(projectId, createMilestoneDto, user);
  }

  @Patch('milestones/:milestoneId')
  @RequirePermissions('projects:write')
  updateMilestone(
    @Param('milestoneId') milestoneId: string,
    @Body() dto: Partial<CreateMilestoneDto>,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.updateMilestone(milestoneId, dto, user);
  }

  @Delete('milestones/:milestoneId')
  @RequirePermissions('projects:write')
  deleteMilestone(@Param('milestoneId') milestoneId: string, @CurrentUser() user: any) {
    return this.projectsService.deleteMilestone(milestoneId, user);
  }

  // ─── Files ────────────────────────────────────────────────────────────────────

  @Get(':id/files')
  @RequirePermissions('projects:read')
  getFiles(@Param('id') projectId: string, @CurrentUser() user: any) {
    return this.projectsService.getFiles(projectId, user);
  }
}
