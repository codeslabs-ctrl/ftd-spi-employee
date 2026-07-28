import * as oracledb from 'oracledb';
import { getConfig } from '../../config/configuration';
import {
  callOraclePkg,
  OraclePkgResult,
  withOracleConnection,
} from '../../config/db/oracle/oracle-pkg.helper';
import { getPool } from '../../config/db/oracle/tenant-pools';
import {
  assertCatalogPkgSuccess,
  mapCatalogOracleError,
  parseCatalogJsonArray,
} from '../../shared/oracle/catalog-pkg-assert';
import { findCatalogDefinition } from './catalog.definitions';

/**
 * Repositorio único para todos los catálogos: todos comparten el mismo
 * paquete Oracle (CATALOGS_PKG); lo único que cambia por catálogo es el
 * nombre del procedimiento y la clave del JSON de salida (ver
 * catalog.definitions.ts).
 */
export class CatalogsRepository {
  private readonly pkg: string;
  private readonly successCode: string;
  private readonly noRecordsCode: string;
  private readonly callTimeoutMs: number;

  constructor() {
    const cfg = getConfig();
    this.pkg = cfg.catalogsPkg;
    this.successCode = cfg.pkgSuccessCode;
    this.noRecordsCode = cfg.pkgNoRecordsCode;
    this.callTimeoutMs = cfg.oracle.callTimeout;
  }

  private withConn<T>(
    country: string,
    fn: (conn: oracledb.Connection) => Promise<T>,
  ): Promise<T> {
    return withOracleConnection(getPool(country), fn, (e) =>
      mapCatalogOracleError(e, this.pkg),
    );
  }

  async findAll(
    country: string,
    catalogKey: string,
    page: number,
    size: number,
  ) {
    const def = findCatalogDefinition(catalogKey);
    return this.withConn(country, async (conn) => {
      const res: OraclePkgResult = await callOraclePkg(conn, {
        packageName: this.pkg,
        procedure: def.procedure,
        inJson: { page, size },
        withOutJson: true,
        callTimeoutMs: this.callTimeoutMs,
      });
      if (res.cod === this.noRecordsCode) {
        return { page, size, items: [] };
      }
      assertCatalogPkgSuccess(res, this.successCode, this.noRecordsCode);
      return {
        page,
        size,
        items: parseCatalogJsonArray(res.json, def.jsonKey),
      };
    });
  }
}
