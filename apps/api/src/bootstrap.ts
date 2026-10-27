import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { LOG_REDACT_PATHS } from '@lingoup/shared';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/app-config.js';
import { GlobalExceptionFilter } from './platform/http/exception-filter.js';
import { registerOriginCheck } from './platform/http/origin-check.js';
import { PinoLoggerService } from './platform/logging/pino-logger.service.js';

export async function createApp(config: AppConfig): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    logger:
      config.logLevel === 'silent'
        ? false
        : {
            level: config.logLevel,
            redact: { paths: [...LOG_REDACT_PATHS], censor: '[redacted]' },
          },
    bodyLimit: config.http.bodyLimitBytes,
    trustProxy: config.http.trustProxy,
    genReqId: () => randomUUID(),
    // Never trust a client-supplied request id.
    requestIdHeader: false,
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(config),
    adapter,
    {
      bufferLogs: true,
    },
  );
  app.useLogger(new PinoLoggerService(app.getHttpAdapter().getInstance().log));
  warnAboutInsecureProductionSettings(config);

  await app.register(fastifyCookie);
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Swagger UI ships inline bootstrap code; JSON responses are unaffected.
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  });
  registerOriginCheck(app.getHttpAdapter().getInstance(), config.http.allowedOrigins);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableShutdownHooks();

  if (config.http.swaggerEnabled) {
    SwaggerModule.setup('docs', app, buildOpenApiDocument(app), {
      jsonDocumentUrl: 'docs/openapi.json',
    });
  }
  return app;
}

export function buildOpenApiDocument(app: NestFastifyApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Open English Learning Platform API')
    .setDescription(
      'REST API. Authentication: HttpOnly session cookie `lingoup_session` set by /v1/auth/login. ' +
        'State-changing requests from browsers must come from an allowed Origin.',
    )
    .setVersion('0.1.0')
    .addCookieAuth('lingoup_session')
    .build();
  return SwaggerModule.createDocument(app, config);
}

function warnAboutInsecureProductionSettings(config: AppConfig): void {
  if (config.env !== 'production') return;
  const logger = new Logger('Security');
  if (!config.session.cookieSecure) {
    logger.warn('COOKIE_SECURE=false in production: session cookies are sent over plain HTTP');
  }
  if (config.http.swaggerEnabled) {
    logger.warn('SWAGGER_ENABLED=true in production: API documentation is publicly reachable');
  }
}
