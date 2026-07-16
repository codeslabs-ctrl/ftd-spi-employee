import { Router } from 'express';
import { authMiddleware } from '../../interfaces/middlewares/auth.middleware';
import { countryMiddleware } from '../../interfaces/middlewares/country.middleware';
import { orgUnitController } from './org-unit.controller';

const router = Router();

router.use(authMiddleware, countryMiddleware);

router.post('/get', orgUnitController.get);
router.post('/list', orgUnitController.list);

export default router;
