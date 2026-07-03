import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';

const ctx = {
  getHandler: () => ({}),
  getClass: () => ({}),
} as unknown as ExecutionContext;

const reflectorReturning = (v: boolean) =>
  ({ getAllAndOverride: jest.fn().mockReturnValue(v) }) as unknown as Reflector;

describe('JwtAuthGuard', () => {
  it('allows routes marked @Public without JWT validation', () => {
    expect(new JwtAuthGuard(reflectorReturning(true)).canActivate(ctx)).toBe(true);
  });

  it('delegates to passport JWT validation when not public', () => {
    const superSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockReturnValue(true as never);
    expect(new JwtAuthGuard(reflectorReturning(false)).canActivate(ctx)).toBe(true);
    expect(superSpy).toHaveBeenCalled();
    superSpy.mockRestore();
  });
});
