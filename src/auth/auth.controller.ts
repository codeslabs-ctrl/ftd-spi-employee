import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TokenRequestDto } from './dto/token-request.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('token')
  @HttpCode(200)
  token(@Body() dto: TokenRequestDto) {
    return this.auth.issueToken(dto.client_id, dto.client_secret);
  }
}
