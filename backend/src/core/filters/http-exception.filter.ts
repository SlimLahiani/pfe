import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse: any =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const message =
      typeof exceptionResponse === 'object' && exceptionResponse.message
        ? exceptionResponse.message
        : exceptionResponse;

    if (status === 400 && exceptionResponse && typeof exceptionResponse === 'object') {
      console.error(`[Validation-Error] ${request.method} ${request.url} - Validation failed:`, JSON.stringify(exceptionResponse));
    } else {
      console.error(`[Exception] ${request.method} ${request.url} - Status: ${status} - Error:`, exception);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: Array.isArray(message) ? message[0] : message,
      details: typeof exceptionResponse === 'object' && exceptionResponse.details
        ? exceptionResponse.details
        : (Array.isArray(message) ? message : undefined),
    });
  }
}
