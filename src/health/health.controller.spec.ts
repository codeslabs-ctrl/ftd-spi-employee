import { TenantConnectionService } from '../database/tenant-connection.service';
import { HealthController } from './health.controller';

const tenants = {
  enabledCountries: () => ['VE'],
} as unknown as TenantConnectionService;

describe('HealthController', () => {
  it('live returns ok', () => {
    expect(new HealthController(tenants).live()).toEqual({ status: 'ok' });
  });

  it('ready includes countries with an active pool', () => {
    expect(new HealthController(tenants).ready()).toEqual({
      status: 'ok',
      countries: ['VE'],
    });
  });
});
