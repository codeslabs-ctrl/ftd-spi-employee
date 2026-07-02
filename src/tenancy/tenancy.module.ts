import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CountryMiddleware } from './country.middleware';

@Module({})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CountryMiddleware)
      // exclude patterns with and without the global prefix — Nest matches middleware
      // paths differently depending on version/prefix configuration
      .exclude(
        'auth/(.*)',
        'api/v1/auth/(.*)',
        'health',
        'health/ready',
        'health/(.*)',
        'docs',
        'docs/(.*)',
      )
      .forRoutes('*');
  }
}
