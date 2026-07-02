import { Injectable } from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesRepository } from './employees.repository';

@Injectable()
export class EmployeesService {
  constructor(private readonly repo: EmployeesRepository) {}

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
