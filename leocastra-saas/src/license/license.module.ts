import { Module } from '@nestjs/common';
import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';
import { PricingService } from './pricing.service';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';

@Module({
  imports: [PlatformSettingsModule],
  controllers: [LicenseController],
  providers: [LicenseService, PricingService],
  exports: [LicenseService, PricingService],
})
export class LicenseModule {}
