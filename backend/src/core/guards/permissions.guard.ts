import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.permissions) {
      throw new ForbiddenException('Access denied: User permissions are not loaded.');
    }

    // CEO bypass: CEO can do anything
    if (user.role?.name === 'GERANT') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { params, method, url } = request;

    // Self-request bypass: A user can retrieve or update their own profile
    if (params && params.id === user.id && url.includes('/users')) {
      if (method === 'GET' || method === 'PATCH') {
        return true;
      }
    }

    const hasPermission = requiredPermissions.every((perm) =>
      user.permissions.includes(perm),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Access denied: You do not have the required permission(s): ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
