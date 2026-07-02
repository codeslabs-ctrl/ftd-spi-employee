import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';

const ctx = {
  getHandler: () => ({}),
  getClass: () => ({}),
} as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  it('allows routes marked @Public without JWT validation', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    expect(new JwtAuthGuard(reflector).canActivate(ctx)).toBe(true);
  });

  it('delegates to passport JWT validation when not public', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const superSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockReturnValue(true as never);
    expect(new JwtAuthGuard(reflector).canActivate(ctx)).toBe(true);
    expect(superSpy).toHaveBeenCalled();
    superSpy.mockRestore();
  });
});
