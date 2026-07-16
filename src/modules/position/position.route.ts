import { Router } from 'express';
import { authMiddleware } from '../../interfaces/middlewares/auth.middleware';
import { countryMiddleware } from '../../interfaces/middlewares/country.middleware';
import { positionController } from './position.controller';

const router = Router();

router.use(authMiddleware, countryMiddleware);

router.post('/create', positionController.create);
router.post('/get', positionController.get);
router.post('/list', positionController.list);
router.post('/update', positionController.update);

export default router;
