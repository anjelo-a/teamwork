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
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed by CORS: ${origin}`), false);
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

  if (configuredOrigins) {
    return configuredOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  const appUrl = process.env['APP_URL']?.trim();
  const inviteBaseUrl = process.env['INVITE_BASE_URL']?.trim();

  return [appUrl, inviteBaseUrl].filter((origin): origin is string => Boolean(origin));
}

void bootstrap().catch((error: unknown) => {
  throw error;
});
