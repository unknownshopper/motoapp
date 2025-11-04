import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.driver.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { vehicles: true } } },
    });
  }

  async findOne(id: string) {
    const d = await this.prisma.driver.findUnique({
      where: { id },
      include: { _count: { select: { vehicles: true } } },
    });
    if (!d) throw new NotFoundException('Driver not found');
    return d;
  }

  create(dto: CreateDriverDto) {
    return this.prisma.driver.create({ data: dto });
  }

  async update(id: string, dto: UpdateDriverDto) {
    await this.findOne(id);
    return this.prisma.driver.update({ where: { id }, data: dto });
    }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.driver.delete({ where: { id } });
    return { ok: true };
  }
}
