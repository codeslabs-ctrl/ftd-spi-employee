import { Router } from 'express';
import { authMiddleware } from '../../interfaces/middlewares/auth.middleware';
import { countryMiddleware } from '../../interfaces/middlewares/country.middleware';
import { maritalStatusController } from './marital-status.controller';

const router = Router();

router.use(authMiddleware, countryMiddleware);

router.post('/list', maritalStatusController.list);

export default router;
