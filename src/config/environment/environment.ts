import dotenv from 'dotenv';
import path from 'path';

/**
 * Load .env / .env.staging / .env.production by NODE_ENV (archetype pattern).
 * Soft validation: JWT keys required unless FAKE_DB for local demos with generated keys elsewhere.
 */
export function loadEnv(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const envFile = nodeEnv === 'development' ? '.env' : `.env.${nodeEnv}`;
  const envPath = path.resolve(process.cwd(), envFile);
  dotenv.config({ path: envPath });
  // Also try plain .env as fallback
  if (envFile !== '.env') {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  }
}
