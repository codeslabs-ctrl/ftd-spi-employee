import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesQuery } from './dto/list-employees.query';
import { SearchEmployeeDto } from './dto/search-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

interface TenantRequest {
  countryCode: string;
}

// Farmatodo route style: verb at the end, all POST. The identifier (cédula)
// always travels in the body (encryptable) — never in the URL.
@ApiBearerAuth()
@Controller('employee')
export class EmployeesController {
  constructor(private readonly svc: EmployeesService) {}

  @Post('create')
  create(@Req() req: TenantRequest, @Body() dto: CreateEmployeeDto) {
    return this.svc.create(req.countryCode, dto);
  }

  @Post('get')
  @HttpCode(200)
  get(@Req() req: TenantRequest, @Body() dto: SearchEmployeeDto) {
    return this.svc.findById(req.countryCode, dto.idNumber);
  }

  @Post('list')
  @HttpCode(200)
  list(@Req() req: TenantRequest, @Body() dto: ListEmployeesQuery) {
    return this.svc.findAll(req.countryCode, dto.page, dto.size);
  }

  @Post('update')
  @HttpCode(200)
  update(@Req() req: TenantRequest, @Body() dto: UpdateEmployeeDto) {
    return this.svc.update(req.countryCode, dto.idNumber, dto);
  }

  @Post('delete')
  @HttpCode(204)
  remove(@Req() req: TenantRequest, @Body() dto: SearchEmployeeDto) {
    return this.svc.remove(req.countryCode, dto.idNumber);
  }
}
