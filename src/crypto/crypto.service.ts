import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';

/**
 * CryptoJS-compatible AES payload encryption (OpenSSL "Salted__" format), matching
 * the Farmatodo front-end: CryptoJS.AES.encrypt(JSON.stringify(data), KEY).toString().
 * The same shared passphrase (PAYLOAD_ENCRYPTION_KEY) must be configured on both sides.
 */
@Injectable()
export class CryptoService {
  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return !!this.config.get<string>('payloadEncryptionKey');
  }

  private get key(): string {
    return this.config.get<string>('payloadEncryptionKey') ?? '';
  }

  /** Encrypts an object to a CryptoJS AES base64 string. */
  encrypt(data: unknown): string {
    return CryptoJS.AES.encrypt(JSON.stringify(data), this.key).toString();
  }

  /** Decrypts a CryptoJS AES base64 string back to a parsed object. Throws on failure. */
  decrypt<T = unknown>(cipher: string): T {
    const bytes = CryptoJS.AES.decrypt(cipher, this.key);
    const text = bytes.toString(CryptoJS.enc.Utf8);
    if (!text) throw new Error('Empty plaintext after decryption');
    return JSON.parse(text) as T;
  }
}
