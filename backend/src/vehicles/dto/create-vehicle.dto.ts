import { IsOptional, IsString } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  plate!: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  club?: string;

  @IsOptional()
  @IsString()
  driverId?: string;
}
