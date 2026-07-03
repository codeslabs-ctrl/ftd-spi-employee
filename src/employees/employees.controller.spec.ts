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

  it('search takes the idNumber from the body (not the URL)', () => {
    controller.search(req, { idNumber: '1' } as any);
    expect(svc.findById).toHaveBeenCalledWith('VE', '1');
  });

  it('list passes pagination from the body', () => {
    controller.list(req, { page: 3, size: 50 } as any);
    expect(svc.findAll).toHaveBeenCalledWith('VE', 3, 50);
  });

  it('update takes idNumber from the body', () => {
    const body = { idNumber: '1', firstName: 'ANA' } as any;
    controller.update(req, body);
    expect(svc.update).toHaveBeenCalledWith('VE', '1', body);
  });

  it('remove takes idNumber from the body (not the URL)', () => {
    controller.remove(req, { idNumber: '1' } as any);
    expect(svc.remove).toHaveBeenCalledWith('VE', '1');
  });
});
