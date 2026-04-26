import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { CurrentUserPayload } from './decorators/current-user.decorator';
import { UpdateCredentialsDto } from './dto/update-credentials.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<{ accessToken: string }> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto): Promise<{ accessToken: string }> {
    return this.authService.login(dto);
  }

  @Get('me')
  me(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.authService.me(currentUser.userId);
  }

  @Patch('credentials')
  updateCredentials(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: UpdateCredentialsDto,
  ) {
    return this.authService.updateCredentials(currentUser.userId, dto);
  }
}
