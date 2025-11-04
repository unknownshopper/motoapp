import { Module } from '@nestjs/common';
import { PositionsService } from './positions.service';
import { PositionsGateway } from './positions.gateway';
import { PositionsController } from './positions.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [PositionsService, PositionsGateway, PrismaService],
  controllers: [PositionsController],
})
export class PositionsModule {}
