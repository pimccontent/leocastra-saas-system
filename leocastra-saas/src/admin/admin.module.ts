import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { LicenseModule } from '../license/license.module';

@Module({
  imports: [PlatformSettingsModule, LicenseModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
