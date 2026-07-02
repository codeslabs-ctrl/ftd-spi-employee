import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { EmployeesRepository } from './employees.repository';

function mockPool(executeImpl: jest.Mock) {
  const conn = { execute: executeImpl, close: jest.fn() };
  return { getConnection: jest.fn(async () => conn) };
}

const tenantSvc = (pool: unknown) =>
  ({ getPool: () => pool }) as unknown as TenantConnectionService;

const pkgOk = (extra: Record<string, unknown> = {}) => ({
  outBinds: { o_cod: '0', o_message: 'OK', ...extra },
});

const dto = {
  idNumber: '12345678',
  nationality: 'VENEZOLANO',
  firstName: 'MARIA',
  lastName: 'PEREZ',
  birthDate: '1990-05-14',
  gender: 'F',
} as any;

describe('EmployeesRepository', () => {
  it('create calls prc_merge_employee with an employees JSON payload', async () => {
    const execute: jest.Mock = jest.fn(async () => pkgOk());
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    const res = await repo.create('VE', dto);

    expect(execute.mock.calls[0][0]).toContain(
      'corsox.pkg_management_employee.prc_merge_employee',
    );
    const sent = JSON.parse(execute.mock.calls[0][1].i_json);
    expect(sent.employees[0]).toMatchObject({
      idNumber: '12345678',
      firstName: 'MARIA',
      gender: 'F',
    });
    expect(sent.employees[0]).not.toHaveProperty('extra');
    expect(res).toEqual({ idNumber: '12345678', message: 'OK' });
  });

  it('create with business rejection (o_cod != success) → 422 with PKG message', async () => {
    const execute: jest.Mock = jest.fn(async () => ({
      outBinds: { o_cod: '2', o_message: 'employee rejected' },
    }));
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    await expect(repo.create('VE', dto)).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('create with PKG WHEN OTHERS (o_cod ORA-xxx) → 500', async () => {
    const execute: jest.Mock = jest.fn(async () => ({
      outBinds: {
        o_cod: 'ORA--942',
        o_message: 'PRC_MERGE_EMPLOYEE - table missing',
      },
    }));
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    await expect(repo.create('VE', dto)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('findById parses O_JSON and returns the first employee', async () => {
    const execute: jest.Mock = jest.fn(async () =>
      pkgOk({
        o_json: JSON.stringify({
          employees: [
            { idNumber: '12345678', firstName: 'MARIA', gender: 'F' },
          ],
        }),
      }),
    );
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    const emp = await repo.findById('VE', '12345678');
    expect(execute.mock.calls[0][0]).toContain('prc_get_employee');
    expect(JSON.parse(execute.mock.calls[0][1].i_json)).toEqual({
      idNumber: '12345678',
    });
    expect(emp).toMatchObject({ idNumber: '12345678', firstName: 'MARIA' });
  });

  it('findById reads O_JSON when it arrives as a CLOB Lob', async () => {
    const lob = {
      getData: jest.fn(async () =>
        JSON.stringify({ employees: [{ idNumber: '12345678' }] }),
      ),
    };
    const execute: jest.Mock = jest.fn(async () => pkgOk({ o_json: lob }));
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    const emp = await repo.findById('VE', '12345678');
    expect(lob.getData).toHaveBeenCalled();
    expect(emp).toMatchObject({ idNumber: '12345678' });
  });

  it('findById with no-records code → 404', async () => {
    const execute: jest.Mock = jest.fn(async () => ({
      outBinds: { o_cod: '1', o_message: 'NO EXISTEN REGISTROS', o_json: null },
    }));
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    await expect(repo.findById('VE', '0')).rejects.toThrow(NotFoundException);
  });

  it('findAll passes pagination and returns items', async () => {
    const execute: jest.Mock = jest.fn(async () =>
      pkgOk({
        o_json: JSON.stringify({
          employees: [{ idNumber: '1' }, { idNumber: '2' }],
        }),
      }),
    );
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    const res = await repo.findAll('VE', 2, 10);
    expect(JSON.parse(execute.mock.calls[0][1].i_json)).toEqual({
      page: 2,
      size: 10,
    });
    expect(res).toEqual({
      page: 2,
      size: 10,
      items: [{ idNumber: '1' }, { idNumber: '2' }],
    });
  });

  it('findAll with no records → empty list, not 404', async () => {
    const execute: jest.Mock = jest.fn(async () => ({
      outBinds: { o_cod: '1', o_message: 'NO EXISTEN REGISTROS', o_json: null },
    }));
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    expect(await repo.findAll('VE', 1, 20)).toEqual({
      page: 1,
      size: 20,
      items: [],
    });
  });

  it('update verifies existence, merges and returns the updated employee', async () => {
    const execute: jest.Mock = jest
      .fn()
      .mockResolvedValueOnce(
        pkgOk({
          o_json: JSON.stringify({ employees: [{ idNumber: '12345678' }] }),
        }),
      )
      .mockResolvedValueOnce(pkgOk())
      .mockResolvedValueOnce(
        pkgOk({
          o_json: JSON.stringify({
            employees: [{ idNumber: '12345678', firstName: 'ANA' }],
          }),
        }),
      );
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    const emp = await repo.update('VE', '12345678', {
      firstName: 'ANA',
    } as any);
    const merged = JSON.parse(execute.mock.calls[1][1].i_json);
    expect(merged.employees[0]).toMatchObject({
      idNumber: '12345678',
      firstName: 'ANA',
    });
    expect(emp).toMatchObject({ firstName: 'ANA' });
  });

  it('update of missing employee → 404 without merging', async () => {
    const execute: jest.Mock = jest.fn(async () => ({
      outBinds: { o_cod: '1', o_message: 'NO EXISTEN REGISTROS', o_json: null },
    }));
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    await expect(
      repo.update('VE', '0', { firstName: 'X' } as any),
    ).rejects.toThrow(NotFoundException);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('softDelete calls prc_delete_employee; missing employee → 404', async () => {
    const ok: jest.Mock = jest.fn(async () => pkgOk());
    await new EmployeesRepository(tenantSvc(mockPool(ok))).softDelete(
      'VE',
      '1',
    );
    expect(ok.mock.calls[0][0]).toContain('prc_delete_employee');

    const missing: jest.Mock = jest.fn(async () => ({
      outBinds: { o_cod: '1', o_message: 'NO EXISTEN REGISTROS' },
    }));
    await expect(
      new EmployeesRepository(tenantSvc(mockPool(missing))).softDelete(
        'VE',
        '0',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('thrown ORA-00001 (duplicate) → ConflictException', async () => {
    const execute: jest.Mock = jest.fn(async () => {
      throw Object.assign(new Error('unique constraint violated'), {
        errorNum: 1,
      });
    });
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    await expect(repo.create('VE', dto)).rejects.toThrow(ConflictException);
  });

  it('thrown RAISE_APPLICATION_ERROR -20xxx → 422 with PKG message', async () => {
    const execute: jest.Mock = jest.fn(async () => {
      throw Object.assign(new Error('ORA-20001: id already registered'), {
        errorNum: 20001,
      });
    });
    const repo = new EmployeesRepository(tenantSvc(mockPool(execute)));
    await expect(repo.create('VE', dto)).rejects.toThrow(
      'id already registered',
    );
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
