import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.vehicle.findMany({
      orderBy: { plate: 'asc' },
      include: { driver: { select: { id: true, name: true, nickname: true, preferNickname: true } } },
    });
  }

  async findOne(id: string) {
    const v = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { driver: { select: { id: true, name: true, nickname: true, preferNickname: true } } },
    });
    if (!v) throw new NotFoundException('Vehicle not found');
    return v;
  }

  create(dto: CreateVehicleDto) {
    return this.prisma.vehicle.create({ data: dto });
  }

  async update(id: string, dto: UpdateVehicleDto) {
    await this.findOne(id);
    return this.prisma.vehicle.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.vehicle.delete({ where: { id } });
    return { ok: true };
  }
}
