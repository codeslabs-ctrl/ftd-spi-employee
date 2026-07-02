jest.mock('oracledb', () => ({
  createPool: jest.fn(async (o: { poolAlias: string }) => ({ alias: o.poolAlias, close: jest.fn() })),
}));

import { ConfigService } from '@nestjs/config';
import * as oracledb from 'oracledb';
import { TenantConnectionService } from './tenant-connection.service';

describe('TenantConnectionService', () => {
  const config = {
    get: () => ({
      VE: { connectString: 'h/SPI', user: 'u', password: 'p', poolMin: 1, poolMax: 5 },
    }),
  } as unknown as ConfigService;

  it('creates one pool per configured country on init', async () => {
    const svc = new TenantConnectionService(config);
    await svc.onModuleInit();
    expect(oracledb.createPool).toHaveBeenCalledWith(
      expect.objectContaining({
        poolAlias: 'VE',
        connectString: 'h/SPI',
        user: 'u',
        poolMin: 1,
        poolMax: 5,
      }),
    );
    expect(svc.getPool('VE')).toBeDefined();
    expect(svc.enabledCountries()).toEqual(['VE']);
  });

  it('getPool for a country without pool throws', async () => {
    const svc = new TenantConnectionService(config);
    await svc.onModuleInit();
    expect(() => svc.getPool('AR')).toThrow();
  });

  it('closes all pools on destroy', async () => {
    const svc = new TenantConnectionService(config);
    await svc.onModuleInit();
    const pool = svc.getPool('VE') as unknown as { close: jest.Mock };
    await svc.onModuleDestroy();
    expect(pool.close).toHaveBeenCalled();
  });
});
