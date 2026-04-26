import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class InitializePaymentDto {
  @IsUUID()
  organizationId!: string;

  @IsUUID()
  planId!: string;

  @IsString()
  @IsIn(['paystack', 'binancepay'])
  provider!: 'paystack' | 'binancepay';

  @IsOptional()
  @IsString()
  currency?: string;
}
