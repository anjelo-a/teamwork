import { slugify } from './slug.util';

describe('slugify', () => {
  it('lowercases and trims the input', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world');
  });

  it('replaces spaces with dashes', () => {
    expect(slugify('Product Team')).toBe('product-team');
  });

  it('replaces multiple spaces with a single dash', () => {
    expect(slugify('Product   Team')).toBe('product-team');
  });

  it('replaces non-alphanumeric characters with dashes', () => {
    expect(slugify('Acme & Co.')).toBe('acme-co');
  });

  it('strips leading and trailing dashes', () => {
    expect(slugify('--hello--')).toBe('hello');
  });

  it('collapses consecutive dashes into one', () => {
    expect(slugify('hello---world')).toBe('hello-world');
  });

  it('handles already-valid slugs unchanged', () => {
    expect(slugify('my-workspace')).toBe('my-workspace');
  });

  it('handles numeric characters', () => {
    expect(slugify('Team 42')).toBe('team-42');
  });

  it('returns an empty string for an all-symbol input', () => {
    expect(slugify('!!!')).toBe('');
  });

  it('preserves digits at the start', () => {
    expect(slugify('1st Team')).toBe('1st-team');
  });
});
