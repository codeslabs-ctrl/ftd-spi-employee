import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';
import { CountryDbConfig } from '../config/configuration';

@Injectable()
export class TenantConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TenantConnectionService.name);
  private readonly pools = new Map<string, oracledb.Pool>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const countries: Record<string, CountryDbConfig> =
      this.config.get('countries') ?? {};
    for (const [cc, db] of Object.entries(countries)) {
      const pool = await oracledb.createPool({
        poolAlias: cc,
        connectString: db.connectString,
        user: db.user,
        password: db.password,
        poolMin: db.poolMin,
        poolMax: db.poolMax,
      });
      this.pools.set(cc, pool);
      this.logger.log(`Oracle pool created for ${cc}`);
    }
  }

  getPool(country: string): oracledb.Pool {
    const pool = this.pools.get(country);
    if (!pool)
      throw new InternalServerErrorException(
        `No connection pool for ${country}`,
      );
    return pool;
  }

  enabledCountries(): string[] {
    return [...this.pools.keys()];
  }

  async onModuleDestroy() {
    for (const pool of this.pools.values()) {
      await pool.close(5);
    }
  }
}
