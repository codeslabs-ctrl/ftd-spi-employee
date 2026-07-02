import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../config/configuration';

interface JwtPayload {
  sub: string;
  countries?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const jwt: AppConfig['jwt'] = config.get('jwt');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwt.publicKey,
      algorithms: ['RS256'],
      issuer: jwt.issuer,
    });
  }

  validate(payload: JwtPayload) {
    return { clientId: payload.sub, countries: payload.countries ?? [] };
  }
}
