import winston from 'winston';
import { LoggingWinston } from '@google-cloud/logging-winston';
import os from 'os';
import { getLoggerContext } from '../../shared/utils/logger-context.util';

const isProduction = ['staging', 'production'].includes(
  process.env.NODE_ENV ?? '',
);
const APP_ORIGIN =
  process.env.npm_package_name || process.env.APP_NAME || 'ftd-spi-employee';
const HOSTNAME = os.hostname();
const date = new Date().toISOString().slice(0, 10);
const logLevel = isProduction ? 'info' : 'debug';

const injectContextFormat = winston.format((info) => {
  const ctx = getLoggerContext() || {};
  info.appOrigen = APP_ORIGIN;
  info.ruta = info.ruta || ctx.ruta || '-';
  info.servidorOrigen = info.servidorOrigen || ctx.servidorOrigen || HOSTNAME;
  info.servidorDestino = info.servidorDestino || ctx.servidorDestino || '-';
  if (ctx.country) info.country = ctx.country;
  if (!info.tiempo && !info.duration && ctx.startTime) {
    info.tiempo = `${Date.now() - ctx.startTime}ms`;
  } else if (info.duration) {
    info.tiempo = info.duration;
  } else {
    info.tiempo = info.tiempo || '-';
  }
  if (!info.categoria) {
    switch (info.level) {
      case 'error':
        info.categoria = 'Error';
        break;
      case 'warn':
        info.categoria = 'Infraestructura';
        break;
      default:
        info.categoria = 'Operaciones';
    }
  }
  return info;
});

const devFormat = winston.format.printf(
  ({
    timestamp,
    level,
    message,
    appOrigen,
    ruta,
    servidorOrigen,
    servidorDestino,
    tiempo,
    categoria,
    ...meta
  }) => {
    const rest = Object.keys(meta).length ? `| ${JSON.stringify(meta)}` : '';
    return `${timestamp} | ${String(level).toUpperCase().padEnd(5)} | ${String(categoria).padEnd(15)} | ${appOrigen} | ${servidorOrigen} -> ${servidorDestino} | ${ruta} | ${tiempo} | ${message} ${rest}`;
  },
);

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss,SSS' }),
    isProduction ? winston.format.json() : devFormat,
  ),
});

const transports: winston.transport[] = [consoleTransport];

if (!isProduction) {
  transports.push(
    new winston.transports.File({
      filename: `logs/ftd-spi-employee-${date}.log`,
      level: logLevel,
      dirname: 'logs',
      handleExceptions: true,
      handleRejections: true,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss,SSS' }),
        devFormat,
      ),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  );
}

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    injectContextFormat(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports,
});

if (isProduction) {
  logger.add(new LoggingWinston());
}

export default logger;
