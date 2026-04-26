import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  siteTitle?: string;

  @IsOptional()
  @IsString()
  siteDescription?: string;

  @IsOptional()
  @IsString()
  siteLogoUrl?: string;

  @IsOptional()
  @IsString()
  siteFaviconUrl?: string;

  @IsOptional()
  @IsString()
  seoMetaTitle?: string;

  @IsOptional()
  @IsString()
  seoMetaDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seoKeywords?: string[];

  @IsOptional()
  @IsString()
  billingBaseCurrency?: string;

  @IsOptional()
  @IsObject()
  exchangeRates?: Record<string, number>;

  @IsOptional()
  @IsString()
  paystackPublicKey?: string;

  @IsOptional()
  @IsString()
  paystackSecretKey?: string;

  @IsOptional()
  @IsString()
  paystackWebhookSecret?: string;

  @IsOptional()
  @IsString()
  binancePayApiKey?: string;

  @IsOptional()
  @IsString()
  binancePaySecretKey?: string;

  @IsOptional()
  @IsString()
  binancePayMerchantId?: string;

  @IsOptional()
  @IsString()
  binancePayWebhookSecret?: string;
}
