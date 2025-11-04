import { IsArray, IsEmail, IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRegistrationDto {
  @IsEnum(['PILOT', 'SPECTATOR', 'SPONSOR'] as any)
  type!: 'PILOT' | 'SPECTATOR' | 'SPONSOR';

  @IsString()
  routeId!: string;

  @IsISO8601()
  when!: string; // ISO string from frontend

  @IsOptional()
  @IsArray()
  @IsISO8601({ strict: true }, { each: true })
  whenMultiple?: string[];

  @IsString()
  @Length(2, 120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(5, 30)
  phone!: string;

  @IsOptional()
  @IsString()
  @Length(3, 50)
  license?: string;

  @IsOptional()
  @IsString()
  motoPlate?: string;

  @IsOptional()
  @IsString()
  motoBrand?: string;

  @IsOptional()
  @IsString()
  motoModel?: string;

  @IsOptional()
  @IsString()
  motoClub?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  services?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SponsorLocationInput)
  sponsorLocations?: SponsorLocationInput[];
}

export class SponsorLocationInput {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
