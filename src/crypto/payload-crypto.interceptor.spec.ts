import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
} from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { CryptoService } from './crypto.service';
import {
  ENCRYPTED_FIELD,
  ENCRYPTED_RESPONSE_FIELD,
  PayloadCryptoInterceptor,
} from './payload-crypto.interceptor';

function ctxWith(body: unknown): { ctx: ExecutionContext; req: any } {
  const req: any = { body };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}
const handlerOf = (value: unknown): CallHandler => ({
  handle: () => of(value),
});

describe('PayloadCryptoInterceptor', () => {
  const crypto = {
    enabled: true,
    decrypt: jest.fn((c: string) =>
      JSON.parse(Buffer.from(c, 'base64').toString()),
    ),
    encrypt: jest.fn((d: unknown) => 'ENC(' + JSON.stringify(d) + ')'),
  } as unknown as CryptoService;
  const interceptor = new PayloadCryptoInterceptor(crypto);

  it('decrypts RequestJson into req.body and encrypts the response', async () => {
    const clear = { idNumber: '1', firstName: 'MARIA' };
    const cipher = Buffer.from(JSON.stringify(clear)).toString('base64');
    const { ctx, req } = ctxWith({ [ENCRYPTED_FIELD]: cipher });

    const out = await lastValueFrom(
      interceptor.intercept(ctx, handlerOf({ idNumber: '1' })),
    );
    expect(req.body).toEqual(clear); // DTO validation would run on this
    expect(out).toEqual({
      [ENCRYPTED_RESPONSE_FIELD]: 'ENC({"idNumber":"1"})',
    });
  });

  it('passes plain requests through untouched (no encryption triggered)', async () => {
    const { ctx, req } = ctxWith({ idNumber: '1' });
    const out = await lastValueFrom(
      interceptor.intercept(ctx, handlerOf({ ok: true })),
    );
    expect(req.body).toEqual({ idNumber: '1' });
    expect(out).toEqual({ ok: true }); // not wrapped
  });

  it('returns 400 on an invalid encrypted payload', async () => {
    (crypto.decrypt as jest.Mock).mockImplementationOnce(() => {
      throw new Error('bad');
    });
    const { ctx } = ctxWith({ [ENCRYPTED_FIELD]: 'garbage' });
    expect(() => interceptor.intercept(ctx, handlerOf({}))).toThrow(
      BadRequestException,
    );
  });

  it('does not encrypt when disabled', async () => {
    const disabled = new PayloadCryptoInterceptor({
      enabled: false,
    } as unknown as CryptoService);
    const { ctx } = ctxWith({ [ENCRYPTED_FIELD]: 'x' });
    const out = await lastValueFrom(
      disabled.intercept(ctx, handlerOf({ ok: true })),
    );
    expect(out).toEqual({ ok: true });
  });
});
