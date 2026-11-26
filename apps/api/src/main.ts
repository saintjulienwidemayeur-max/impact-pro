import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ENV } from './config/config.module';
import type { Env } from './config/env';
import { setupApp } from './setup-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  setupApp(app);
  const env = app.get<Env>(ENV);
  await app.listen(env.PORT);
  Logger.log(`Impact Pro API listening on :${env.PORT} — docs at /api/docs`, 'Bootstrap');
}

bootstrap().catch((err: unknown) => {
  // Fail fast (e.g. invalid env) with a non-zero exit code.
  console.error(err);
  process.exit(1);
});
