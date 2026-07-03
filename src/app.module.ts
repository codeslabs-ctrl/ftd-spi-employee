import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { CryptoModule } from './crypto/crypto.module';
import { DatabaseModule } from './database/database.module';
import { EmployeesModule } from './employees/employees.module';
import { HealthModule } from './health/health.module';
import { CountryGuard } from './tenancy/country.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Global rate limit: 60 requests/minute per IP (OWASP API4). Tighter limits
    // on sensitive routes via @Throttle (see AuthController).
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    CryptoModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    EmployeesModule,
  ],
  // Guard order is the registration order: rate-limit → authenticate → tenant/country.
  // Country validation runs AFTER auth so unauthenticated callers get 401 first
  // and cannot enumerate enabled countries.
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CountryGuard },
  ],
})
export class AppModule {}
