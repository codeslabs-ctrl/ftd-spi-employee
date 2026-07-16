/**
 * Side-effect import: load .env before any module reads getConfig().
 * Must be the first import in index.ts.
 */
import { loadEnv } from './environment';
import { resetConfigCache } from '../configuration';

loadEnv();
resetConfigCache();
