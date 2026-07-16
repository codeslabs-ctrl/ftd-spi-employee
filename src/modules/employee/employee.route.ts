import { Router } from 'express';
import { authMiddleware } from '../../interfaces/middlewares/auth.middleware';
import { countryMiddleware } from '../../interfaces/middlewares/country.middleware';
import { employeeController } from './employee.controller';

const router = Router();

router.use(authMiddleware, countryMiddleware);

router.post('/create', employeeController.create);
router.post('/get', employeeController.get);
router.post('/list', employeeController.list);
router.post('/update', employeeController.update);
router.post('/delete', employeeController.remove);

export default router;
