import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { toEmployeePayload } from './employee-field.map';

interface PkgResult {
  json: string | null;
  cod: string;
  message: string;
}

@Injectable()
export class EmployeesRepository {
  private readonly logger = new Logger(EmployeesRepository.name);

  // Package name and PKG_GLOBAL_CONSTANTS values vary per environment/schema,
  // so they come from config (EMPLOYEE_PKG / PKG_SUCCESS_CODE / PKG_NORECORDS_CODE).
  private readonly pkg: string;
  private readonly successCode: string;
  private readonly noRecordsCode: string;

  constructor(
    private readonly tenants: TenantConnectionService,
    private readonly config: ConfigService,
  ) {
    this.pkg = this.config.get<string>('employeePkg') ?? 'corsox.pkg_management_employee';
    this.successCode = this.config.get<string>('pkgSuccessCode') ?? 'FTD-200';
    this.noRecordsCode = this.config.get<string>('pkgNoRecordsCode') ?? 'FTD-201';
  }

  private async withConn<T>(
    country: string,
    fn: (conn: oracledb.Connection) => Promise<T>,
  ): Promise<T> {
    const conn = await this.tenants.getPool(country).getConnection();
    try {
      return await fn(conn);
    } catch (e) {
      throw this.mapOracleError(e);
    } finally {
      await conn.close();
    }
  }

  private async readLob(value: unknown): Promise<string | null> {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    return (value as oracledb.Lob).getData() as Promise<string>;
  }

  private async callPkg(
    conn: oracledb.Connection,
    procedure: string,
    inJson: Record<string, unknown>,
    withOutJson: boolean,
  ): Promise<PkgResult> {
    const outJsonArg = withOutJson ? 'o_json => :o_json, ' : '';
    const binds: oracledb.BindParameters = {
      i_json: JSON.stringify(inJson),
      o_cod: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 100 },
      o_message: {
        dir: oracledb.BIND_OUT,
        type: oracledb.STRING,
        maxSize: 4000,
      },
      ...(withOutJson
        ? { o_json: { dir: oracledb.BIND_OUT, type: oracledb.CLOB } }
        : {}),
    };
    const result = await conn.execute(
      `BEGIN ${this.pkg}.${procedure}(i_json => :i_json, ${outJsonArg}o_cod => :o_cod, o_message => :o_message); END;`,
      binds,
      { autoCommit: true },
    );
    const out = result.outBinds as {
      o_json?: unknown;
      o_cod: string;
      o_message: string;
    };
    return {
      json: withOutJson ? await this.readLob(out.o_json) : null,
      cod: String(out.o_cod),
      message: out.o_message,
    };
  }

  // Oracle SQLCODEs that mean "bad input data" (surfaced as 422, not 500):
  // unique(-1), not-null(-1400), check(-2290), FK(-2291/-2292), value-too-large(-12899).
  private static readonly DATA_ERROR_CODES = new Set([-1, -1400, -2290, -2291, -2292, -12899]);

  // O_COD following the FTD pattern: success constant, "no records" constant,
  // or 'ORA-<sqlcode>' built by the WHEN OTHERS handler.
  private assertPkgSuccess(res: PkgResult, notFoundOnNoRecords = false): void {
    if (res.cod === this.successCode) return;

    // Any non-success is logged so 500s are diagnosable (message is hidden from client).
    this.logger.warn(`PKG ${res.cod}: ${res.message}`);

    if (res.cod === this.noRecordsCode) {
      if (notFoundOnNoRecords) throw new NotFoundException(res.message);
      throw new UnprocessableEntityException(res.message);
    }
    if (res.cod.startsWith('ORA-')) {
      const sqlcode = Number(res.cod.replace(/^ORA-/, '')); // e.g. 'ORA--2291' -> -2291
      // RAISE_APPLICATION_ERROR (-20000..-20999) or a data-integrity violation -> 422 with message
      if (
        (sqlcode <= -20000 && sqlcode >= -20999) ||
        EmployeesRepository.DATA_ERROR_CODES.has(sqlcode)
      ) {
        throw new UnprocessableEntityException(
          String(res.message ?? '').replace(/^[A-Z_]+ - /, ''),
        );
      }
      throw new InternalServerErrorException(); // genuine server fault (details only in logs)
    }
    throw new UnprocessableEntityException(res.message);
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
        throw new NotFoundException(`Employee ${idNumber} not found`);
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

  // The same MERGE procedure covers create and update (matched by idNumber).
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
        throw new NotFoundException(`Employee ${idNumber} not found`);
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

  // Logical delete: IN_REL_TRAB = 'N' — EO_PERSONA has no status column
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
    if (e instanceof HttpException) return e;
    const ora = e as { errorNum?: number; message?: string };
    if (ora?.errorNum === 1)
      return new ConflictException('Employee already exists');
    if (ora?.errorNum && ora.errorNum >= 20000 && ora.errorNum <= 20999) {
      return new UnprocessableEntityException(
        String(ora.message ?? '').replace(/^ORA-\d+:\s*/, ''),
      );
    }
    return new InternalServerErrorException();
  }
}
