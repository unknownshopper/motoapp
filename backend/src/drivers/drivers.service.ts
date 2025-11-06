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

  async findBySlug(slug: string) {
    const d = await this.prisma.driver.findUnique({
      where: { slug } as any,
      include: { _count: { select: { vehicles: true } } },
    });
    if (!d) throw new NotFoundException('Driver not found');
    return d;
  }

  async create(dto: CreateDriverDto) {
    const slug = await this.makeUniqueDriverSlug(dto.name);
    return this.prisma.driver.create({ data: ({ ...dto, slug } as unknown) as any });
  }

  async update(id: string, dto: UpdateDriverDto) {
    const current = await this.findOne(id);
    let slug: string | undefined = (current as any).slug || undefined;
    if (dto.name && dto.name !== current.name) {
      slug = await this.makeUniqueDriverSlug(dto.name, id);
    }
    return this.prisma.driver.update({ where: { id }, data: ({ ...dto, ...(slug ? { slug } : {}) } as unknown) as any });
    }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.driver.delete({ where: { id } });
    return { ok: true };
  }

  private slugify(s: string) {
    return (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private async makeUniqueDriverSlug(name: string, excludeId?: string) {
    const base = this.slugify(name) || 'pilot';
    let candidate = base;
    let i = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const found = await this.prisma.driver.findFirst({ where: ({ slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) } as unknown) as any });
      if (!found) return candidate;
      candidate = `${base}-${i++}`;
    }
  }
}
