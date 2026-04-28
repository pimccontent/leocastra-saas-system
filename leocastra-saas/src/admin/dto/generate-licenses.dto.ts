import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CreateLicenseDto } from '../../license/dto/create-license.dto';

export class GenerateLicensesDto extends CreateLicenseDto {
  @IsInt()
  @Min(1)
  @Max(200)
  count!: number;

  @IsOptional()
  note?: string;
}

