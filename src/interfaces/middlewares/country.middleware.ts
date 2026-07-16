import { NextFunction, Request, Response } from 'express';
import { getConfig } from '../../config/configuration';
import {
  badRequest,
  forbidden,
  unprocessable,
} from '../../shared/errors/http-error';

export const COUNTRY_HEADER = 'x-country-code';

export function countryMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const raw = String(req.headers[COUNTRY_HEADER] ?? '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(raw)) {
    return next(
      badRequest(
        `Header ${COUNTRY_HEADER} is required (ISO 3166-1 alpha-2)`,
      ),
    );
  }

  const enabled = getConfig().countries;
  if (!enabled[raw as keyof typeof enabled]) {
    return next(unprocessable(`Country ${raw} not enabled`));
  }

  const allowed = req.user?.countries ?? [];
  if (allowed.length > 0 && !allowed.includes(raw)) {
    return next(forbidden(`Client not authorized for country ${raw}`));
  }

  req.countryCode = raw;
  next();
}
