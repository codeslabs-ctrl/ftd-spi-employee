import { NextFunction, Request, Response } from 'express';
import { validateDto } from '../../shared/utils/validate.util';
import { ListOrgUnitsDto } from './dto/list-org-units.dto';
import { SearchOrgUnitDto } from './dto/search-org-unit.dto';
import { createOrgUnitsService, OrgUnitsService } from './org-unit.service';

function svc(): OrgUnitsService {
  return createOrgUnitsService();
}

export const orgUnitController = {
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(SearchOrgUnitDto, req.body);
      const result = await svc().findById(
        req.countryCode!,
        dto.companyId,
        dto.id,
      );
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(ListOrgUnitsDto, req.body);
      const result = await svc().findAll(
        req.countryCode!,
        dto.page ?? 1,
        dto.size ?? 20,
        dto.companyId,
      );
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  },
};
