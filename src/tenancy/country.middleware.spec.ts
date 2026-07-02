import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CountryMiddleware } from './country.middleware';

const mw = () =>
  new CountryMiddleware({ get: () => ({ VE: {} }) } as unknown as ConfigService); // only VE enabled

const req = (header?: string) =>
  ({ headers: header ? { 'x-country-code': header } : {} }) as any;

describe('CountryMiddleware', () => {
  it('missing header → 400', () => {
    expect(() => mw().use(req(), {} as any, jest.fn())).toThrow(BadRequestException);
  });

  it('invalid format → 400', () => {
    expect(() => mw().use(req('VEN'), {} as any, jest.fn())).toThrow(BadRequestException);
  });

  it('valid but not enabled country → 422', () => {
    expect(() => mw().use(req('AR'), {} as any, jest.fn())).toThrow(UnprocessableEntityException);
  });

  it('enabled country → attaches req.countryCode and calls next', () => {
    const r = req('ve');
    const next = jest.fn();
    mw().use(r, {} as any, next);
    expect(r.countryCode).toBe('VE');
    expect(next).toHaveBeenCalled();
  });
});
