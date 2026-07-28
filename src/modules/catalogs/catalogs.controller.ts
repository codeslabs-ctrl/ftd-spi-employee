import { NextFunction, Request, Response } from 'express';
import { validateDto } from '../../shared/utils/validate.util';
import { createCatalogsService, CatalogsService } from './catalogs.service';
import { ListCatalogDto } from './dto/list-catalog.dto';

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
        );
        res.status(200).json(result);
      } catch (e) {
        next(e);
      }
    },
};
