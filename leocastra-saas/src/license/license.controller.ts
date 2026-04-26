import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { LicenseService } from './license.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { CreateLicenseDto } from './dto/create-license.dto';
import { BuildLicenseDto } from './dto/build-license.dto';
import { UpdateLicenseDto } from './dto/update-license.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller()
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Public()
  @Get('features')
  features() {
    return this.licenseService.getFeatures();
  }

  @Post('licenses/build')
  build(
    @Body() dto: BuildLicenseDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.licenseService.buildLicense(dto, currentUser.userId);
  }

  @Post('licenses/checkout')
  checkout(
    @Body() dto: CreateLicenseDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.licenseService.checkoutLicense(dto, currentUser.userId);
  }

  @Get('licenses')
  findAll(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.licenseService.findAllForUser(currentUser.userId);
  }

  @Get('licenses/:key')
  findByKey(
    @Param('key') key: string,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.licenseService.findByKeyForUser(key, currentUser.userId);
  }

  @Patch('licenses/:key')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateLicenseDto,
    @CurrentUser() currentUser: CurrentUserPayload,
  ) {
    return this.licenseService.updateLicense(key, dto, currentUser.userId);
  }

  @Public()
  @Get('license/validate')
  validateByHeader(@Headers('x-license-key') key?: string) {
    if (!key) {
      throw new BadRequestException('x-license-key header is required');
    }
    return this.licenseService.validateByKey(key);
  }
}
