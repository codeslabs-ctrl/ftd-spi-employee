import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListEmployeesQuery } from './list-employees.query';

describe('ListEmployeesQuery', () => {
  it('defaults page=1 and size=20', async () => {
    const q = plainToInstance(ListEmployeesQuery, {});
    expect(await validate(q)).toHaveLength(0);
    expect(q.page).toBe(1);
    expect(q.size).toBe(20);
  });

  it('transforms string query params to numbers', async () => {
    const q = plainToInstance(ListEmployeesQuery, { page: '2', size: '50' });
    expect(await validate(q)).toHaveLength(0);
    expect(q.page).toBe(2);
    expect(q.size).toBe(50);
  });

  it('rejects size above 100', async () => {
    const q = plainToInstance(ListEmployeesQuery, { size: '500' });
    expect((await validate(q)).map((e) => e.property)).toContain('size');
  });
});
