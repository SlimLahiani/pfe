import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { RequirePermissions } from '../../core/decorators/permissions.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { getOnlineUserIds } from '../chat/chat.gateway';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('users:create')
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @RequirePermissions('users:read')
  findAll(@Query('showArchived') showArchived?: string) {
    return this.usersService.findAll({ showArchived: showArchived === 'true' });
  }

  @Get('roles/all')
  @RequirePermissions('users:read')
  findAllRoles() {
    return this.usersService.findAllRoles();
  }

  @Get('departments/all')
  @RequirePermissions('users:read')
  findAllDepartments() {
    return this.usersService.findAllDepartments();
  }

  @Get('online/stats')
  @RequirePermissions('users:read')
  getOnlineStats() {
    const onlineIds = getOnlineUserIds();
    return {
      onlineCount: onlineIds.length,
      onlineUserIds: onlineIds,
    };
  }

  @Get(':id')
  @RequirePermissions('users:read')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.usersService.findOne(id, currentUser);
  }

  @Patch(':id')
  @RequirePermissions('users:update')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.update(id, updateUserDto, currentUser);
  }

  @Delete(':id')
  @RequirePermissions('users:delete')
  remove(@Param('id') id: string, @CurrentUser() currentUser: any) {
    return this.usersService.remove(id, currentUser);
  }

  @Patch(':id/restore')
  @RequirePermissions('users:update')
  restore(@Param('id') id: string) {
    return this.usersService.restore(id);
  }
}
