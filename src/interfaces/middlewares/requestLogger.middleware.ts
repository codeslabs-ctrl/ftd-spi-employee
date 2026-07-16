import { NextFunction, Request, Response } from 'express';
import logger from '../../infrastructure/log/logger';
import {
  LoggerContext,
  runWithLoggerContext,
} from '../../shared/utils/logger-context.util';

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();
  const context: LoggerContext = {
    ruta: req.originalUrl || '',
    servidorDestino: req.hostname || '',
    startTime: start,
    country: String(req.headers['x-country-code'] ?? '') || undefined,
  };

  runWithLoggerContext(context, () => {
    logger.info('Request', { method: req.method || '' });
    res.on('finish', () => {
      logger.info('Response', {
        method: req.method || '',
        statusCode: res.statusCode || '',
      });
    });
    next();
  });
}
