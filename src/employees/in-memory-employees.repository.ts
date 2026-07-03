import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { toEmployeePayload } from './employee-field.map';

/**
 * Dev/demo-only stub. Activated when FAKE_DB=true so the full HTTP contract can be
 * exercised without an Oracle instance. NOT used in production — the module factory
 * wires the real EmployeesRepository unless the flag is set.
 */
@Injectable()
export class InMemoryEmployeesRepository {
  // key: `${country}:${idNumber}`
  private readonly store = new Map<string, Record<string, unknown>>();

  private key(country: string, idNumber: string) {
    return `${country}:${idNumber}`;
  }

  async create(country: string, dto: CreateEmployeeDto) {
    const k = this.key(country, dto.idNumber);
    if (this.store.has(k)) throw new ConflictException('Employee already exists');
    this.store.set(k, { ...toEmployeePayload(dto), active: 'S' });
    return { idNumber: dto.idNumber, message: 'TRANSACCION EXITOSA' };
  }

  async findById(country: string, idNumber: string) {
    const emp = this.store.get(this.key(country, idNumber));
    if (!emp || emp.active === 'N') {
      throw new NotFoundException(`Employee ${idNumber} not found`);
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
    const merged = { ...emp, ...toEmployeePayload({ ...(dto as object), idNumber }) };
    this.store.set(this.key(country, idNumber), merged);
    return merged;
  }

  async softDelete(country: string, idNumber: string) {
    const emp = await this.findById(country, idNumber);
    emp.active = 'N';
  }
}
