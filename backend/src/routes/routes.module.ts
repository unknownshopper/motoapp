import { Module } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [RoutesController],
  providers: [RoutesService, PrismaService],
})
export class RoutesModule {}
