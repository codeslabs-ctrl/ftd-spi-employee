import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';

describe('EmployeesController', () => {
  const svc = {
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  } as unknown as EmployeesService;
  const controller = new EmployeesController(svc);
  const req = { countryCode: 'VE' };
  const dto = { idNumber: '1' } as any;

  it('create passes the tenant country and body', () => {
    controller.create(req, dto);
    expect(svc.create).toHaveBeenCalledWith('VE', dto);
  });

  it('findOne passes the id', () => {
    controller.findOne(req, '1');
    expect(svc.findById).toHaveBeenCalledWith('VE', '1');
  });

  it('findAll passes pagination', () => {
    controller.findAll(req, { page: 3, size: 50 });
    expect(svc.findAll).toHaveBeenCalledWith('VE', 3, 50);
  });

  it('update passes id and body', () => {
    controller.update(req, '1', dto);
    expect(svc.update).toHaveBeenCalledWith('VE', '1', dto);
  });

  it('remove passes the id', () => {
    controller.remove(req, '1');
    expect(svc.remove).toHaveBeenCalledWith('VE', '1');
  });
});
