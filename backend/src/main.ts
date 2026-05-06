import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get('PORT');
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }),
  );
  app.setGlobalPrefix('api/v1', { exclude: [''] });
  app.enableCors({ "origin": true, "methods": "GET,HEAD,PUT,PATCH,POST,DELETE", credentials: true });
  await app.listen(port);
  console.log(` API Server is running on: http://localhost:${port}`);
}
bootstrap();
