import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';
import {
  HandleWebhookResult,
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentProvider,
  VerifyPaymentResult,
} from './payment-provider.interface';

@Injectable()
export class BinancePayProvider implements PaymentProvider {
  readonly name = 'binancepay' as const;

  constructor(private readonly platformSettings: PlatformSettingsService) {}

  async initializePayment(
    input: InitializePaymentInput,
  ): Promise<InitializePaymentResult> {
    const settings = await this.platformSettings.getRaw();
    const hasKeys =
      !!(settings.binancePayApiKey?.trim() && settings.binancePaySecretKey?.trim()) ||
      !!(
        process.env.BINANCEPAY_API_KEY?.trim() &&
        process.env.BINANCEPAY_SECRET_KEY?.trim()
      );

    return {
      providerRef: input.reference,
      authorizationUrl: `https://binancepay.mock/checkout/${input.reference}${
        hasKeys ? '?configured=1' : ''
      }`,
      metadata: {
        gateway: 'binancepay',
        mode: hasKeys ? 'configured_stub' : 'mock',
      },
    };
  }

  async verifyPayment(providerRef: string): Promise<VerifyPaymentResult> {
    return {
      successful: true,
      providerRef,
      raw: { status: 'SUCCESS' },
    };
  }

  async handleWebhook(
    payload: unknown,
    signature?: string,
  ): Promise<HandleWebhookResult> {
    await this.validateSignature(payload, signature);
    const body = (payload ?? {}) as Record<string, unknown>;
    const providerRef =
      (body.merchantTradeNo as string | undefined) ??
      (body.providerRef as string | undefined) ??
      '';
    const status = (body.status as string | undefined)?.toUpperCase();
    return {
      successful: status === 'SUCCESS' || status === 'PAID',
      providerRef,
      raw: body,
    };
  }

  private async validateSignature(
    payload: unknown,
    signature?: string,
  ): Promise<void> {
    const settings = await this.platformSettings.getRaw();
    const secret =
      settings.binancePayWebhookSecret?.trim() ||
      process.env.BINANCEPAY_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return;
    }
    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const digest = createHmac('sha256', secret)
      .update(JSON.stringify(payload ?? {}))
      .digest('hex');

    const provided = signature.trim().toLowerCase();
    const expected = digest.toLowerCase();
    const isValid =
      provided.length === expected.length &&
      timingSafeEqual(Buffer.from(provided), Buffer.from(expected));

    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
