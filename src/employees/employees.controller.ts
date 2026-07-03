import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesQuery } from './dto/list-employees.query';
import { SearchEmployeeDto } from './dto/search-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

interface TenantRequest {
  countryCode: string;
}

@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly svc: EmployeesService) {}

  @Post()
  create(@Req() req: TenantRequest, @Body() dto: CreateEmployeeDto) {
    return this.svc.create(req.countryCode, dto);
  }

  // Reads via POST (Farmatodo P2C): the identifier travels in the encrypted body
  // (RequestJson), never in the URL where it would leak into access logs.
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

  @Put(':id')
  update(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.svc.update(req.countryCode, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.svc.remove(req.countryCode, id);
  }
}
