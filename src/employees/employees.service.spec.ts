import { EmployeesRepository } from './employees.repository';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  const repo = {
    create: jest.fn().mockResolvedValue({ idNumber: '1', message: 'OK' }),
    findById: jest.fn().mockResolvedValue({ idNumber: '1' }),
    findAll: jest.fn().mockResolvedValue({ page: 1, size: 20, items: [] }),
    update: jest.fn().mockResolvedValue({ idNumber: '1' }),
    softDelete: jest.fn().mockResolvedValue(undefined),
  } as unknown as EmployeesRepository;
  const svc = new EmployeesService(repo);
  const dto = { idNumber: '1' } as any;

  it('delegates create to the repository with the country', async () => {
    await svc.create('VE', dto);
    expect(repo.create).toHaveBeenCalledWith('VE', dto);
  });

  it('delegates findById', async () => {
    await svc.findById('VE', '1');
    expect(repo.findById).toHaveBeenCalledWith('VE', '1');
  });

  it('delegates findAll with pagination', async () => {
    await svc.findAll('VE', 2, 10);
    expect(repo.findAll).toHaveBeenCalledWith('VE', 2, 10);
  });

  it('delegates update', async () => {
    await svc.update('VE', '1', dto);
    expect(repo.update).toHaveBeenCalledWith('VE', '1', dto);
  });

  it('delegates remove to softDelete', async () => {
    await svc.remove('VE', '1');
    expect(repo.softDelete).toHaveBeenCalledWith('VE', '1');
  });
});
