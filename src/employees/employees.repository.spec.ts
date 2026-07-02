import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { EmployeesRepository } from './employees.repository';

function mockPool(executeImpl: jest.Mock) {
  const conn = { execute: executeImpl, close: jest.fn() };
  return { getConnection: jest.fn(async () => conn) };
}

const tenantSvc = (pool: unknown) =>
  ({ getPool: () => pool }) as unknown as TenantConnectionService;

const dto = {
  idNumber: '12345678',
  nationality: 'V',
  firstName: 'MARIA',
  lastName: 'PEREZ',
  birthDate: '1990-05-14',
  gender: 'F',
} as any;

describe('EmployeesRepository', () => {
  it('create calls the PKG with binds derived from EMPLOYEE_FIELD_MAP and returns the OUT result', async () => {
    const execute: jest.Mock = jest.fn(async () => ({ outBinds: { p_result_code: 0, p_message: 'OK' } }));
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    const res = await repo.create('VE', dto);
    expect(execute.mock.calls[0][0]).toContain(
      'corsox.pkg_management_employee.prc_crear_datos_basicos',
    );
    expect(execute.mock.calls[0][0]).toContain("TO_DATE(:p_fecha_nacimiento, 'YYYY-MM-DD')");
    expect(execute.mock.calls[0][1]).toMatchObject({
      p_cedula: '12345678',
      p_primer_nombre: 'MARIA',
      p_segundo_nombre: null,
    });
    expect(res).toEqual({ idNumber: '12345678', message: 'OK' });
  });

  it('create maps PKG result code != 0 to 422 with the PKG message', async () => {
    const execute: jest.Mock = jest.fn(async () => ({
      outBinds: { p_result_code: 1, p_message: 'employee rejected' },
    }));
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    await expect(repo.create('VE', dto)).rejects.toThrow(UnprocessableEntityException);
  });

  it('findById maps Oracle columns to English API fields', async () => {
    const execute: jest.Mock = jest.fn(async () => ({
      rows: [{ CEDULA: '12345678', PRIMER_NOMBRE: 'MARIA', SEXO: 'F' }],
    }));
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    const emp = await repo.findById('VE', '12345678');
    expect(emp).toMatchObject({ idNumber: '12345678', firstName: 'MARIA', gender: 'F' });
    expect(emp).not.toHaveProperty('CEDULA');
  });

  it('findById with no rows → NotFoundException', async () => {
    const execute: jest.Mock = jest.fn(async () => ({ rows: [] }));
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    await expect(repo.findById('VE', '0')).rejects.toThrow(NotFoundException);
  });

  it('update builds SET clauses only for provided updatable fields', async () => {
    const execute: jest.Mock = jest
      .fn()
      .mockResolvedValueOnce({ rowsAffected: 1 })
      .mockResolvedValueOnce({ rows: [{ CEDULA: '12345678', PRIMER_NOMBRE: 'ANA' }] });
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    const emp = await repo.update('VE', '12345678', { firstName: 'ANA' } as any);
    expect(execute.mock.calls[0][0]).toContain('PRIMER_NOMBRE = :firstName');
    expect(execute.mock.calls[0][0]).not.toContain('SEXO');
    expect(emp).toMatchObject({ firstName: 'ANA' });
  });

  it('update with empty body → 422', async () => {
    const repo = new EmployeesRepository(tenantSvc(mockPool(jest.fn())));
    await expect(repo.update('VE', '1', {} as any)).rejects.toThrow(UnprocessableEntityException);
  });

  it('softDelete on missing employee → 404', async () => {
    const execute: jest.Mock = jest.fn(async () => ({ rowsAffected: 0 }));
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    await expect(repo.softDelete('VE', '0')).rejects.toThrow(NotFoundException);
  });

  it('ORA-00001 (duplicate) → ConflictException', async () => {
    const execute: jest.Mock = jest.fn(async () => {
      throw Object.assign(new Error('unique constraint violated'), { errorNum: 1 });
    });
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    await expect(repo.create('VE', dto)).rejects.toThrow(ConflictException);
  });

  it('RAISE_APPLICATION_ERROR -20xxx → UnprocessableEntityException with PKG message', async () => {
    const execute: jest.Mock = jest.fn(async () => {
      throw Object.assign(new Error('ORA-20001: id already registered'), { errorNum: 20001 });
    });
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    await expect(repo.create('VE', dto)).rejects.toThrow('id already registered');
  });

  it('always closes the connection, even on error', async () => {
    const execute: jest.Mock = jest.fn(async () => {
      throw Object.assign(new Error('boom'), { errorNum: 600 });
    });
    const pool = mockPool(execute);
    const repo = new EmployeesRepository(tenantSvc(pool));
    await expect(repo.create('VE', dto)).rejects.toThrow();
    const conn = await pool.getConnection.mock.results[0].value;
    expect(conn.close).toHaveBeenCalled();
  });
});
