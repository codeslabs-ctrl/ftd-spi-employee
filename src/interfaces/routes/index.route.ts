import { Router } from 'express';
import authRouter from '../../modules/auth/auth.route';
import catalogsRouter from '../../modules/catalogs/catalogs.route';
import companyRouter from '../../modules/company/company.route';
import employeeRouter from '../../modules/employee/employee.route';
import { healthController } from '../../modules/health/health.controller';
import jobPostRouter from '../../modules/job-post/job-post.route';
import maritalStatusRouter from '../../modules/marital-status/marital-status.route';
import orgUnitRouter from '../../modules/org-unit/org-unit.route';
import positionRouter from '../../modules/position/position.route';
import { authMiddleware } from '../middlewares/auth.middleware';
import { countryMiddleware } from '../middlewares/country.middleware';
import { payloadCryptoMiddleware } from '../middlewares/payload-crypto.middleware';

const router = Router();

// Public health (no API prefix) — SPI contract
router.get('/health', healthController.live);
router.get('/health/ready', healthController.ready);

// Business API under existing Nest prefix (do not change for clients)
const api = Router();

// /security/token is the only public business endpoint (issues the JWT
// itself — nothing to authenticate against yet). Mounted BEFORE the auth
// gate below so it never has to pass it.
api.use('/security', authRouter);

// Auth + country gate for everything else, applied BEFORE payload crypto.
// authMiddleware/countryMiddleware only read headers (Authorization,
// X-Country-Code), never the body, so this order is safe and ensures a
// missing/invalid/expired token always gets a plain 401 first — the
// RequestJson decrypt/ResponseJson encrypt layer never runs for a request
// that isn't authenticated yet. (Each route also re-applies this pair as
// defense in depth; the extra jwt.verify call is cheap.)
api.use(authMiddleware, countryMiddleware);
api.use(payloadCryptoMiddleware);

api.use('/employee', employeeRouter);
api.use('/position', positionRouter);
api.use('/company', companyRouter);
api.use('/marital-status', maritalStatusRouter);
api.use('/job-post', jobPostRouter);
api.use('/org-unit', orgUnitRouter);
api.use('/catalogs', catalogsRouter);
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
