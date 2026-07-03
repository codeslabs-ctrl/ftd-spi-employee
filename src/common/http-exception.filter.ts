import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] = [];

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const b = body as { error?: string; message?: string | string[] };
        if (Array.isArray(b.message)) {
          // Validation errors: keep the per-field list, use the status label as message.
          errors = b.message;
          message = typeof b.error === 'string' ? b.error : 'Bad Request';
        } else {
          // Single-message exceptions: preserve the specific message (404, 403,
          // 422 with the PKG's O_MESSAGE, "Invalid encrypted payload", etc.).
          message = b.message ?? b.error ?? message;
        }
      }
    } else {
      this.logger.error(
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : String(exception),
      );
    }

    res.status(statusCode).json({
      statusCode,
      message,
      errors,
      timestamp: new Date().toISOString(),
      // originalUrl: middleware-thrown errors see a mount-relative req.url ('/')
      path: req.originalUrl ?? req.url,
    });
  }
}
