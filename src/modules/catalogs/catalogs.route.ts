import { Router } from 'express';
import { authMiddleware } from '../../interfaces/middlewares/auth.middleware';
import { countryMiddleware } from '../../interfaces/middlewares/country.middleware';
import { CATALOG_DEFINITIONS } from './catalog.definitions';
import { catalogsController } from './catalogs.controller';

const router = Router();

router.use(authMiddleware, countryMiddleware);

// Una ruta POST /<key>/list por catálogo, todas con el mismo contrato
// { page, size } -> { page, size, items }. Ver catalog.definitions.ts.
for (const def of CATALOG_DEFINITIONS) {
  router.post(`/${def.key}/list`, catalogsController.list(def.key));
}

export default router;
