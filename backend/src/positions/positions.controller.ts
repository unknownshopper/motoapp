import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PositionsService } from './positions.service';
import { CreatePositionDto } from './dto/create-position.dto';

@UseGuards(JwtAuthGuard)
@Controller('positions')
export class PositionsController {
  constructor(private readonly service: PositionsService) {}

  @Post()
  create(@Body() dto: CreatePositionDto) {
    return this.service.create(dto);
  }

  @Get('last')
  lastAll() {
    return this.service.lastAll();
  }

  @Get('last/:vehicleId')
  lastByVehicle(@Param('vehicleId') vehicleId: string) {
    return this.service.lastByVehicle(vehicleId);
  }
}
