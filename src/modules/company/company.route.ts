import { Router } from 'express';
import { authMiddleware } from '../../interfaces/middlewares/auth.middleware';
import { countryMiddleware } from '../../interfaces/middlewares/country.middleware';
import { companyController } from './company.controller';

const router = Router();

router.use(authMiddleware, countryMiddleware);

router.post('/get', companyController.get);
router.post('/list', companyController.list);

export default router;
