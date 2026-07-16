import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesRepository } from './employee.repository';
import { InMemoryEmployeesRepository } from './in-memory-employee.repository';

export type EmployeeRepo = EmployeesRepository | InMemoryEmployeesRepository;

export class EmployeesService {
  constructor(private readonly repo: EmployeeRepo) {}

  create(country: string, dto: CreateEmployeeDto) {
    return this.repo.create(country, dto);
  }

  findById(country: string, idNumber: string) {
    return this.repo.findById(country, idNumber);
  }

  findAll(country: string, page: number, size: number) {
    return this.repo.findAll(country, page, size);
  }

  update(country: string, idNumber: string, dto: UpdateEmployeeDto) {
    return this.repo.update(country, idNumber, dto);
  }

  remove(country: string, idNumber: string) {
    return this.repo.softDelete(country, idNumber);
  }
}

let singleton: EmployeesService | null = null;

/** Lazy so .env is loaded (via preload) before EmployeesRepository reads PKG name. */
export function createEmployeesService(): EmployeesService {
  if (!singleton) {
    const repo =
      process.env.FAKE_DB === 'true'
        ? new InMemoryEmployeesRepository()
        : new EmployeesRepository();
    singleton = new EmployeesService(repo);
  }
  return singleton;
}
