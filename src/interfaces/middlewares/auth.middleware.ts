import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getConfig } from '../../config/configuration';
import { unauthorized } from '../../shared/errors/http-error';

export interface AuthUser {
  clientId: string;
  countries: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      countryCode?: string;
    }
  }
}

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(unauthorized());
  }
  const token = header.slice('Bearer '.length);
  try {
    const { publicKey, issuer } = getConfig().jwt;
    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer,
    }) as { sub?: string; countries?: string[] };
    req.user = {
      clientId: payload.sub ?? '',
      countries: payload.countries ?? [],
    };
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}
