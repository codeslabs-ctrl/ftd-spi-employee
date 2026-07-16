import 'reflect-metadata';
// MUST be before apiRouter / repositories so .env is available at getConfig()
import './config/environment/preload';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { getConfig } from './config/configuration';
import {
  closeDatabases,
  initializeDatabases,
} from './config/db/oracle/tenant-pools';
import logger from './infrastructure/log/logger';
import { errorHandlerMiddleware } from './interfaces/middlewares/errorHandler.middleware';
import { payloadCryptoMiddleware } from './interfaces/middlewares/payload-crypto.middleware';
import { requestLogger } from './interfaces/middlewares/requestLogger.middleware';
import { apiRouter } from './interfaces/routes/index.route';

const cfg = getConfig();

const app = express();

app.use(
  helmet({
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }),
);

app.use(express.json({ limit: cfg.bodyParserLimit }));
app.use(
  express.urlencoded({ limit: cfg.bodyParserLimit, extended: true }),
);

// SPI P2C: RequestJson → clear body; ResponseJson on way out (optional)
app.use(payloadCryptoMiddleware);

if (cfg.corsOrigins.length) {
  app.use(
    cors({
      origin: cfg.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Country-Code'],
      maxAge: 3600,
    }),
  );
}

app.use(requestLogger);

app.use((req, res, next) => {
  const ms = cfg.requestTimeoutMs;
  req.setTimeout(ms);
  res.setTimeout(ms);
  next();
});

const limiter = rateLimit({
  windowMs: cfg.rateLimitWindowMs,
  limit: cfg.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/ftd-spi-employee/rest', limiter);

app.get('/', (_req, res) => {
  res.send('Farmatodo C.A | ftd-spi-employee - API ✅');
});

app.use(apiRouter);
app.use(errorHandlerMiddleware);

export { app };

async function startServer() {
  try {
    await initializeDatabases();
    const shutdown = async () => {
      logger.info('Closing Oracle pools...');
      await closeDatabases();
      process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    app.listen(cfg.port, () => {
      logger.info(
        `Server listening on port ${cfg.port} (EMPLOYEE_PKG=${cfg.employeePkg})`,
      );
    });
  } catch (error) {
    logger.error(`Fatal start error: ${String(error)}`);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Error starting server:', err);
    process.exit(1);
  });
}
