import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateLicenseKeysDto {
  @IsInt()
  @Min(1)
  @Max(500)
  count!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

