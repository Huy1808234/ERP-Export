import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'path';
import { types as pgTypes } from 'pg';

const POSTGRES_TIMESTAMP_WITHOUT_TIME_ZONE_OID = 1114;

pgTypes.setTypeParser(POSTGRES_TIMESTAMP_WITHOUT_TIME_ZONE_OID, (value: string) => new Date(`${value}Z`));

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get('PORT');

  // Senior Fix: Use resolve to guarantee absolute path and log it for debugging
  const imagesPath = resolve(process.cwd(), 'images');
  app.useStaticAssets(imagesPath, {
    prefix: '/images',
    index: false,
  });
  console.log(`[Static] Serving assets from: ${imagesPath}`);

  const uploadsPath = resolve(process.cwd(), 'uploads');
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads',
    index: false,
  });
  console.log(`[Static] Serving uploads from: ${uploadsPath}`);

  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }),
  );
  app.setGlobalPrefix('api/v1', { exclude: [''] });
  app.enableCors({ "origin": true, "methods": "GET,HEAD,PUT,PATCH,POST,DELETE", credentials: true });

  await app.listen(port);
  console.log(`[Server] Listening at: http://localhost:${port}/api/v1`);
}
bootstrap();
// Forced restart for route registration
