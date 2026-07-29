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

export function assertPkgSuccess(
  res: OraclePkgResult,
  successCode: string,
  noRecordsCode: string,
  notFoundOnNoRecords = false,
): void {
  if (res.cod === successCode) return;
  logger.warn(`PKG ${res.cod}: ${res.message}`);

  if (res.cod === noRecordsCode) {
    if (notFoundOnNoRecords) throw notFound(res.message);
    throw unprocessable(res.message);
  }
  if (res.cod.startsWith('ORA-')) {
    const sqlcode = Number(res.cod.replace(/^ORA-/, ''));
    if (
      (sqlcode <= -20000 && sqlcode >= -20999) ||
      DATA_ERROR_CODES.has(sqlcode)
    ) {
      throw unprocessable(
        String(res.message ?? '').replace(/^[A-Z_]+ - /, ''),
      );
    }
    throw internalError();
  }
  throw unprocessable(res.message);
}

export function mapOracleError(
  e: unknown,
  pkg: string,
  duplicateMessage: string,
): Error {
  if (e instanceof HttpError) return e;
  const ora = e as { errorNum?: number; message?: string };
  logger.error(`Oracle error calling ${pkg}: ${ora?.message ?? String(e)}`);
  if (ora?.errorNum === 1) return conflict(duplicateMessage);
  if (ora?.errorNum && ora.errorNum >= 20000 && ora.errorNum <= 20999) {
    return unprocessable(
      String(ora.message ?? '').replace(/^ORA-\d+:\s*/, ''),
    );
  }
  // These fail at parse/bind time of `BEGIN <pkg>.<proc>(...); END;` — the
  // package's own WHEN OTHERS never runs, so they must be told apart from a
  // generic connection failure: the real cause is the object doesn't exist
  // or won't compile, not the network.
  if (ora?.errorNum === 6550 && /PLS-00201/.test(String(ora.message))) {
    return internalError(
      `Database procedure or package "${pkg}" does not exist, or the ` +
        'connection user lacks privileges to see it (check name and GRANT EXECUTE).',
    );
  }
  if (ora?.errorNum === 4063) {
    return internalError(
      `Database package "${pkg}" exists but has compilation errors — it ` +
        'needs to be recompiled.',
    );
  }
  if (ora?.errorNum === 6508) {
    return internalError(
      `Could not find the program unit for package "${pkg}" — it may have ` +
        'been invalidated after compiling; recompile and retry.',
    );
  }
  return internalError();
}

export function parseJsonArray(
  json: string | null,
  key: string,
): Record<string, unknown>[] {
  if (!json) return [];
  return (JSON.parse(json)[key] ?? []) as Record<string, unknown>[];
}
