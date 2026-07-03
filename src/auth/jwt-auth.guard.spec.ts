import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';

function ctxWith(req: Record<string, unknown> = {}) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const reflectorReturning = (v: boolean) =>
  ({ getAllAndOverride: jest.fn().mockReturnValue(v) }) as unknown as Reflector;

describe('JwtAuthGuard', () => {
  it('allows routes marked @Public without JWT validation', async () => {
    expect(
      await new JwtAuthGuard(reflectorReturning(true)).canActivate(ctxWith()),
    ).toBe(true);
  });

  it('authenticates and allows when the country is in the token claim', async () => {
    const superSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockResolvedValue(true as never);
    const ctx = ctxWith({ countryCode: 'VE', user: { countries: ['VE'] } });
    expect(
      await new JwtAuthGuard(reflectorReturning(false)).canActivate(ctx),
    ).toBe(true);
    expect(superSpy).toHaveBeenCalled();
    superSpy.mockRestore();
  });

  it('rejects with 403 when the country is not in the token claim', async () => {
    const superSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockResolvedValue(true as never);
    const ctx = ctxWith({ countryCode: 'CO', user: { countries: ['VE'] } });
    await expect(
      new JwtAuthGuard(reflectorReturning(false)).canActivate(ctx),
    ).rejects.toThrow(ForbiddenException);
    superSpy.mockRestore();
  });

  it('treats an empty countries claim as unrestricted', async () => {
    const superSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockResolvedValue(true as never);
    const ctx = ctxWith({ countryCode: 'VE', user: { countries: [] } });
    expect(
      await new JwtAuthGuard(reflectorReturning(false)).canActivate(ctx),
    ).toBe(true);
    superSpy.mockRestore();
  });

  it('returns false when authentication fails', async () => {
    const superSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockResolvedValue(false as never);
    const ctx = ctxWith({ countryCode: 'VE', user: { countries: ['VE'] } });
    expect(
      await new JwtAuthGuard(reflectorReturning(false)).canActivate(ctx),
    ).toBe(false);
    superSpy.mockRestore();
  });
});
