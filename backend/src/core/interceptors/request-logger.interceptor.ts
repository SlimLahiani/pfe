import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('API-Logger');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();
    const { method, url, body } = request;

    this.logger.log(`Request received: [${method}] ${url}`);
    if (body && Object.keys(body).length > 0) {
      const sanitizedBody = { ...body };
      delete sanitizedBody.password;
      delete sanitizedBody.passwordHash;
      this.logger.log(`DTO received: ${JSON.stringify(sanitizedBody)}`);
    }

    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startedAt;
          this.logger.log(`Database save success & API response sent: [${method}] ${url} - Status: ${response.statusCode} - Duration: ${duration}ms`);
        },
        error: (err) => {
          const duration = Date.now() - startedAt;
          const status = err.status || 500;
          this.logger.error(`Database save failure & API response failed: [${method}] ${url} - Status: ${status} - Error: ${err.message} - Duration: ${duration}ms`);
        },
      }),
    );
  }
}
