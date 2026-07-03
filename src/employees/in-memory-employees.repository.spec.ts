import { ConflictException, NotFoundException } from '@nestjs/common';
import { InMemoryEmployeesRepository } from './in-memory-employees.repository';

const dto = {
  idNumber: '12345678',
  nationality: 'VENEZOLANO',
  firstName: 'MARIA',
  lastName: 'PEREZ',
  birthDate: '1990-05-14',
  gender: 'F',
} as any;

describe('InMemoryEmployeesRepository', () => {
  let repo: InMemoryEmployeesRepository;
  beforeEach(() => {
    repo = new InMemoryEmployeesRepository();
  });

  it('creates and retrieves an employee', async () => {
    const res = await repo.create('VE', dto);
    expect(res).toEqual({
      idNumber: '12345678',
      message: 'TRANSACCION EXITOSA',
    });
    const emp = await repo.findById('VE', '12345678');
    expect(emp).toMatchObject({ idNumber: '12345678', firstName: 'MARIA' });
  });

  it('rejects duplicates with 409', async () => {
    await repo.create('VE', dto);
    await expect(repo.create('VE', dto)).rejects.toThrow(ConflictException);
  });

  it('isolates data by country', async () => {
    await repo.create('VE', dto);
    await expect(repo.findById('CO', '12345678')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findById of unknown id → 404', async () => {
    await expect(repo.findById('VE', '0')).rejects.toThrow(NotFoundException);
  });

  it('lists with pagination', async () => {
    await repo.create('VE', dto);
    await repo.create('VE', { ...dto, idNumber: '999' });
    const page1 = await repo.findAll('VE', 1, 1);
    expect(page1.items).toHaveLength(1);
    const all = await repo.findAll('VE', 1, 20);
    expect(all.items).toHaveLength(2);
  });

  it('updates an existing employee', async () => {
    await repo.create('VE', dto);
    const updated = await repo.update('VE', '12345678', {
      firstName: 'ANA',
    } as any);
    expect(updated).toMatchObject({ firstName: 'ANA' });
    expect((await repo.findById('VE', '12345678')).firstName).toBe('ANA');
  });

  it('update of unknown id → 404', async () => {
    await expect(
      repo.update('VE', '0', { firstName: 'X' } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('soft delete hides the employee and excludes it from listings', async () => {
    await repo.create('VE', dto);
    await repo.softDelete('VE', '12345678');
    await expect(repo.findById('VE', '12345678')).rejects.toThrow(
      NotFoundException,
    );
    expect((await repo.findAll('VE', 1, 20)).items).toHaveLength(0);
  });

  it('soft delete of unknown id → 404', async () => {
    await expect(repo.softDelete('VE', '0')).rejects.toThrow(NotFoundException);
  });
});
