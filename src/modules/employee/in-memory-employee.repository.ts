import { conflict, notFound } from '../../shared/errors/http-error';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { toEmployeePayload } from './employee-field.map';

export class InMemoryEmployeesRepository {
  private readonly store = new Map<string, Record<string, unknown>>();

  private key(country: string, idNumber: string) {
    return `${country}:${idNumber}`;
  }

  async create(country: string, dto: CreateEmployeeDto) {
    const k = this.key(country, dto.idNumber);
    if (this.store.has(k)) throw conflict('Employee already exists');
    this.store.set(k, { ...toEmployeePayload(dto), active: 'S' });
    return { idNumber: dto.idNumber, message: 'OK' };
  }

  async findById(country: string, idNumber: string) {
    const emp = this.store.get(this.key(country, idNumber));
    if (!emp || emp.active === 'N') {
      throw notFound(`Employee ${idNumber} not found`);
    }
    return emp;
  }

  async findAll(country: string, page: number, size: number) {
    const prefix = `${country}:`;
    const items = [...this.store.entries()]
      .filter(([k, v]) => k.startsWith(prefix) && v.active !== 'N')
      .map(([, v]) => v);
    const start = (page - 1) * size;
    return { page, size, items: items.slice(start, start + size) };
  }

  async update(country: string, idNumber: string, dto: UpdateEmployeeDto) {
    const emp = await this.findById(country, idNumber);
    const merged = {
      ...emp,
      ...toEmployeePayload({ ...(dto as object), idNumber }),
    };
    this.store.set(this.key(country, idNumber), merged);
    return merged;
  }

  async softDelete(country: string, idNumber: string) {
    const emp = await this.findById(country, idNumber);
    emp.active = 'N';
  }
}
