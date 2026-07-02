import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { TenantConnectionService } from '../database/tenant-connection.service';

@Controller('health')
export class HealthController {
  constructor(private readonly tenants: TenantConnectionService) {}

  @Public()
  @Get()
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  ready() {
    return { status: 'ok', countries: this.tenants.enabledCountries() };
  }
}
