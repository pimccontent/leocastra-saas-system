import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AdminUpdateFeatureDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsIn(['per_stream', 'flat'])
  unit?: 'per_stream' | 'flat';
}
