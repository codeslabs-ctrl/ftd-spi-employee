import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { AuthService } from './auth.service';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const secretHash = crypto.createHash('sha256').update('s3cret').digest('hex');

const config = {
  get: (key: string) =>
    key === 'jwt'
      ? { privateKey, publicKey, ttlSeconds: 43200, issuer: 'employee-api-spi' }
      : [{ clientId: 'hr-app', secretHash, countries: ['VE'] }],
} as unknown as ConfigService;

describe('AuthService.issueToken', () => {
  it('issues an RS256 JWT with exp = iat + 12h and expected claims', () => {
    const res = new AuthService(config).issueToken('hr-app', 's3cret');
    expect(res.token_type).toBe('Bearer');
    expect(res.expires_in).toBe(43200);
    const decoded = jwt.verify(res.access_token, publicKey, { algorithms: ['RS256'] }) as jwt.JwtPayload;
    expect(decoded.sub).toBe('hr-app');
    expect(decoded.iss).toBe('employee-api-spi');
    expect(decoded.countries).toEqual(['VE']);
    expect((decoded.exp ?? 0) - (decoded.iat ?? 0)).toBe(43200);
  });

  it('invalid credentials → UnauthorizedException', () => {
    expect(() => new AuthService(config).issueToken('hr-app', 'wrong')).toThrow(
      UnauthorizedException,
    );
  });

  it('unknown client → UnauthorizedException', () => {
    expect(() => new AuthService(config).issueToken('ghost', 's3cret')).toThrow(
      UnauthorizedException,
    );
  });
});
