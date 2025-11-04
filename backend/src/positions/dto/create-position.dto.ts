import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePositionDto {
  @IsString()
  vehicleId!: string;

  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsNumber()
  speed?: number;

  @IsOptional()
  timestamp?: Date;
}
