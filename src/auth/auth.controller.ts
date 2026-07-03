import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TokenRequestDto } from './dto/token-request.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Tighter limit to slow brute-force against client credentials: 10 req/min per IP.
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Public()
  @Post('token')
  @HttpCode(200)
  token(@Body() dto: TokenRequestDto) {
    return this.auth.issueToken(dto.client_id, dto.client_secret);
  }
}
