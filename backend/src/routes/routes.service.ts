import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

@Injectable()
export class RoutesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.route.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const r = await this.prisma.route.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Route not found');
    return r;
  }

  create(dto: CreateRouteDto) {
    return this.prisma.route.create({ data: dto as any });
  }

  async update(id: string, dto: UpdateRouteDto) {
    await this.findOne(id);
    return this.prisma.route.update({ where: { id }, data: dto as any });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.route.delete({ where: { id } });
    return { ok: true };
  }
}
