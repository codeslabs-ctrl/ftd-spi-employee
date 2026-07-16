import * as crypto from 'crypto';
import { resetConfigCache } from '../../config/configuration';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  beforeAll(() => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    process.env.JWT_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString(
      'base64',
    );
    process.env.JWT_PUBLIC_KEY_BASE64 = Buffer.from(publicKey).toString(
      'base64',
    );
    process.env.JWT_TTL_SECONDS = '43200';
    process.env.JWT_ISSUER = 'ftd-spi-employee';
    process.env.API_CLIENTS_JSON = JSON.stringify([
      {
        clientId: 'c1',
        secretHash: crypto.createHash('sha256').update('secret').digest('hex'),
        countries: ['VE'],
      },
    ]);
    resetConfigCache();
  });

  it('issues token for valid credentials', () => {
    const svc = new AuthService();
    const t = svc.issueToken('c1', 'secret');
    expect(t.token_type).toBe('Bearer');
    expect(t.expires_in).toBe(43200);
    expect(t.access_token).toBeTruthy();
  });

  it('rejects bad secret', () => {
    const svc = new AuthService();
    expect(() => svc.issueToken('c1', 'wrong')).toThrow();
  });
});
