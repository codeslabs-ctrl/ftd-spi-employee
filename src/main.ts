import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

  const swaggerCfg = new DocumentBuilder()
    .setTitle('Employee API SPI')
    .setDescription('Multi-tenant employee API for the SPI system (VE, AR, CO)')
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

  await app.listen(process.env.PORT ?? 8080);
}
bootstrap();
