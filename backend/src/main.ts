import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { RequestLoggerInterceptor } from './core/interceptors/request-logger.interceptor';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global routing prefix
  app.setGlobalPrefix('api/v1');

  // Explicitly register body parser middlewares so body sanitizer middleware can access req.body
  app.use(json());
  app.use(urlencoded({ extended: true }));

  // Convert empty strings in request bodies to null to avoid validation errors on optional fields (like UUIDs, URLs, emails)
  app.use((req: any, res: any, next: () => void) => {
    console.log('[Middleware] req.body before sanitize:', req.body);
    if (req.body) {
      const sanitize = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'string') {
          return obj.trim() === '' ? null : obj;
        }
        if (Array.isArray(obj)) {
          return obj.map(sanitize);
        }
        if (typeof obj === 'object') {
          for (const key of Object.keys(obj)) {
            obj[key] = sanitize(obj[key]);
          }
        }
        return obj;
      };
      req.body = sanitize(req.body);
      console.log('[Middleware] req.body after sanitize:', req.body);
    }
    next();
  });

  // Enable validation globally with detailed error output
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        const errorMessages = errors.flatMap((err) => {
          if (err.constraints) {
            return Object.values(err.constraints);
          }
          if (err.children && err.children.length > 0) {
            return err.children.flatMap((c) => Object.values(c.constraints || {}));
          }
          return [];
        });
        console.error('[Validation Failure] Detailed Errors:', errorMessages);
        return new BadRequestException({
          statusCode: 400,
          message: errorMessages[0] || 'Validation failed',
          details: errorMessages,
        });
      },
    }),
  );

  // Register global HTTP exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Register global request logger interceptor
  app.useGlobalInterceptors(new RequestLoggerInterceptor());

  // Enable CORS for frontend integration
  app.enableCors({
    origin: '*', // In production, replace with specific domain
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`CREATIVART Backend Server is running on: http://localhost:${port}/api/v1`);
}
bootstrap();
