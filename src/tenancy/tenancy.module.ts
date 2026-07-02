import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CountryMiddleware } from './country.middleware';

@Module({})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CountryMiddleware)
      .exclude('api/v1/auth/(.*)', 'health', 'health/(.*)', 'docs')
      .forRoutes('*');
  }
}
