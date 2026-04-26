import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PAYMENT_PROVIDERS } from './payment.constants';
import { PaymentService } from './payment.service';
import { BinancePayProvider } from './providers/binance-pay.provider';
import { PaystackProvider } from './providers/paystack.provider';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { LicenseModule } from '../license/license.module';

@Module({
  imports: [PlatformSettingsModule, LicenseModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaystackProvider,
    BinancePayProvider,
    {
      provide: PAYMENT_PROVIDERS,
      useFactory: (
        paystackProvider: PaystackProvider,
        binancePayProvider: BinancePayProvider,
      ) => [paystackProvider, binancePayProvider],
      inject: [PaystackProvider, BinancePayProvider],
    },
  ],
})
export class PaymentModule {}
