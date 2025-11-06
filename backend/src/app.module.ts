import { Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { DriversModule } from './drivers/drivers.module';
import { RoutesModule } from './routes/routes.module';
import { PositionsModule } from './positions/positions.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { AppController } from './app.controller';

@Module({
  imports: [AuthModule, VehiclesModule, DriversModule, RoutesModule, PositionsModule, RegistrationsModule],
  controllers: [AppController],
  providers: [PrismaService],
})
export class AppModule {}
