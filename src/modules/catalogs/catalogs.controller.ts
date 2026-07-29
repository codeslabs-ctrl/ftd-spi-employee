import { NextFunction, Request, Response } from 'express';
import { validateDto } from '../../shared/utils/validate.util';
import { createCatalogsService, CatalogsService } from './catalogs.service';
import { ListCatalogDto } from './dto/list-catalog.dto';
import { ValidateReentryDto } from './dto/validate-reentry.dto';

function svc(): CatalogsService {
  return createCatalogsService();
}

export const catalogsController = {
  /** Fábrica: un handler de "list" por catálogo (mismo contrato, distinta clave). */
  list:
    (catalogKey: string) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const dto = await validateDto(ListCatalogDto, req.body);
        const result = await svc().findAll(
          req.countryCode!,
          catalogKey,
          dto.page ?? 1,
          dto.size ?? 20,
          {
            companyId: dto.companyId,
            countryCode: dto.countryCode,
            stateCode: dto.stateCode,
            municipalityId: dto.municipalityId,
            payrollTypeCode: dto.payrollTypeCode,
          },
        );
        res.status(200).json(result);
      } catch (e) {
        next(e);
      }
    },

  validateReentry: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto = await validateDto(ValidateReentryDto, req.body);
      const result = await svc().validateReentry(
        req.countryCode!,
        dto.numIden,
        dto.reingreso,
      );
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  },
};
