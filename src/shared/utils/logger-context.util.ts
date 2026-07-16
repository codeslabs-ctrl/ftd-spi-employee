import { AsyncLocalStorage } from 'async_hooks';

export interface LoggerContext {
  ruta?: string;
  servidorOrigen?: string;
  servidorDestino?: string;
  transactionId?: string;
  startTime?: number;
  country?: string;
}

export const loggerContext = new AsyncLocalStorage<LoggerContext>();

export function getLoggerContext(): LoggerContext | undefined {
  return loggerContext.getStore();
}

export function runWithLoggerContext<T>(
  context: LoggerContext,
  callback: () => T,
): T {
  return loggerContext.run(context, callback);
}
