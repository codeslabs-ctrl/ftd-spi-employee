import {
  BadRequestException,
  Injectable,
  NestMiddleware,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const COUNTRY_HEADER = 'x-country-code';

@Injectable()
export class CountryMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: any, _res: any, next: () => void) {
    const raw = String(req.headers[COUNTRY_HEADER] ?? '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2}$/.test(raw)) {
      throw new BadRequestException(
        `Header ${COUNTRY_HEADER} is required (ISO 3166-1 alpha-2)`,
      );
    }
    const enabled = this.config.get('countries') ?? {};
    if (!enabled[raw]) {
      throw new UnprocessableEntityException(`Country ${raw} not enabled`);
    }
    req.countryCode = raw;
    next();
  }
}
