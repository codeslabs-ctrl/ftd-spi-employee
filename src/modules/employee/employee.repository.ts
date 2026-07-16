import * as oracledb from 'oracledb';
import { getConfig } from '../../config/configuration';
import {
  callOraclePkg,
  OraclePkgResult,
  withOracleConnection,
} from '../../config/db/oracle/oracle-pkg.helper';
import { getPool } from '../../config/db/oracle/tenant-pools';
import logger from '../../infrastructure/log/logger';
import { HttpError } from '../../shared/errors/http-error';
import {
  conflict,
  internalError,
  notFound,
  unprocessable,
} from '../../shared/errors/http-error';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { toEmployeePayload } from './employee-field.map';

export class EmployeesRepository {
  private readonly pkg: string;
  private readonly successCode: string;
  private readonly noRecordsCode: string;
  private readonly callTimeoutMs: number;

  constructor() {
    const cfg = getConfig();
    this.pkg = cfg.employeePkg;
    this.successCode = cfg.pkgSuccessCode;
    this.noRecordsCode = cfg.pkgNoRecordsCode;
    this.callTimeoutMs = cfg.oracle.callTimeout;
  }

  private withConn<T>(
    country: string,
    fn: (conn: oracledb.Connection) => Promise<T>,
  ): Promise<T> {
    return withOracleConnection(getPool(country), fn, (e) =>
      this.mapOracleError(e),
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

  private static readonly DATA_ERROR_CODES = new Set([
    -1, -1400, -2290, -2291, -2292, -12899,
  ]);

  private assertPkgSuccess(
    res: OraclePkgResult,
    notFoundOnNoRecords = false,
  ): void {
    if (res.cod === this.successCode) return;
    logger.warn(`PKG ${res.cod}: ${res.message}`);

    if (res.cod === this.noRecordsCode) {
      if (notFoundOnNoRecords) throw notFound(res.message);
      throw unprocessable(res.message);
    }
    if (res.cod.startsWith('ORA-')) {
      const sqlcode = Number(res.cod.replace(/^ORA-/, ''));
      if (
        (sqlcode <= -20000 && sqlcode >= -20999) ||
        EmployeesRepository.DATA_ERROR_CODES.has(sqlcode)
      ) {
        throw unprocessable(
          String(res.message ?? '').replace(/^[A-Z_]+ - /, ''),
        );
      }
      throw internalError();
    }
    throw unprocessable(res.message);
  }

  private parseEmployees(json: string | null): Record<string, unknown>[] {
    if (!json) return [];
    return (JSON.parse(json).employees ?? []) as Record<string, unknown>[];
  }

  async create(country: string, dto: CreateEmployeeDto) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(
        conn,
        'prc_merge_employee',
        { employees: [toEmployeePayload(dto)] },
        false,
      );
      this.assertPkgSuccess(res);
      return { idNumber: dto.idNumber, message: res.message };
    });
  }

  async findById(country: string, idNumber: string) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(
        conn,
        'prc_get_employee',
        { idNumber },
        true,
      );
      this.assertPkgSuccess(res, true);
      const employees = this.parseEmployees(res.json);
      if (!employees.length)
        throw notFound(`Employee ${idNumber} not found`);
      return employees[0];
    });
  }

  async findAll(country: string, page: number, size: number) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(
        conn,
        'prc_get_employee',
        { page, size },
        true,
      );
      if (res.cod === this.noRecordsCode) return { page, size, items: [] };
      this.assertPkgSuccess(res);
      return { page, size, items: this.parseEmployees(res.json) };
    });
  }

  async update(country: string, idNumber: string, dto: UpdateEmployeeDto) {
    return this.withConn(country, async (conn) => {
      const existing = await this.callPkg(
        conn,
        'prc_get_employee',
        { idNumber },
        true,
      );
      this.assertPkgSuccess(existing, true);
      if (!this.parseEmployees(existing.json).length) {
        throw notFound(`Employee ${idNumber} not found`);
      }
      const res = await this.callPkg(
        conn,
        'prc_merge_employee',
        { employees: [toEmployeePayload({ ...(dto as object), idNumber })] },
        false,
      );
      this.assertPkgSuccess(res);
      const updated = await this.callPkg(
        conn,
        'prc_get_employee',
        { idNumber },
        true,
      );
      this.assertPkgSuccess(updated, true);
      return this.parseEmployees(updated.json)[0];
    });
  }

  async softDelete(country: string, idNumber: string) {
    return this.withConn(country, async (conn) => {
      const res = await this.callPkg(
        conn,
        'prc_delete_employee',
        { idNumber },
        false,
      );
      this.assertPkgSuccess(res, true);
    });
  }

  private mapOracleError(e: unknown): Error {
    if (e instanceof HttpError) return e;
    const ora = e as { errorNum?: number; message?: string };
    logger.error(
      `Oracle error calling ${this.pkg}: ${ora?.message ?? String(e)}`,
    );
    if (ora?.errorNum === 1) return conflict('Employee already exists');
    if (ora?.errorNum && ora.errorNum >= 20000 && ora.errorNum <= 20999) {
      return unprocessable(
        String(ora.message ?? '').replace(/^ORA-\d+:\s*/, ''),
      );
    }
    return internalError();
  }
}
