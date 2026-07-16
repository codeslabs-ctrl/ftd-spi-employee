import { NextFunction, Request, Response } from 'express';
import logger from '../../infrastructure/log/logger';
import { HttpError } from '../../shared/errors/http-error';

/** SPI Nest-compatible error envelope (not archetype createResponse). */
export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: string[] = [];

  if (err instanceof HttpError) {
    statusCode = err.status;
    message = err.message;
    errors = err.errors ?? [];
    if (statusCode >= 500) {
      logger.error(`HttpError ${statusCode}: ${message}`);
    }
  } else if (err instanceof Error) {
    logger.error(err.stack ?? err.message);
  } else {
    logger.error(String(err));
  }

  if (statusCode >= 500 && !(err instanceof HttpError)) {
    message = 'Internal server error';
  }

  res.status(statusCode).json({
    statusCode,
    message,
    errors,
    timestamp: new Date().toISOString(),
    path: req.originalUrl ?? req.url,
  });
}
