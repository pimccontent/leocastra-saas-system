import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PlatformSettingsRecord = {
  id: string;
  siteTitle: string | null;
  siteDescription: string | null;
  siteLogoUrl: string | null;
  siteFaviconUrl: string | null;
  seoMetaTitle: string | null;
  seoMetaDescription: string | null;
  seoKeywords: Prisma.JsonValue | null;
  paystackPublicKey: string | null;
  paystackSecretKey: string | null;
  paystackCallbackUrl: string | null;
  paystackWebhookSecret: string | null;
  binancePayApiKey: string | null;
  binancePaySecretKey: string | null;
  binancePayMerchantId: string | null;
  binancePayWebhookSecret: string | null;
  billingBaseCurrency: string;
  exchangeRates: Prisma.JsonValue | null;
};

export type CurrencyConfig = {
  baseCurrency: string;
  exchangeRates: Record<string, number>;
};

@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRaw(): Promise<PlatformSettingsRecord> {
    return this.prisma.platformSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    });
  }

  async updateFields(data: Prisma.PlatformSettingsUpdateInput) {
    await this.getRaw();
    return this.prisma.platformSettings.update({
      where: { id: 'default' },
      data,
    });
  }

  async getCurrencyConfig(): Promise<CurrencyConfig> {
    const row = await this.getRaw();
    const baseCurrency = (row.billingBaseCurrency || 'USD').toUpperCase();
    const rawRates =
      row.exchangeRates && typeof row.exchangeRates === 'object' && !Array.isArray(row.exchangeRates)
        ? (row.exchangeRates as Record<string, unknown>)
        : {};
    const exchangeRates: Record<string, number> = { [baseCurrency]: 1 };
    for (const [key, value] of Object.entries(rawRates)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        exchangeRates[key.toUpperCase()] = value;
      }
    }
    if (!exchangeRates.USD) {
      exchangeRates.USD = 1;
    }
    return { baseCurrency, exchangeRates };
  }

  convertAmountCents(
    amountCents: number,
    fromCurrency: string,
    toCurrency: string,
    currencyConfig: CurrencyConfig,
  ): number {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    if (from === to) {
      return Math.max(0, Math.round(amountCents));
    }
    const base = currencyConfig.baseCurrency.toUpperCase();
    const rates = currencyConfig.exchangeRates;
    const fromRate = from === base ? 1 : rates[from];
    const toRate = to === base ? 1 : rates[to];
    if (!fromRate || !toRate) {
      return Math.max(0, Math.round(amountCents));
    }
    const inBase = amountCents / fromRate;
    return Math.max(0, Math.round(inBase * toRate));
  }
}
