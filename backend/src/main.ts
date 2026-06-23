import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { RequestLoggerInterceptor } from './core/interceptors/request-logger.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set global routing prefix
  app.setGlobalPrefix('api/v1');

  // Convert empty strings in request bodies to null to avoid validation errors on optional fields (like UUIDs, URLs, emails)
  app.use((req: any, res: any, next: () => void) => {
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
    }
    next();
  });

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
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
