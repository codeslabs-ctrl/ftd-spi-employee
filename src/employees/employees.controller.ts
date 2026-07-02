import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesQuery } from './dto/list-employees.query';
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

  @Get(':id')
  findOne(@Req() req: TenantRequest, @Param('id') id: string) {
    return this.svc.findById(req.countryCode, id);
  }

  @Get()
  findAll(@Req() req: TenantRequest, @Query() q: ListEmployeesQuery) {
    return this.svc.findAll(req.countryCode, q.page, q.size);
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
