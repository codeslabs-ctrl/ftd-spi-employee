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
  parseCatalogJsonObject,
} from '../../shared/oracle/catalog-pkg-assert';
import { CatalogFilters, findCatalogDefinition } from './catalog.definitions';

export interface ReentryResult {
  numIden: string;
  declaredReingreso: 'SI' | 'NO';
  reingreso: 'SI' | 'NO';
  corrected: boolean;
  value: number;
}

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
    filters: CatalogFilters = {},
  ) {
    const def = findCatalogDefinition(catalogKey);
    // Solo se mandan las claves que sí vienen — un PRC_PARSE_*_FILTER que no
    // conoce un campo simplemente lo ignora, pero evitamos mandar `undefined`
    // como valor explícito en el JSON.
    const inJson: Record<string, unknown> = { page, size };
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined) inJson[k] = v;
    }
    return this.withConn(country, async (conn) => {
      const res: OraclePkgResult = await callOraclePkg(conn, {
        packageName: this.pkg,
        procedure: def.procedure,
        inJson,
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

  /**
   * "Validar reingreso" (PRC_VALIDATE_REENTRY) — único caso de este módulo
   * que NO es una lista de solo lectura: valida la cédula contra
   * EO_PERSONA/TA_RELACION_LABORAL y, si lo declarado por el caller no
   * coincide, el PKG corrige INFOCENT.FTD_INGRESOS.REINGRESO (UPDATE +
   * COMMIT del lado Oracle). Ver db/pkg_management_catalogs_api.sql.
   */
  async validateReentry(
    country: string,
    numIden: string,
    reingreso: 'SI' | 'NO',
  ): Promise<ReentryResult> {
    return this.withConn(country, async (conn) => {
      const res: OraclePkgResult = await callOraclePkg(conn, {
        packageName: this.pkg,
        procedure: 'prc_validate_reentry',
        inJson: { numIden, reingreso },
        withOutJson: true,
        callTimeoutMs: this.callTimeoutMs,
      });
      assertCatalogPkgSuccess(res, this.successCode, this.noRecordsCode);
      const obj = parseCatalogJsonObject(res.json, 'reentry');
      return {
        numIden: String(obj.numIden ?? numIden),
        declaredReingreso: (obj.declaredReingreso ?? reingreso) as 'SI' | 'NO',
        reingreso: obj.reingreso as 'SI' | 'NO',
        corrected: obj.corrected === 'S',
        value: Number(obj.value),
      };
    });
  }
}
