import { NextFunction, Request, Response } from 'express';
import { validateDto } from '../../shared/utils/validate.util';
import { ListMaritalStatusesDto } from './dto/list-marital-statuses.dto';
import {
  createMaritalStatusesService,
  MaritalStatusesService,
} from './marital-status.service';

function svc(): MaritalStatusesService {
  return createMaritalStatusesService();
}

export const maritalStatusController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(ListMaritalStatusesDto, req.body);
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
