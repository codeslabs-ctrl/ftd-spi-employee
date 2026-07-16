import * as oracledb from 'oracledb';
import { getConfig } from '../../config/configuration';
import {
  callOraclePkg,
  OraclePkgResult,
  withOracleConnection,
} from '../../config/db/oracle/oracle-pkg.helper';
import { getPool } from '../../config/db/oracle/tenant-pools';
import { notFound } from '../../shared/errors/http-error';
import {
  assertPkgSuccess,
  mapOracleError,
  parseJsonArray,
} from '../../shared/oracle/pkg-assert';

export class CompaniesRepository {
  private readonly pkg: string;
  private readonly successCode: string;
  private readonly noRecordsCode: string;
  private readonly callTimeoutMs: number;

  constructor() {
    const cfg = getConfig();
    this.pkg = cfg.companyPkg;
    this.successCode = cfg.pkgSuccessCode;
    this.noRecordsCode = cfg.pkgNoRecordsCode;
    this.callTimeoutMs = cfg.oracle.callTimeout;
  }

  private withConn<T>(
    country: string,
    fn: (conn: oracledb.Connection) => Promise<T>,
  ): Promise<T> {
    return withOracleConnection(getPool(country), fn, (e) =>
      mapOracleError(e, this.pkg, 'Company conflict'),
    );
  }

  private callPkg(
    conn: oracledb.Connection,
    inJson: Record<string, unknown>,
  ): Promise<OraclePkgResult> {
    return callOraclePkg(conn, {
      packageName: this.pkg,
      procedure: 'prc_get_company',
      inJson,
      withOutJson: true,
      callTimeoutMs: this.callTimeoutMs,
    });
  }

  private parse(json: string | null): Record<string, unknown>[] {
    return parseJsonArray(json, 'companies');
  }

  async findById(country: string, id: string) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(conn, { id });
      assertPkgSuccess(res, this.successCode, this.noRecordsCode, true);
      const items = this.parse(res.json);
      if (!items.length) throw notFound(`Company ${id} not found`);
      return items[0];
    });
  }

  async findAll(country: string, page: number, size: number) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(conn, { page, size });
      if (res.cod === this.noRecordsCode) return { page, size, items: [] };
      assertPkgSuccess(res, this.successCode, this.noRecordsCode);
      return { page, size, items: this.parse(res.json) };
    });
  }
}
