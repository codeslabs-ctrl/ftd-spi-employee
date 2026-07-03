import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CryptoService } from './crypto.service';
import { PayloadCryptoInterceptor } from './payload-crypto.interceptor';

@Global()
@Module({
  providers: [
    CryptoService,
    { provide: APP_INTERCEPTOR, useClass: PayloadCryptoInterceptor },
  ],
  exports: [CryptoService],
})
export class CryptoModule {}
