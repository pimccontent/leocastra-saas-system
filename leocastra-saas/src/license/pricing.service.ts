import { Injectable } from '@nestjs/common';

export type PricingDuration = 'monthly' | 'yearly';

export type FeaturePricingInput = {
  key: string;
  priceCents: number;
  unit: 'per_stream' | 'flat';
  quantity: number;
};

export type PricingBreakdown = {
  featureKey: string;
  unit: 'per_stream' | 'flat';
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
};

@Injectable()
export class PricingService {
  calculateTotalPrice(
    inputs: FeaturePricingInput[],
    duration: PricingDuration,
  ): { durationMultiplier: number; subtotalCents: number; totalCents: number; breakdown: PricingBreakdown[] } {
    const durationMultiplier = duration === 'yearly' ? 12 : 1;
    const breakdown = inputs.map((item) => {
      const effectiveQuantity = item.unit === 'flat' ? 1 : item.quantity;
      const subtotalCents =
        Math.max(0, item.priceCents) * Math.max(0, effectiveQuantity);
      return {
        featureKey: item.key,
        unit: item.unit,
        quantity: effectiveQuantity,
        unitPriceCents: Math.max(0, item.priceCents),
        subtotalCents,
      };
    });
    const subtotalCents = breakdown.reduce(
      (total, item) => total + item.subtotalCents,
      0,
    );
    return {
      durationMultiplier,
      subtotalCents,
      totalCents: subtotalCents * durationMultiplier,
      breakdown,
    };
  }
}
