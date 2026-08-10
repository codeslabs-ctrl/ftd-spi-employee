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
import { requestLogger } from './interfaces/middlewares/requestLogger.middleware';
import { apiRouter } from './interfaces/routes/index.route';

const cfg = getConfig();

const app = express();

// App Engine standard puts exactly one trusted reverse proxy (the Google
// Frontend) in front of this service. Without this, Express's default
// (trust proxy: false) makes req.ip resolve to the GFE's own address for
// every request — collapsing express-rate-limit's per-IP buckets into one
// shared bucket for all clients — while `1` (not `true`) makes it read the
// single hop the GFE actually appends, instead of blindly trusting a
// caller-supplied X-Forwarded-For chain (pentest finding: rate limit
// keyed off an untrusted X-Forwarded-For header).
app.set('trust proxy', 1);

app.use(
  helmet({
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }),
);

// helmet doesn't set Permissions-Policy (its old Feature-Policy middleware
// was removed) — set it explicitly. This is a pure API with no camera/mic/
// geolocation/payment usage, so deny all.
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );
  next();
});

app.use(express.json({ limit: cfg.bodyParserLimit }));
app.use(
  express.urlencoded({ limit: cfg.bodyParserLimit, extended: true }),
);

// NOTE: payload crypto (RequestJson decrypt / ResponseJson encrypt) is
// mounted INSIDE apiRouter (interfaces/routes/index.route.ts), AFTER the
// auth+country gate — not here. Mounting it globally before auth let an
// unauthenticated request with a garbage RequestJson body short-circuit
// with 400 "Invalid encrypted payload" before ever reaching the JWT check,
// instead of 401 (pentest finding: middleware order / CWE-287). Auth must
// see every request before the crypto layer touches the body.

if (cfg.corsOrigins.length) {
  app.use(
    cors({
      origin: cfg.corsOrigins,
      credentials: true,
      // Every route in this API is GET (health) or POST (business
      // endpoints) — no PUT/DELETE/PATCH handler exists anywhere, so don't
      // advertise them in CORS preflight (pentest finding: unnecessary
      // methods allowed).
      methods: ['GET', 'POST', 'OPTIONS'],
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

// Data returned here (employees, payroll-adjacent catalogs, org data) must
// never be cached by intermediate proxies/CDNs (pentest finding: missing
// Cache-Control on responses with sensitive data).
app.use('/ftd-spi-employee/rest', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

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
