import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller';

const router = Router();

const tokenLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    statusCode: 429,
    message: 'Too many requests',
    errors: [],
    timestamp: new Date().toISOString(),
    path: '/ftd-spi-employee/rest/security/token',
  },
});

router.post('/token', tokenLimiter, authController.token);

export default router;
