import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LicenseItemInputDto } from '../../license/dto/create-license.dto';

export class InitializeLicensePaymentDto {
  @IsUUID()
  organizationId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LicenseItemInputDto)
  items!: LicenseItemInputDto[];

  @IsIn(['monthly', 'yearly'])
  duration!: 'monthly' | 'yearly';

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  seats?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsString()
  @IsIn(['paystack', 'binancepay'])
  provider!: 'paystack' | 'binancepay';
}
