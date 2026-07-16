import { NextFunction, Request, Response } from 'express';
import { validateDto } from '../../shared/utils/validate.util';
import { createCompaniesService, CompaniesService } from './company.service';
import { ListCompaniesDto } from './dto/list-companies.dto';
import { SearchCompanyDto } from './dto/search-company.dto';

function svc(): CompaniesService {
  return createCompaniesService();
}

export const companyController = {
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(SearchCompanyDto, req.body);
      const result = await svc().findById(req.countryCode!, dto.id);
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(ListCompaniesDto, req.body);
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
};
