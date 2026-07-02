import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { ApiClient, AppConfig } from '../config/configuration';

@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService) {}

  issueToken(clientId: string, clientSecret: string) {
    const clients: ApiClient[] = this.config.get('apiClients') ?? [];
    const hash = crypto.createHash('sha256').update(clientSecret).digest('hex');
    const client = clients.find((c) => c.clientId === clientId && c.secretHash === hash);
    if (!client) throw new UnauthorizedException('Invalid client credentials');

    const { privateKey, ttlSeconds, issuer }: AppConfig['jwt'] = this.config.get('jwt');
    const access_token = jwt.sign({ countries: client.countries ?? [] }, privateKey, {
      algorithm: 'RS256',
      subject: clientId,
      issuer,
      expiresIn: ttlSeconds,
    });
    return { access_token, token_type: 'Bearer', expires_in: ttlSeconds };
  }
}
