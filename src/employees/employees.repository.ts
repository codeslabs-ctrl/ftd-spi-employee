import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as oracledb from 'oracledb';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EMPLOYEE_FIELD_MAP, rowToEmployee } from './employee-field.map';

const PKG_CREATE = 'corsox.pkg_management_employee.prc_crear_datos_basicos';

@Injectable()
export class EmployeesRepository {
  constructor(private readonly tenants: TenantConnectionService) {}

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

  async create(country: string, dto: CreateEmployeeDto) {
    return this.withConn(country, async (conn) => {
      const entries = Object.entries(EMPLOYEE_FIELD_MAP);
      const args = entries
        .map(([, m]) => `${m.bind} => ${m.sqlExpr ?? `:${m.bind}`}`)
        .concat(['p_result_code => :p_result_code', 'p_message => :p_message'])
        .join(', ');
      const binds: Record<string, unknown> = {
        p_result_code: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        p_message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 4000 },
      };
      for (const [field, m] of entries) {
        binds[m.bind] = (dto as unknown as Record<string, unknown>)[field] ?? null;
      }

      const result = await conn.execute(`BEGIN ${PKG_CREATE}(${args}); END;`, binds, {
        autoCommit: true,
      });
      const out = result.outBinds as { p_result_code: number; p_message: string };
      if (out.p_result_code !== 0) throw new UnprocessableEntityException(out.p_message);
      return { idNumber: dto.idNumber, message: out.p_message };
    });
  }

  async findById(country: string, idNumber: string) {
    return this.withConn(country, async (conn) => {
      const r = await conn.execute(
        `SELECT * FROM infocent.eo_persona WHERE cedula = :idNumber`,
        { idNumber },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const rows = r.rows as Record<string, unknown>[];
      if (!rows?.length) throw new NotFoundException(`Employee ${idNumber} not found`);
      return rowToEmployee(rows[0]);
    });
  }

  async findAll(country: string, page: number, size: number) {
    return this.withConn(country, async (conn) => {
      const r = await conn.execute(
        `SELECT * FROM infocent.eo_persona ORDER BY cedula
         OFFSET :off ROWS FETCH NEXT :lim ROWS ONLY`,
        { off: (page - 1) * size, lim: size },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      return { page, size, items: (r.rows as Record<string, unknown>[]).map(rowToEmployee) };
    });
  }

  // PUT/DELETE follow the PKG-first standard: once Task 0 confirms update/delete procedures
  // in pkg_management_employee, wrap them like create(). Documented fallback: controlled
  // UPDATE / logical delete on EO_PERSONA.
  async update(country: string, idNumber: string, dto: UpdateEmployeeDto) {
    return this.withConn(country, async (conn) => {
      const sets: string[] = [];
      const binds: Record<string, unknown> = { idNumber };
      for (const [field, m] of Object.entries(EMPLOYEE_FIELD_MAP)) {
        const value = (dto as unknown as Record<string, unknown>)[field];
        if (m.updatable && value !== undefined) {
          sets.push(`${m.column} = :${field}`);
          binds[field] = value;
        }
      }
      if (!sets.length) throw new UnprocessableEntityException('Nothing to update');
      const r = await conn.execute(
        `UPDATE infocent.eo_persona SET ${sets.join(', ')} WHERE cedula = :idNumber`,
        binds,
        { autoCommit: true },
      );
      if (!r.rowsAffected) throw new NotFoundException(`Employee ${idNumber} not found`);
      const found = await conn.execute(
        `SELECT * FROM infocent.eo_persona WHERE cedula = :idNumber`,
        { idNumber },
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      return rowToEmployee((found.rows as Record<string, unknown>[])[0]);
    });
  }

  async softDelete(country: string, idNumber: string) {
    return this.withConn(country, async (conn) => {
      const r = await conn.execute(
        // status column name to be confirmed in Task 0
        `UPDATE infocent.eo_persona SET status = 'I' WHERE cedula = :idNumber`,
        { idNumber },
        { autoCommit: true },
      );
      if (!r.rowsAffected) throw new NotFoundException(`Employee ${idNumber} not found`);
    });
  }

  private mapOracleError(e: unknown): Error {
    if (e instanceof HttpException) return e;
    const ora = e as { errorNum?: number; message?: string };
    if (ora?.errorNum === 1) return new ConflictException('Employee already exists');
    if (ora?.errorNum && ora.errorNum >= 20000 && ora.errorNum <= 20999) {
      return new UnprocessableEntityException(
        String(ora.message ?? '').replace(/^ORA-\d+:\s*/, ''),
      );
    }
    return new InternalServerErrorException();
  }
}
