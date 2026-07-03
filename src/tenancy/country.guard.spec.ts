import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { CountryGuard } from './country.guard';

function ctxWith(headers: Record<string, string>, user?: unknown) {
  const req: any = { headers, user };
  return {
    ctx: {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext,
    req,
  };
}

const config = { get: () => ({ VE: {} }) } as unknown as ConfigService; // only VE enabled
const reflector = (isPublic: boolean) =>
  ({ getAllAndOverride: jest.fn().mockReturnValue(isPublic) }) as unknown as Reflector;

const guard = () => new CountryGuard(config, reflector(false));

describe('CountryGuard', () => {
  it('skips validation for @Public routes', () => {
    const { ctx } = ctxWith({});
    expect(new CountryGuard(config, reflector(true)).canActivate(ctx)).toBe(true);
  });

  it('missing header → 400', () => {
    expect(() => guard().canActivate(ctxWith({}).ctx)).toThrow(BadRequestException);
  });

  it('invalid format → 400', () => {
    expect(() => guard().canActivate(ctxWith({ 'x-country-code': 'VEN' }).ctx)).toThrow(
      BadRequestException,
    );
  });

  it('valid but not enabled country → 422', () => {
    expect(() => guard().canActivate(ctxWith({ 'x-country-code': 'AR' }).ctx)).toThrow(
      UnprocessableEntityException,
    );
  });

  it('token not authorized for the country → 403', () => {
    const { ctx } = ctxWith({ 'x-country-code': 'VE' }, { countries: ['CO'] });
    expect(() => guard().canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('enabled + authorized → sets req.countryCode and passes', () => {
    const { ctx, req } = ctxWith({ 'x-country-code': 've' }, { countries: ['VE'] });
    expect(guard().canActivate(ctx)).toBe(true);
    expect(req.countryCode).toBe('VE');
  });

  it('empty countries claim is unrestricted', () => {
    const { ctx, req } = ctxWith({ 'x-country-code': 'VE' }, { countries: [] });
    expect(guard().canActivate(ctx)).toBe(true);
    expect(req.countryCode).toBe('VE');
  });
});
