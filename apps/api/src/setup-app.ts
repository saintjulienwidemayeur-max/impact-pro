import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { requestIdMiddleware } from './common/request-id.middleware';
import { ResponseEnvelopeInterceptor } from './common/response.interceptor';
import { ENV } from './config/config.module';
import type { Env } from './config/env';

/** Shared HTTP configuration used by main.ts and the e2e tests. */
export function setupApp(app: INestApplication): INestApplication {
  const env = app.get<Env>(ENV);

  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(cookieParser(env.COOKIE_SECRET));
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
    credentials: true,
  });

  app.setGlobalPrefix('api', { exclude: [] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Impact Pro API')
    .setDescription('Enterprise promotional commerce & supply chain platform — REST API v1')
    .setVersion('1.0')
    .addCookieAuth('ip_session')
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, swaggerConfig));

  return app;
}
