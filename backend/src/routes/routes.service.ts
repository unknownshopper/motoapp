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

  async findBySlug(slug: string) {
    const r = await this.prisma.route.findUnique({ where: { slug } as any });
    if (!r) throw new NotFoundException('Route not found');
    return r;
  }

  async create(dto: CreateRouteDto) {
    const slug = await this.makeUniqueSlug(dto.name);
    return this.prisma.route.create({ data: ({ ...dto, slug } as unknown) as any });
  }

  async update(id: string, dto: UpdateRouteDto) {
    const current = await this.findOne(id);
    let slug: string | undefined = (current as any).slug || undefined;
    if (dto.name && dto.name !== current.name) {
      slug = await this.makeUniqueSlug(dto.name, id);
    }
    return this.prisma.route.update({ where: { id }, data: ({ ...dto, ...(slug ? { slug } : {}) } as unknown) as any });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Manually remove dependent data to avoid FK violations
    const regs = await this.prisma.registration.findMany({ where: { routeId: id }, select: { id: true } });
    if (regs.length > 0) {
      const regIds = regs.map((r) => r.id);
      await this.prisma.sponsorLocation.deleteMany({ where: { registrationId: { in: regIds } } });
      await this.prisma.sponsorDate.deleteMany({ where: { registrationId: { in: regIds } } });
      await this.prisma.registration.deleteMany({ where: { id: { in: regIds } } });
    }
    await this.prisma.route.delete({ where: { id } });
    return { ok: true };
  }

  private async makeUniqueSlug(name: string, excludeId?: string) {
    const base = this.slugify(name);
    let candidate = base;
    let i = 2;
    // loop until unique
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const found = await this.prisma.route.findFirst({ where: ({ slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) } as unknown) as any });
      if (!found) return candidate;
      candidate = `${base}-${i++}`;
    }
  }

  private slugify(s: string) {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
}
