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
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { toPositionPayload } from './position-field.map';

export class PositionsRepository {
  private readonly pkg: string;
  private readonly successCode: string;
  private readonly noRecordsCode: string;
  private readonly callTimeoutMs: number;

  constructor() {
    const cfg = getConfig();
    this.pkg = cfg.positionPkg;
    this.successCode = cfg.pkgSuccessCode;
    this.noRecordsCode = cfg.pkgNoRecordsCode;
    this.callTimeoutMs = cfg.oracle.callTimeout;
  }

  private withConn<T>(
    country: string,
    fn: (conn: oracledb.Connection) => Promise<T>,
  ): Promise<T> {
    return withOracleConnection(getPool(country), fn, (e) =>
      mapOracleError(e, this.pkg, 'Position already exists'),
    );
  }

  private callPkg(
    conn: oracledb.Connection,
    procedure: string,
    inJson: Record<string, unknown>,
    withOutJson: boolean,
  ): Promise<OraclePkgResult> {
    return callOraclePkg(conn, {
      packageName: this.pkg,
      procedure,
      inJson,
      withOutJson,
      callTimeoutMs: this.callTimeoutMs,
    });
  }

  private assert(res: OraclePkgResult, notFoundOnNoRecords = false): void {
    assertPkgSuccess(
      res,
      this.successCode,
      this.noRecordsCode,
      notFoundOnNoRecords,
    );
  }

  private parse(json: string | null): Record<string, unknown>[] {
    return parseJsonArray(json, 'positions');
  }

  async create(country: string, dto: CreatePositionDto) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(
        conn,
        'prc_merge_position',
        { positions: [toPositionPayload(dto)] },
        false,
      );
      this.assert(res);
      return {
        companyId: dto.companyId,
        id: dto.id,
        message: res.message,
      };
    });
  }

  async findById(country: string, companyId: string, id: string) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(
        conn,
        'prc_get_position',
        { companyId, id },
        true,
      );
      this.assert(res, true);
      const items = this.parse(res.json);
      if (!items.length) {
        throw notFound(`Position ${companyId}/${id} not found`);
      }
      return items[0];
    });
  }

  async findAll(
    country: string,
    page: number,
    size: number,
    companyId?: string,
  ) {
    return this.withConn(country, async (conn) => {
      const payload: Record<string, unknown> = { page, size };
      if (companyId !== undefined) payload.companyId = companyId;
      const res = await this.callPkg(conn, 'prc_get_position', payload, true);
      if (res.cod === this.noRecordsCode) return { page, size, items: [] };
      this.assert(res);
      return { page, size, items: this.parse(res.json) };
    });
  }

  async update(country: string, dto: UpdatePositionDto) {
    return this.withConn(country, async (conn) => {
      const existing = await this.callPkg(
        conn,
        'prc_get_position',
        { companyId: dto.companyId, id: dto.id },
        true,
      );
      this.assert(existing, true);
      if (!this.parse(existing.json).length) {
        throw notFound(`Position ${dto.companyId}/${dto.id} not found`);
      }
      const res = await this.callPkg(
        conn,
        'prc_merge_position',
        { positions: [toPositionPayload(dto)] },
        false,
      );
      this.assert(res);
      const updated = await this.callPkg(
        conn,
        'prc_get_position',
        { companyId: dto.companyId, id: dto.id },
        true,
      );
      this.assert(updated, true);
      return this.parse(updated.json)[0];
    });
  }
}
