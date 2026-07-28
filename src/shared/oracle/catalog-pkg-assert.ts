import { OraclePkgResult } from '../../config/db/oracle/oracle-pkg.helper';
import logger from '../../infrastructure/log/logger';
import {
  HttpError,
  conflict,
  internalError,
  notFound,
  unprocessable,
} from '../errors/http-error';

const DATA_ERROR_CODES = new Set([-1, -1400, -2290, -2291, -2292, -12899]);

/**
 * Variante en español de pkg-assert.ts, pensada para ser reutilizable por
 * cualquier módulo que necesite mensajes de error en español (hoy: catalogs).
 *
 * No reemplaza a pkg-assert.ts: los módulos existentes (employee, position,
 * company, marital-status, job-post, org-unit) siguen usando los mensajes en
 * inglés ya probados/congelados en los tests e2e. Este helper es un punto de
 * entrada aparte para no arriesgar ese contrato ya integrado por Farmatodo.
 */
export function assertCatalogPkgSuccess(
  res: OraclePkgResult,
  successCode: string,
  noRecordsCode: string,
  notFoundOnNoRecords = false,
): void {
  if (res.cod === successCode) return;
  logger.warn(`PKG ${res.cod}: ${res.message}`);

  if (res.cod === noRecordsCode) {
    const mensaje =
      res.message || 'No se encontraron registros para el criterio de consulta.';
    if (notFoundOnNoRecords) throw notFound(mensaje);
    throw unprocessable(mensaje);
  }

  if (res.cod.startsWith('ORA-')) {
    const sqlcode = Number(res.cod.replace(/^ORA-/, ''));
    if (
      (sqlcode <= -20000 && sqlcode >= -20999) ||
      DATA_ERROR_CODES.has(sqlcode)
    ) {
      throw unprocessable(
        res.message || 'Los datos de la consulta no son válidos.',
      );
    }
    throw internalError(
      'Error interno al consultar el catálogo. Intente nuevamente más tarde.',
    );
  }

  throw unprocessable(res.message || 'No se pudo procesar la solicitud.');
}

/**
 * Traduce errores de conexión/ejecución de Oracle (los que llegan como
 * excepción del driver, no como O_COD/O_MESSAGE del PKG) a mensajes en
 * español para los endpoints de catálogos.
 */
export function mapCatalogOracleError(e: unknown, pkg: string): Error {
  if (e instanceof HttpError) return e;
  const ora = e as { errorNum?: number; message?: string };
  logger.error(
    `Error de Oracle al invocar ${pkg}: ${ora?.message ?? String(e)}`,
  );

  if (ora?.errorNum === 1) {
    return conflict('Ya existe un registro con esa clave.');
  }
  if (ora?.errorNum && ora.errorNum >= 20000 && ora.errorNum <= 20999) {
    return unprocessable(
      String(ora.message ?? '').replace(/^ORA-\d+:\s*/, '') ||
        'Los datos enviados no son válidos.',
    );
  }
  return internalError(
    'No se pudo conectar con la base de datos. Intente nuevamente más tarde.',
  );
}

export function parseCatalogJsonArray(
  json: string | null,
  key: string,
): Record<string, unknown>[] {
  if (!json) return [];
  return (JSON.parse(json)[key] ?? []) as Record<string, unknown>[];
}
