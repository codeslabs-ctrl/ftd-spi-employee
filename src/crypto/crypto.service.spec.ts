import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';
import { CryptoService } from './crypto.service';

const withKey = (key: string) =>
  new CryptoService({ get: () => key } as unknown as ConfigService);

describe('CryptoService', () => {
  it('is disabled when no key is configured', () => {
    expect(withKey('').enabled).toBe(false);
  });

  it('is enabled when a key is configured', () => {
    expect(withKey('s3cret').enabled).toBe(true);
  });

  it('round-trips an object (encrypt then decrypt)', () => {
    const svc = withKey('s3cret');
    const data = { idNumber: '12345678', firstName: 'MARIA' };
    const cipher = svc.encrypt(data);
    expect(cipher.startsWith('U2FsdGVkX1')).toBe(true); // CryptoJS "Salted__" prefix
    expect(svc.decrypt(cipher)).toEqual(data);
  });

  it('decrypts a payload produced by the front-end CryptoJS (interop)', () => {
    const key = 'shared-portal-key';
    // Exactly what the front does: CryptoJS.AES.encrypt(JSON.stringify(data), KEY)
    const frontCipher = CryptoJS.AES.encrypt(
      JSON.stringify({ idNumber: '999', gender: 'M' }),
      key,
    ).toString();
    expect(withKey(key).decrypt(frontCipher)).toEqual({
      idNumber: '999',
      gender: 'M',
    });
  });

  it('throws on wrong key / garbage', () => {
    const cipher = withKey('right-key').encrypt({ a: 1 });
    expect(() => withKey('wrong-key').decrypt(cipher)).toThrow();
  });
});
