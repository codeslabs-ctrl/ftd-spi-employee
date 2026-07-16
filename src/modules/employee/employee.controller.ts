import { NextFunction, Request, Response } from 'express';
import { validateDto } from '../../shared/utils/validate.util';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesDto } from './dto/list-employees.dto';
import { SearchEmployeeDto } from './dto/search-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { createEmployeesService, EmployeesService } from './employee.service';

function svc(): EmployeesService {
  return createEmployeesService();
}

export const employeeController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(CreateEmployeeDto, req.body);
      const result = await svc().create(req.countryCode!, dto);
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  },

  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(SearchEmployeeDto, req.body);
      const result = await svc().findById(req.countryCode!, dto.idNumber);
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(ListEmployeesDto, req.body);
      const result = await svc().findAll(
        req.countryCode!,
        dto.page ?? 1,
        dto.size ?? 20,
      );
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(UpdateEmployeeDto, req.body);
      const result = await svc().update(req.countryCode!, dto.idNumber, dto);
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(SearchEmployeeDto, req.body);
      await svc().remove(req.countryCode!, dto.idNumber);
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  },
};
