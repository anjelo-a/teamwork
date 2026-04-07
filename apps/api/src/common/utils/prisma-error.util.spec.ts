import { Prisma } from '@prisma/client';
import { isPrismaErrorCode, isPrismaUniqueConstraintForField } from './prisma-error.util';

function makePrismaKnownError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  const params: { code: string; clientVersion: string; meta?: Record<string, unknown> } = {
    code,
    clientVersion: '0.0.0',
  };
  if (meta !== undefined) {
    params.meta = meta;
  }
  return new Prisma.PrismaClientKnownRequestError('message', params);
}

describe('isPrismaErrorCode', () => {
  it('returns true for a matching PrismaClientKnownRequestError', () => {
    const error = makePrismaKnownError('P2002');
    expect(isPrismaErrorCode(error, 'P2002')).toBe(true);
  });

  it('returns false for a non-matching error code', () => {
    const error = makePrismaKnownError('P2025');
    expect(isPrismaErrorCode(error, 'P2002')).toBe(false);
  });

  it('returns true for a plain object with a matching code property', () => {
    expect(isPrismaErrorCode({ code: 'P2034' }, 'P2034')).toBe(true);
  });

  it('returns false for a plain object with no code property', () => {
    expect(isPrismaErrorCode({ message: 'oops' }, 'P2002')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isPrismaErrorCode(null, 'P2002')).toBe(false);
  });

  it('returns false for a non-object primitive', () => {
    expect(isPrismaErrorCode('P2002', 'P2002')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPrismaErrorCode(undefined, 'P2002')).toBe(false);
  });
});

describe('isPrismaUniqueConstraintForField', () => {
  it('returns true when the target array contains the field name', () => {
    const error = makePrismaKnownError('P2002', { target: ['email'] });
    expect(isPrismaUniqueConstraintForField(error, 'email')).toBe(true);
  });

  it('returns true when the target string contains the field name', () => {
    expect(
      isPrismaUniqueConstraintForField({ code: 'P2002', meta: { target: 'slug' } }, 'slug'),
    ).toBe(true);
  });

  it('returns true when the message contains the field name and target is absent', () => {
    expect(
      isPrismaUniqueConstraintForField(
        { code: 'P2002', message: 'Unique constraint failed on slug', meta: null },
        'slug',
      ),
    ).toBe(true);
  });

  it('returns false when the field name is not in the target', () => {
    const error = makePrismaKnownError('P2002', { target: ['email'] });
    expect(isPrismaUniqueConstraintForField(error, 'slug')).toBe(false);
  });

  it('returns false when the error code is not P2002', () => {
    const error = makePrismaKnownError('P2025', { target: ['email'] });
    expect(isPrismaUniqueConstraintForField(error, 'email')).toBe(false);
  });

  it('returns false for a non-error value', () => {
    expect(isPrismaUniqueConstraintForField(null, 'slug')).toBe(false);
  });
});
