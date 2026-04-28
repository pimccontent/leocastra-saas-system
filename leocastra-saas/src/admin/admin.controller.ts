import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { AdminUpdateFeatureDto } from './dto/admin-update-feature.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { GenerateLicenseKeysDto } from './dto/generate-license-keys.dto';
import { GenerateLicensesDto } from './dto/generate-licenses.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  overview(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.adminService.getOverview(currentUser.userId);
  }

  @Get('customers')
  customers(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.adminService.getCustomers(currentUser.userId);
  }

  @Get('transactions')
  transactions(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.adminService.getTransactions(currentUser.userId);
  }

  @Patch('transactions/:id')
  updateTransaction(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.adminService.updateTransaction(currentUser.userId, id, dto);
  }

  @Delete('transactions/:id')
  deleteTransaction(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.adminService.deleteTransaction(currentUser.userId, id);
  }

  @Get('platform-settings')
  platformSettings(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.adminService.getPlatformSettings(currentUser.userId);
  }

  @Patch('platform-settings')
  updatePlatformSettings(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: UpdatePlatformSettingsDto,
  ) {
    return this.adminService.updatePlatformSettings(currentUser.userId, dto);
  }

  @Get('features')
  listFeatures(@CurrentUser() currentUser: CurrentUserPayload) {
    return this.adminService.listCatalogFeatures(currentUser.userId);
  }

  @Patch('features/:key')
  updateFeature(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Param('key') key: string,
    @Body() dto: AdminUpdateFeatureDto,
  ) {
    return this.adminService.updateCatalogFeature(currentUser.userId, key, dto);
  }

  @Post('licenses/generate-keys')
  generateLicenseKeys(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: GenerateLicenseKeysDto,
  ) {
    return this.adminService.generateLicenseKeys(currentUser.userId, dto);
  }

  @Post('licenses/generate')
  generateLicenses(
    @CurrentUser() currentUser: CurrentUserPayload,
    @Body() dto: GenerateLicensesDto,
  ) {
    return this.adminService.generateLicenses(currentUser.userId, dto);
  }
}
