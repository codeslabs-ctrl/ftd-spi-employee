import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Security headers. TLS is terminated at Cloud Run; HSTS instructs clients to
  // always use HTTPS. NOTE: this service must ALWAYS run behind TLS — never expose
  // the container port directly.
  app.use(
    helmet({
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    }),
  );

  // CORS: only the configured browser origins (e.g. https://mi-portal.farmatodo.com).
  const corsOrigins = config.get<string[]>('corsOrigins') ?? [];
  if (corsOrigins.length) {
    app.enableCors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Country-Code'],
      maxAge: 3600,
    });
  }

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  // Swagger only outside production (or when explicitly enabled) — the schema
  // should not be publicly exposed in prod.
  const swaggerEnabled =
    process.env.SWAGGER_ENABLED === 'true' ||
    process.env.NODE_ENV !== 'production';
  if (swaggerEnabled) {
    const swaggerCfg = new DocumentBuilder()
      .setTitle('Employee API SPI')
      .setDescription(
        'Multi-tenant employee API for the SPI system (VE, AR, CO)',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addGlobalParameters({
        name: 'X-Country-Code',
        in: 'header',
        required: true,
        schema: { type: 'string', example: 'VE' },
      })
      .build();
    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, swaggerCfg),
    );
  }

  await app.listen(process.env.PORT ?? 8080);
}
bootstrap();
