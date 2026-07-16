import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getConfig } from '../../config/configuration';
import { unauthorized } from '../../shared/errors/http-error';

export class AuthService {
  issueToken(clientId: string, clientSecret: string) {
    const { apiClients, jwt: jwtCfg } = getConfig();
    const hash = crypto.createHash('sha256').update(clientSecret).digest('hex');
    const client = apiClients.find((c) => c.clientId === clientId);
    if (!client || !this.secretMatches(client.secretHash, hash)) {
      throw unauthorized('Invalid client credentials');
    }

    const access_token = jwt.sign(
      { countries: client.countries ?? [] },
      jwtCfg.privateKey,
      {
        algorithm: 'RS256',
        subject: clientId,
        issuer: jwtCfg.issuer,
        expiresIn: jwtCfg.ttlSeconds,
      },
    );
    return {
      access_token,
      token_type: 'Bearer' as const,
      expires_in: jwtCfg.ttlSeconds,
    };
  }

  private secretMatches(stored: string, provided: string): boolean {
    const a = Buffer.from(stored ?? '', 'utf8');
    const b = Buffer.from(provided, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}

export const authService = new AuthService();
