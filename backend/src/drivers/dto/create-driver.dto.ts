import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateDriverDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  license?: string;

  @IsOptional()
  @IsString()
  userId?: string;

   @IsOptional()
   @IsString()
   club?: string;

   @IsOptional()
   @IsString()
   nickname?: string;

  @IsOptional()
  @IsBoolean()
  preferNickname?: boolean;
}
