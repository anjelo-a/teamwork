import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  it('defaults invite configuration from the app url', () => {
    const result = validateEnvironment({});

    expect(result['NODE_ENV']).toBe('development');
    expect(result['APP_URL']).toBe('http://localhost:3000');
    expect(result['INVITE_BASE_URL']).toBe('http://localhost:3000');
    expect(result['INVITE_TTL_DAYS']).toBe(30);
    expect(result['SHARE_LINK_TTL_DAYS']).toBe(14);
  });

  it('uses configured invite values when they are valid', () => {
    const result = validateEnvironment({
      APP_URL: 'https://app.example.com',
      INVITE_BASE_URL: 'https://invite.example.com/base',
      INVITE_TTL_DAYS: '45',
      SHARE_LINK_TTL_DAYS: '10',
    });

    expect(result['APP_URL']).toBe('https://app.example.com/');
    expect(result['INVITE_BASE_URL']).toBe('https://invite.example.com/base');
    expect(result['INVITE_TTL_DAYS']).toBe(45);
    expect(result['SHARE_LINK_TTL_DAYS']).toBe(10);
  });

  it('rejects an invalid invite base url', () => {
    expect(() =>
      validateEnvironment({
        INVITE_BASE_URL: 'not-a-url',
      }),
    ).toThrow('Invalid URL: not-a-url');
  });

  it('rejects a non-positive invite ttl', () => {
    expect(() =>
      validateEnvironment({
        INVITE_TTL_DAYS: '0',
      }),
    ).toThrow('Invalid positive integer: 0');
  });

  it('rejects a non-positive share link ttl', () => {
    expect(() =>
      validateEnvironment({
        SHARE_LINK_TTL_DAYS: '-1',
      }),
    ).toThrow('Invalid positive integer: -1');
  });

  it('rejects an invalid node environment', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'staging',
      }),
    ).toThrow('Invalid NODE_ENV: staging');
  });
});
