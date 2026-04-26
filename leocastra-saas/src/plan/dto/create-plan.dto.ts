import { IsInt, IsNotEmpty, IsObject, IsString, Min } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(0)
  price!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsInt()
  @Min(1)
  maxStreams!: number;

  @IsObject()
  features!: Record<string, unknown>;
}
