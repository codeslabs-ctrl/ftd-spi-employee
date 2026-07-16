import { Router } from 'express';
import { authMiddleware } from '../../interfaces/middlewares/auth.middleware';
import { countryMiddleware } from '../../interfaces/middlewares/country.middleware';
import { jobPostController } from './job-post.controller';

const router = Router();

router.use(authMiddleware, countryMiddleware);

router.post('/get', jobPostController.get);
router.post('/list', jobPostController.list);

export default router;
