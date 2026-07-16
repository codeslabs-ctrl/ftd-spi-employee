import * as oracledb from 'oracledb';
import { getConfig } from '../../config/configuration';
import {
  callOraclePkg,
  OraclePkgResult,
  withOracleConnection,
} from '../../config/db/oracle/oracle-pkg.helper';
import { getPool } from '../../config/db/oracle/tenant-pools';
import {
  assertPkgSuccess,
  mapOracleError,
  parseJsonArray,
} from '../../shared/oracle/pkg-assert';

export class MaritalStatusesRepository {
  private readonly pkg: string;
  private readonly successCode: string;
  private readonly noRecordsCode: string;
  private readonly callTimeoutMs: number;

  constructor() {
    const cfg = getConfig();
    this.pkg = cfg.maritalStatusPkg;
    this.successCode = cfg.pkgSuccessCode;
    this.noRecordsCode = cfg.pkgNoRecordsCode;
    this.callTimeoutMs = cfg.oracle.callTimeout;
  }

  private withConn<T>(
    country: string,
    fn: (conn: oracledb.Connection) => Promise<T>,
  ): Promise<T> {
    return withOracleConnection(getPool(country), fn, (e) =>
      mapOracleError(e, this.pkg, 'Marital status conflict'),
    );
  }

  async findAll(country: string, page: number, size: number) {
    return this.withConn(country, async (conn) => {
      const res: OraclePkgResult = await callOraclePkg(conn, {
        packageName: this.pkg,
        procedure: 'prc_get_marital_status',
        inJson: { page, size },
        withOutJson: true,
        callTimeoutMs: this.callTimeoutMs,
      });
      if (res.cod === this.noRecordsCode) return { page, size, items: [] };
      assertPkgSuccess(res, this.successCode, this.noRecordsCode);
      return {
        page,
        size,
        items: parseJsonArray(res.json, 'maritalStatuses'),
      };
    });
  }
}
