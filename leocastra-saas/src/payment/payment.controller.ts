import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { InitializeLicensePaymentDto } from './dto/initialize-license-payment.dto';
import { PaymentService } from './payment.service';
import type { PaymentProviderName } from './providers/payment-provider.interface';

@Controller()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('payments/initialize')
  initialize(
    @Body() dto: InitializePaymentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.paymentService.initializePayment(dto, user);
  }

  @Post('payments/initialize-license')
  initializeLicense(
    @Body() dto: InitializeLicensePaymentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.paymentService.initializeLicensePayment(dto, user);
  }

  @Public()
  @Post('payments/webhook/:provider')
  webhook(
    @Param('provider') provider: PaymentProviderName,
    @Body() payload: unknown,
    @Headers('x-signature') signature?: string,
    @Headers('x-paystack-signature') paystackSignature?: string,
  ) {
    const sig = signature ?? paystackSignature;
    return this.paymentService.handleWebhook(provider, payload, sig);
  }

  @Get('transactions')
  getTransactions(@CurrentUser() user: CurrentUserPayload) {
    return this.paymentService.getTransactionsForUser(user.userId);
  }
}
