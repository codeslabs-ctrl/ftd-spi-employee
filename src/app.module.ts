import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { EmployeesModule } from './employees/employees.module';
import { HealthModule } from './health/health.module';
import { TenancyModule } from './tenancy/tenancy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Global rate limit: 60 requests/minute per IP (OWASP API4). Tighter limits
    // on sensitive routes via @Throttle (see AuthController).
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    DatabaseModule,
    AuthModule,
    HealthModule,
    EmployeesModule,
    TenancyModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
