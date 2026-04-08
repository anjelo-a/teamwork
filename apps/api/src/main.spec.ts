import { normalizeOrigin, readAllowedOrigins } from './main';

describe('main cors helpers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {};
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('normalizes full urls to origins', () => {
    expect(normalizeOrigin('https://invite.example.com/base')).toBe('https://invite.example.com');
    expect(normalizeOrigin('https://app.example.com/')).toBe('https://app.example.com');
  });

  it('preserves the literal null origin', () => {
    expect(normalizeOrigin('null')).toBe('null');
  });

  it('normalizes configured origins and excludes localhost when node env is unset', () => {
    process.env['APP_URL'] = 'https://app.example.com/base';
    process.env['INVITE_BASE_URL'] = 'https://invite.example.com/base';
    process.env['CORS_ALLOWED_ORIGINS'] =
      'https://foo.example.com/path, https://bar.example.com/';

    expect(readAllowedOrigins()).toEqual([
      'https://foo.example.com',
      'https://bar.example.com',
      'https://app.example.com',
      'https://invite.example.com',
    ]);
  });

  it('includes localhost origins only in development and test', () => {
    process.env['NODE_ENV'] = 'development';
    expect(readAllowedOrigins()).toEqual(['http://localhost:3001', 'http://127.0.0.1:3001']);

    process.env['NODE_ENV'] = 'test';
    expect(readAllowedOrigins()).toEqual(['http://localhost:3001', 'http://127.0.0.1:3001']);

    process.env['NODE_ENV'] = 'production';
    expect(readAllowedOrigins()).toEqual([]);
  });
});
