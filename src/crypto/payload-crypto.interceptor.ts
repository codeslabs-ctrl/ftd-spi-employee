import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CryptoService } from './crypto.service';

// Field name used by the Farmatodo front-end (x-www-form-urlencoded).
export const ENCRYPTED_FIELD = 'RequestJson';
export const ENCRYPTED_RESPONSE_FIELD = 'ResponseJson';

/**
 * When the request arrives with an encrypted `RequestJson` field, decrypts it into
 * req.body (so DTO validation runs on the clear JSON) and encrypts the response back
 * symmetrically. Plain requests pass through untouched — encryption is triggered by
 * the presence of the encrypted field, keeping non-encrypted clients working.
 * Runs before pipes, so the ValidationPipe sees the decrypted body.
 */
@Injectable()
export class PayloadCryptoInterceptor implements NestInterceptor {
  constructor(private readonly crypto: CryptoService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const encryptedInput =
      this.crypto.enabled &&
      req.body &&
      typeof req.body === 'object' &&
      ENCRYPTED_FIELD in req.body;

    if (encryptedInput) {
      try {
        req.body = this.crypto.decrypt(String(req.body[ENCRYPTED_FIELD]));
      } catch {
        throw new BadRequestException('Invalid encrypted payload');
      }
    }

    return next
      .handle()
      .pipe(
        map((data) =>
          encryptedInput && data !== undefined && data !== null
            ? { [ENCRYPTED_RESPONSE_FIELD]: this.crypto.encrypt(data) }
            : data,
        ),
      );
  }
}
