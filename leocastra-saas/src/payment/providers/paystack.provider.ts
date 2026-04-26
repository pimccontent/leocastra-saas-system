import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
export class PaystackProvider implements PaymentProvider {
  readonly name = 'paystack' as const;

  constructor(private readonly platformSettings: PlatformSettingsService) {}

  async initializePayment(
    input: InitializePaymentInput,
  ): Promise<InitializePaymentResult> {
    const settings = await this.platformSettings.getRaw();
    const secretKey =
      settings.paystackSecretKey?.trim() ||
      process.env.PAYSTACK_SECRET_KEY?.trim();

    if (!secretKey) {
      return {
        providerRef: input.reference,
        authorizationUrl: `https://paystack.mock/checkout/${input.reference}`,
        metadata: {
          gateway: 'paystack',
          mode: 'mock',
        },
      };
    }

    const callbackUrl = process.env.PAYSTACK_CALLBACK_URL?.trim();
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.email,
        amount: input.amountCents,
        currency: input.currency,
        reference: input.reference,
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        metadata: {
          ...input.metadata,
          leocastraRef: input.reference,
        },
      }),
    });

    const json = (await res.json()) as {
      status?: boolean;
      message?: string;
      data?: {
        authorization_url?: string;
        reference?: string;
        access_code?: string;
      };
    };

    if (!json.status || !json.data?.authorization_url) {
      throw new BadRequestException(
        json.message ?? 'Paystack initialization failed',
      );
    }

    return {
      providerRef: json.data.reference ?? input.reference,
      authorizationUrl: json.data.authorization_url,
      metadata: json.data as Record<string, unknown>,
    };
  }

  async verifyPayment(providerRef: string): Promise<VerifyPaymentResult> {
    return {
      successful: true,
      providerRef,
      raw: { status: 'success' },
    };
  }

  async handleWebhook(
    payload: unknown,
    signature?: string,
  ): Promise<HandleWebhookResult> {
    await this.validateSignature(payload, signature);
    const body = (payload ?? {}) as Record<string, unknown>;
    const providerRef =
      (body.reference as string | undefined) ??
      (body.providerRef as string | undefined) ??
      '';
    const status = (body.status as string | undefined)?.toLowerCase();
    return {
      successful: status === 'success' || status === 'succeeded',
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
      settings.paystackWebhookSecret?.trim() ||
      process.env.PAYSTACK_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return;
    }
    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const digest = createHmac('sha512', secret)
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
