import { IsOptional, IsString } from 'class-validator';

export class CreateRouteDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  geojson?: any; // se acepta JSON libre (GeoJSON)
}
