import { Controller, Get, UseGuards } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { RequirePermissions } from '../../core/decorators/permissions.decorator';

@Controller('rbac')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @RequirePermissions('roles:read')
  getRoles() {
    return this.rbacService.findAllRoles();
  }

  @Get('permissions')
  @RequirePermissions('roles:read')
  getPermissions() {
    return this.rbacService.findAllPermissions();
  }
}
