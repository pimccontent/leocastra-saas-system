import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateCredentialsDto {
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;
}
