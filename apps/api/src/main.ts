import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = readAllowedOrigins();
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      const normalizedOrigin = normalizeOrigin(origin);

      if (
        !normalizedOrigin ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(normalizedOrigin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${normalizedOrigin}`), false);
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(process.env['PORT'] ?? 3000);
}

function readAllowedOrigins(): string[] {
  const configuredOrigins = process.env['CORS_ALLOWED_ORIGINS']?.trim();
  const appUrl = process.env['APP_URL']?.trim();
  const inviteBaseUrl = process.env['INVITE_BASE_URL']?.trim();

  const explicitOrigins = [
    ...splitOrigins(configuredOrigins),
    appUrl,
    inviteBaseUrl,
  ];

  if (process.env['NODE_ENV'] !== 'production') {
    explicitOrigins.push('http://localhost:3001', 'http://127.0.0.1:3001');
  }

  return [...new Set(explicitOrigins.map(normalizeOrigin).filter(isNonEmptyOrigin))];
}

function splitOrigins(configuredOrigins: string | undefined): string[] {
  if (!configuredOrigins) {
    return [];
  }

  return configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function normalizeOrigin(origin: string | undefined): string | null {
  if (!origin) {
    return null;
  }

  return origin.trim().replace(/\/+$/, '');
}

function isNonEmptyOrigin(origin: string | null): origin is string {
  return Boolean(origin);
}

void bootstrap().catch((error: unknown) => {
  throw error;
});
