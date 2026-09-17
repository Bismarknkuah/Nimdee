import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, PlatformLoginDto, RefreshDto, ResetPasswordDto } from './dto';
import { AllowInactiveTenant, Public } from '../common/decorators';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('platform/login')
  platformLogin(@Body() dto: PlatformLoginDto) {
    return this.auth.platformLogin(dto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: Partial<RefreshDto>) {
    return this.auth.logout(dto?.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @Post('forgot-password')
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @Post('reset-password')
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @AllowInactiveTenant()
  @Get('sessions')
  sessions() {
    return this.auth.sessions();
  }

  @AllowInactiveTenant()
  @Delete('sessions/:id')
  revoke(@Param('id') id: string) {
    return this.auth.revokeSession(id);
  }

  @AllowInactiveTenant()
  @Post('sessions/revoke-all')
  revokeAll() {
    return this.auth.revokeAllSessions();
  }

  @AllowInactiveTenant()
  @Get('me')
  me() {
    return this.auth.me();
  }

  @AllowInactiveTenant()
  @Post('change-password')
  changePassword(@Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(dto);
  }
}
