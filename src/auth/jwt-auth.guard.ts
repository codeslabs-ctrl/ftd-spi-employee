import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const authenticated = (await super.canActivate(ctx)) as boolean;
    if (!authenticated) return false;

    // Enforce the token's `countries` claim against the resolved tenant.
    // Empty/absent claim = unrestricted client; non-empty = must include the country.
    const req = ctx.switchToHttp().getRequest();
    const country: string | undefined = req.countryCode;
    const allowed: string[] = req.user?.countries ?? [];
    if (country && allowed.length > 0 && !allowed.includes(country)) {
      throw new ForbiddenException(
        `Client not authorized for country ${country}`,
      );
    }
    return true;
  }
}
