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

// All operations use POST so the identifier (cédula) always travels in the body
// (encryptable as RequestJson) and never in the URL — Farmatodo P2C standard.
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly svc: EmployeesService) {}

  @Post()
  create(@Req() req: TenantRequest, @Body() dto: CreateEmployeeDto) {
    return this.svc.create(req.countryCode, dto);
  }

  @Post('search')
  @HttpCode(200)
  search(@Req() req: TenantRequest, @Body() dto: SearchEmployeeDto) {
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
