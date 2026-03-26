const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/teamwork';
const DEFAULT_JWT_SECRET = 'teamwork-dev-secret-change-me';

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  return {
    ...config,
    DATABASE_URL: readString(config['DATABASE_URL']) ?? DEFAULT_DATABASE_URL,
    JWT_SECRET: readString(config['JWT_SECRET']) ?? DEFAULT_JWT_SECRET,
    JWT_EXPIRES_IN: readString(config['JWT_EXPIRES_IN']) ?? '15m',
    PORT: Number.parseInt(readString(config['PORT']) ?? '3000', 10),
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
