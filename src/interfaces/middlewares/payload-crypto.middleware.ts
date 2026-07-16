import { NextFunction, Request, Response } from 'express';
import CryptoJS from 'crypto-js';
import { getConfig } from '../../config/configuration';
import { badRequest } from '../../shared/errors/http-error';

export const ENCRYPTED_FIELD = 'RequestJson';
export const ENCRYPTED_RESPONSE_FIELD = 'ResponseJson';

declare global {
  namespace Express {
    interface Request {
      encryptedPayload?: boolean;
    }
  }
}

function encrypt(data: unknown, key: string): string {
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
}

function decrypt(cipher: string, key: string): unknown {
  const bytes = CryptoJS.AES.decrypt(cipher, key);
  const text = bytes.toString(CryptoJS.enc.Utf8);
  if (!text) throw new Error('Empty plaintext after decryption');
  return JSON.parse(text);
}

/**
 * SPI P2C crypto (same contract as Nest PayloadCryptoInterceptor):
 * - If body has RequestJson and key is configured → decrypt into req.body, flag encryptedPayload
 * - On res.json, if encryptedPayload → wrap as { ResponseJson }
 * - Plain requests pass through unchanged
 */
export function payloadCryptoMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const key = getConfig().payloadEncryptionKey;
  const encryptedInput =
    !!key &&
    req.body &&
    typeof req.body === 'object' &&
    ENCRYPTED_FIELD in req.body;

  if (encryptedInput) {
    try {
      req.body = decrypt(String(req.body[ENCRYPTED_FIELD]), key);
      req.encryptedPayload = true;
    } catch {
      return next(badRequest('Invalid encrypted payload'));
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (body !== undefined && body !== null) {
        return originalJson({
          [ENCRYPTED_RESPONSE_FIELD]: encrypt(body, key),
        });
      }
      return originalJson(body);
    }) as Response['json'];
  }

  next();
}
