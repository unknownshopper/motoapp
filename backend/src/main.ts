import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const corsEnv = process.env.CORS_ORIGIN;
  const origins = corsEnv ? corsEnv.split(',').map(o => o.trim()).filter(Boolean) : '*';
  const app = await NestFactory.create(AppModule, { cors: { origin: origins } });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
}

bootstrap();