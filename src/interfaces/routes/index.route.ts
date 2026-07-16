import { Router } from 'express';
import authRouter from '../../modules/auth/auth.route';
import companyRouter from '../../modules/company/company.route';
import employeeRouter from '../../modules/employee/employee.route';
import { healthController } from '../../modules/health/health.controller';
import jobPostRouter from '../../modules/job-post/job-post.route';
import maritalStatusRouter from '../../modules/marital-status/marital-status.route';
import orgUnitRouter from '../../modules/org-unit/org-unit.route';
import positionRouter from '../../modules/position/position.route';

const router = Router();

// Public health (no API prefix) — SPI contract
router.get('/health', healthController.live);
router.get('/health/ready', healthController.ready);

// Business API under existing Nest prefix (do not change for clients)
const api = Router();
api.use('/security', authRouter);
api.use('/employee', employeeRouter);
api.use('/position', positionRouter);
api.use('/company', companyRouter);
api.use('/marital-status', maritalStatusRouter);
api.use('/job-post', jobPostRouter);
api.use('/org-unit', orgUnitRouter);
router.use('/ftd-spi-employee/rest', api);

router.use('*', (req, res) => {
  res.status(404).json({
    statusCode: 404,
    message: 'Endpoint not found',
    errors: [],
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
});

export const apiRouter = router;
