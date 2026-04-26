import { IsOptional, IsString } from 'class-validator';
import { CreateLicenseDto } from './create-license.dto';

export class BuildLicenseDto extends CreateLicenseDto {
  @IsOptional()
  @IsString()
  declare currency?: string;
}
