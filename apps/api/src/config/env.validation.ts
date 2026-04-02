const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/teamwork';
const DEFAULT_JWT_SECRET = 'teamwork-dev-secret-change-me';
const DEFAULT_APP_URL = 'http://localhost:3000';
const DEFAULT_INVITE_TTL_DAYS = 30;

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const appUrl = readUrl(config['APP_URL']) ?? DEFAULT_APP_URL;

  return {
    ...config,
    DATABASE_URL: readString(config['DATABASE_URL']) ?? DEFAULT_DATABASE_URL,
    JWT_SECRET: readString(config['JWT_SECRET']) ?? DEFAULT_JWT_SECRET,
    JWT_EXPIRES_IN: readString(config['JWT_EXPIRES_IN']) ?? '15m',
    APP_URL: appUrl,
    INVITE_BASE_URL: readUrl(config['INVITE_BASE_URL']) ?? appUrl,
    INVITE_TTL_DAYS: readPositiveInteger(config['INVITE_TTL_DAYS']) ?? DEFAULT_INVITE_TTL_DAYS,
    PORT: Number.parseInt(readString(config['PORT']) ?? '3000', 10),
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readUrl(value: unknown): string | undefined {
  const normalizedValue = readString(value);

  if (!normalizedValue) {
    return undefined;
  }

  try {
    return new URL(normalizedValue).toString();
  } catch {
    throw new Error(`Invalid URL: ${normalizedValue}`);
  }
}

function readPositiveInteger(value: unknown): number | undefined {
  const normalizedValue = readString(value);

  if (!normalizedValue) {
    return undefined;
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`Invalid positive integer: ${normalizedValue}`);
  }

  return parsedValue;
}
