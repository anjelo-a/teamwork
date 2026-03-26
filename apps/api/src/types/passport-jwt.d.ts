declare module 'passport-jwt' {
  import type { Request } from 'express';
  import type { Strategy as PassportStrategyBase } from 'passport-strategy';

  export interface VerifiedCallback {
    (error: Error | null, user?: unknown, info?: unknown): void;
  }

  export interface JwtFromRequestFunction<TRequest = Request> {
    (request: TRequest): string | null;
  }

  export interface StrategyOptions {
    jwtFromRequest: JwtFromRequestFunction;
    secretOrKey: string | Buffer;
    ignoreExpiration?: boolean;
    passReqToCallback?: false;
  }

  export interface StrategyOptionsWithRequest {
    jwtFromRequest: JwtFromRequestFunction;
    secretOrKey: string | Buffer;
    ignoreExpiration?: boolean;
    passReqToCallback: true;
  }

  export class Strategy extends PassportStrategyBase {
    constructor(
      options: StrategyOptions,
      verify: (payload: unknown, done: VerifiedCallback) => void | Promise<void>,
    );
    constructor(
      options: StrategyOptionsWithRequest,
      verify: (request: Request, payload: unknown, done: VerifiedCallback) => void | Promise<void>,
    );
    name: string;
  }

  export const ExtractJwt: {
    fromAuthHeaderAsBearerToken(): JwtFromRequestFunction;
  };
}
