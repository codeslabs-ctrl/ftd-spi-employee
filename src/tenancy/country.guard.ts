import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';

export const COUNTRY_HEADER = 'x-country-code';

/**
 * Runs AFTER JwtAuthGuard (registered second in AppModule), so authentication
 * happens first: an unauthenticated caller gets 401 before any country check,
 * and cannot enumerate enabled countries. Validates X-Country-Code, resolves the
 * tenant, and enforces the token's `countries` claim.
 */
@Injectable()
export class CountryGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const raw = String(req.headers[COUNTRY_HEADER] ?? '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2}$/.test(raw)) {
      throw new BadRequestException(`Header ${COUNTRY_HEADER} is required (ISO 3166-1 alpha-2)`);
    }

    const enabled = this.config.get('countries') ?? {};
    if (!enabled[raw]) {
      throw new UnprocessableEntityException(`Country ${raw} not enabled`);
    }

    const allowed: string[] = req.user?.countries ?? [];
    if (allowed.length > 0 && !allowed.includes(raw)) {
      throw new ForbiddenException(`Client not authorized for country ${raw}`);
    }

    req.countryCode = raw;
    return true;
  }
}
