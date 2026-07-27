import { NextFunction, Request, Response } from 'express';
import CryptoJS from 'crypto-js';
import { getConfig } from '../../config/configuration';
import { badRequest } from '../../shared/errors/http-error';

export const ENCRYPTED_FIELD = 'RequestJson';
export const ENCRYPTED_RESPONSE_FIELD = 'ResponseJson';

/**
 * Paths that never require encryption even when REQUIRE_ENCRYPTED_PAYLOAD=true:
 * health checks have no body, and /security/token only carries client_id/secret
 * (not PII), plus a client needs a working token endpoint before it can do
 * anything else.
 */
const ENCRYPTION_EXEMPT_PATHS = new Set([
  '/health',
  '/health/ready',
  '/ftd-spi-employee/rest/security/token',
]);

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
 * - Plain requests pass through unchanged, UNLESS REQUIRE_ENCRYPTED_PAYLOAD=true,
 *   in which case business endpoints (everything except health + /security/token)
 *   reject any request that didn't arrive as an encrypted RequestJson (400).
 */
export function payloadCryptoMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const cfg = getConfig();
  const key = cfg.payloadEncryptionKey;
  const encryptedInput =
    !!key &&
    req.body &&
    typeof req.body === 'object' &&
    ENCRYPTED_FIELD in req.body;

  if (
    cfg.requireEncryptedPayload &&
    key &&
    !encryptedInput &&
    !ENCRYPTION_EXEMPT_PATHS.has(req.path)
  ) {
    return next(
      badRequest('Encrypted payload required', [
        'RequestJson field is missing or empty',
      ]),
    );
  }

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
