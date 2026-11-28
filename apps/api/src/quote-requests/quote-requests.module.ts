import { Module } from '@nestjs/common';
import { StaffGuard } from '../admin/staff.guard';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { AdminQuoteRequestsController, QuoteRequestsController } from './quote-requests.controller';
import { QuoteRequestsService } from './quote-requests.service';

@Module({
  imports: [AuthModule, CustomersModule],
  controllers: [QuoteRequestsController, AdminQuoteRequestsController],
  providers: [QuoteRequestsService, StaffGuard],
})
export class QuoteRequestsModule {}
