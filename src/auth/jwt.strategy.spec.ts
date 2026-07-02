import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { JwtStrategy } from './jwt.strategy';

const { publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const config = {
  get: () => ({ publicKey, issuer: 'employee-api-spi' }),
} as unknown as ConfigService;

describe('JwtStrategy', () => {
  it('maps the JWT payload to clientId and countries', () => {
    const strategy = new JwtStrategy(config);
    expect(strategy.validate({ sub: 'hr-app', countries: ['VE'] })).toEqual({
      clientId: 'hr-app',
      countries: ['VE'],
    });
  });

  it('defaults countries to an empty list', () => {
    const strategy = new JwtStrategy(config);
    expect(strategy.validate({ sub: 'hr-app' })).toEqual({
      clientId: 'hr-app',
      countries: [],
    });
  });
});
