import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OriginGuard, SessionGuard } from './guards';
import { LoginAttemptsService } from './login-attempts.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Module({
  imports: [CustomersModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionService, LoginAttemptsService, SessionGuard, OriginGuard],
  exports: [SessionService, SessionGuard, OriginGuard, PasswordService],
})
export class AuthModule {}
