import { Module } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [VehiclesController],
  providers: [VehiclesService, PrismaService],
})
export class VehiclesModule {}
