import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user, ip, headers } = request;

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: async (responseData) => {
          try {
            const parts = url.replace(/\?.*$/, '').split('/').filter(Boolean);
            // Derive resource name from URL segments: e.g. /crm/leads/123 → "lead"
            const resource = this.deriveResource(parts);
            const resourceId = this.deriveResourceId(parts);
            const action = this.deriveAction(method);

            await this.prisma.auditLog.create({
              data: {
                userId: user?.id ?? null,
                userEmail: user?.email ?? null,
                action,
                resource,
                resourceId,
                metadata: {
                  method,
                  url,
                  body: this.sanitizeBody(body),
                  duration: `${Date.now() - startedAt}ms`,
                },
                ipAddress: ip,
                userAgent: headers['user-agent'] ?? null,
              },
            });
          } catch (err) {
            this.logger.warn(`Failed to write audit log: ${err.message}`);
          }
        },
        error: async (err) => {
          // Log failed mutations too (optional — can be removed)
          try {
            const parts = url.replace(/\?.*$/, '').split('/').filter(Boolean);
            await this.prisma.auditLog.create({
              data: {
                userId: user?.id ?? null,
                userEmail: user?.email ?? null,
                action: `${this.deriveAction(method)}_FAILED`,
                resource: this.deriveResource(parts),
                resourceId: this.deriveResourceId(parts),
                metadata: {
                  method,
                  url,
                  error: err.message,
                  statusCode: err.status,
                  duration: `${Date.now() - startedAt}ms`,
                },
                ipAddress: ip,
                userAgent: headers['user-agent'] ?? null,
              },
            });
          } catch {
            // swallow secondary errors to avoid masking the original
          }
        },
      }),
    );
  }

  private deriveAction(method: string): string {
    switch (method) {
      case 'POST': return 'CREATE';
      case 'PUT':
      case 'PATCH': return 'UPDATE';
      case 'DELETE': return 'DELETE';
      default: return method;
    }
  }

  private deriveResource(parts: string[]): string {
    // Strip API prefix like "api", "v1"
    const filtered = parts.filter((p) => !/^(api|v\d+)$/i.test(p));
    if (filtered.length === 0) return 'unknown';
    // Use the first meaningful segment (module name) and second if it's not an ID
    const primary = filtered[0];
    const secondary = filtered[1];
    if (secondary && !this.isUuid(secondary) && !this.isNumeric(secondary)) {
      return `${primary}.${secondary}`;
    }
    return primary;
  }

  private deriveResourceId(parts: string[]): string | null {
    const filtered = parts.filter((p) => !/^(api|v\d+)$/i.test(p));
    // Find the last UUID-looking segment
    for (let i = filtered.length - 1; i >= 0; i--) {
      if (this.isUuid(filtered[i]) || this.isNumeric(filtered[i])) {
        return filtered[i];
      }
    }
    return null;
  }

  private isUuid(s: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  }

  private isNumeric(s: string): boolean {
    return /^\d+$/.test(s);
  }

  private sanitizeBody(body: Record<string, any> | null): Record<string, any> {
    if (!body) return {};
    const sanitized = { ...body };
    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.passwordHash;
    delete sanitized.token;
    delete sanitized.refreshToken;
    return sanitized;
  }
}
