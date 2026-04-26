export type PaymentProviderName = 'paystack' | 'binancepay';

export type InitializePaymentInput = {
  amountCents: number;
  currency: string;
  email: string;
  reference: string;
  metadata?: Record<string, unknown>;
};

export type InitializePaymentResult = {
  providerRef: string;
  authorizationUrl: string;
  metadata?: Record<string, unknown>;
};

export type VerifyPaymentResult = {
  successful: boolean;
  providerRef: string;
  raw?: Record<string, unknown>;
};

export type HandleWebhookResult = {
  successful: boolean;
  providerRef: string;
  raw?: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  initializePayment(
    input: InitializePaymentInput,
  ): Promise<InitializePaymentResult>;
  verifyPayment(providerRef: string): Promise<VerifyPaymentResult>;
  handleWebhook(payload: unknown, signature?: string): Promise<HandleWebhookResult>;
}
