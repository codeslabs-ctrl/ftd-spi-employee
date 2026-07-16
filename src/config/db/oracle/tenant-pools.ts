import * as oracledb from 'oracledb';
import { getConfig } from '../../configuration';
import logger from '../../../infrastructure/log/logger';
import { internalError } from '../../../shared/errors/http-error';

const pools = new Map<string, oracledb.Pool>();

export async function initializeDatabases(): Promise<void> {
  if (process.env.FAKE_DB === 'true') {
    logger.warn('FAKE_DB=true — skipping Oracle pool creation (in-memory mode)');
    return;
  }
  const cfg = getConfig();
  for (const [cc, db] of Object.entries(cfg.countries)) {
    if (!db) continue;
    const pool = await oracledb.createPool({
      poolAlias: cc,
      connectString: db.connectString,
      user: db.user,
      password: db.password,
      poolMin: db.poolMin,
      poolMax: db.poolMax,
      poolTimeout: cfg.oracle.poolTimeout,
      queueTimeout: cfg.oracle.queueTimeout,
    });
    pools.set(cc, pool);
    logger.info(
      `Oracle pool created for ${cc} (min=${db.poolMin} max=${db.poolMax})`,
    );
  }
}

export function getPool(country: string): oracledb.Pool {
  const pool = pools.get(country);
  if (!pool) throw internalError(`No connection pool for ${country}`);
  return pool;
}

export function enabledCountries(): string[] {
  if (process.env.FAKE_DB === 'true') {
    return Object.keys(getConfig().countries);
  }
  return [...pools.keys()];
}

export async function closeDatabases(): Promise<void> {
  for (const pool of pools.values()) {
    await pool.close(5);
  }
  pools.clear();
}
