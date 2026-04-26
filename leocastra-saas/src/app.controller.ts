import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PlatformSettingsService } from './platform-settings/platform-settings.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('site/settings')
  async getSiteSettings() {
    const settings = await this.platformSettings.getRaw();
    return {
      title: settings.siteTitle ?? 'LeoCastra SaaS',
      description:
        settings.siteDescription ?? 'Create your license, you only pay for what you need.',
      logoUrl: settings.siteLogoUrl,
      faviconUrl: settings.siteFaviconUrl,
      seo: {
        metaTitle: settings.seoMetaTitle,
        metaDescription: settings.seoMetaDescription,
        keywords: Array.isArray(settings.seoKeywords) ? settings.seoKeywords : [],
      },
    };
  }
}
