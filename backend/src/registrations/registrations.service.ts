import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';

@Injectable()
export class RegistrationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRegistrationDto) {
    // Resolver routeId desde routeSlug si es necesario
    let routeId = dto.routeId;
    if (!routeId && (dto as any).routeSlug) {
      const route = await this.prisma.route.findUnique({ where: ({ slug: (dto as any).routeSlug } as unknown) as any });
      if (!route) throw new NotFoundException('Route not found');
      routeId = route.id;
    }
    if (!routeId) throw new NotFoundException('Route not specified');
    // Regla: 1 ruta, 1 piloto, 1 vehículo (evitar duplicados en misma ruta)
    if (dto.type === 'PILOT') {
      const exists = await this.prisma.registration.findFirst({
        where: {
          routeId,
          type: 'PILOT' as any,
          OR: [
            { email: dto.email },
            ...(dto.license ? [{ license: dto.license }] : []),
            ...(dto.motoPlate ? [{ motoPlate: dto.motoPlate }] : []),
          ] as any,
        } as any,
      });
      if (exists) {
        throw new ConflictException('Pilot already registered for this route');
      }
    }
    const baseData = {
      routeId,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      license: dto.license || '',
      motoPlate: dto.motoPlate || undefined,
      motoBrand: dto.motoBrand || undefined,
      motoModel: dto.motoModel || undefined,
      motoClub: dto.motoClub || undefined,
      message: dto.message || undefined,
      type: dto.type as any,
      companyName: dto.companyName || undefined,
      website: dto.website || undefined,
      services: dto.services || undefined,
    } as any;

    const sponsorLocs = dto.sponsorLocations && dto.sponsorLocations.length > 0
      ? {
          create: dto.sponsorLocations.map((l) => ({
            lat: l.lat,
            lng: l.lng,
            label: l.label || undefined,
            category: l.category || undefined,
            note: l.note || undefined,
          })),
        }
      : undefined;

    // Si es SPONSOR y envían varias fechas en un solo request, crear UN registro y N SponsorDate
    if (dto.type === 'SPONSOR' && Array.isArray(dto.whenMultiple) && dto.whenMultiple.length > 0) {
      const first = dto.whenMultiple[0];
      const reg = await this.prisma.registration.create({
        data: {
          ...baseData,
          when: new Date(first),
          sponsorLocations: sponsorLocs,
        },
        include: { sponsorLocations: true } as any,
      });
      const dateData = dto.whenMultiple.map((w) => ({ registrationId: reg.id, when: new Date(w) }));
      if (dateData.length > 0) {
        await (this.prisma as any).sponsorDate.createMany({ data: dateData });
      }
      const full = await this.prisma.registration.findUnique({
        where: { id: reg.id },
        include: ({ sponsorLocations: true, dates: true } as unknown) as any,
      });
      return full;
    }

    const when = dto.when ? new Date(dto.when) : new Date();
    const created = await this.prisma.registration.create({
      data: {
        ...baseData,
        when,
        sponsorLocations: sponsorLocs,
      },
      include: { sponsorLocations: true } as any,
    });
    // si es sponsor con una sola fecha, también registrar en SponsorDate para consistencia
    if (dto.type === 'SPONSOR') {
      await (this.prisma as any).sponsorDate.create({ data: { registrationId: created.id, when } });
      const full = await this.prisma.registration.findUnique({ where: { id: created.id }, include: ({ sponsorLocations: true, dates: true } as unknown) as any });
      return full;
    }
    return created;
  }

  async listPending() {
    return this.prisma.registration.findMany({
      where: { status: 'PENDING' as any } as any,
      orderBy: { createdAt: 'desc' },
      include: { route: { select: { id: true, name: true } }, sponsorLocations: true, dates: true } as any,
    });
  }

  async listSponsors(status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    return this.prisma.registration.findMany({
      where: ({ type: 'SPONSOR', ...(status ? { status } : {}) } as unknown) as any,
      orderBy: { createdAt: 'desc' },
      include: ({ route: { select: { id: true, name: true } }, sponsorLocations: true, dates: true } as unknown) as any,
    });
  }

  async setStatus(id: string, status: 'APPROVED' | 'REJECTED') {
    const reg = await this.prisma.registration.findUnique({ where: { id } });
    if (!reg) throw new NotFoundException('Registration not found');
    const updated = await this.prisma.registration.update({ where: { id }, data: { status: status as any } });
    if (status === 'APPROVED' && (reg as any).type === 'PILOT') {
      // Crear Driver y Vehicle en base al registro
      const slug = await this.makeUniqueDriverSlug(reg.name);
      const driver = await this.prisma.driver.create({
        data: {
          name: reg.name,
          license: reg.license,
          club: reg.motoClub || undefined,
          preferNickname: false,
          slug,
        },
      });
      let vehicle: any = null;
      if (reg.motoPlate) {
        vehicle = await this.prisma.vehicle.create({
          data: {
            plate: reg.motoPlate,
            brand: reg.motoBrand || undefined,
            model: reg.motoModel || undefined,
            club: reg.motoClub || undefined,
            driverId: driver.id,
          },
        });
      }
      return { updated, driver, vehicle };
    }
    return { updated };
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

  private async makeUniqueDriverSlug(name: string) {
    const base = this.slugify(name);
    let candidate = base || 'pilot';
    let i = 2;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const found = await this.prisma.driver.findFirst({ where: { slug: candidate } as any });
      if (!found) return candidate;
      candidate = `${base || 'pilot'}-${i++}`;
    }
  }

  // Admin: actualizar campos básicos del registro (patrocinador)
  async updateRegistration(id: string, body: any) {
    const reg = await this.prisma.registration.findUnique({ where: { id } });
    if (!reg) throw new NotFoundException('Registration not found');
    const data: any = {};
    // Campos permitidos
    if (typeof body?.companyName === 'string') data.companyName = body.companyName || null;
    if (typeof body?.website === 'string') data.website = body.website || null;
    if (typeof body?.services === 'string') data.services = body.services || null;
    if (typeof body?.message === 'string') data.message = body.message || null;
    if (typeof body?.email === 'string') data.email = body.email;
    if (typeof body?.phone === 'string') data.phone = body.phone;
    if (typeof body?.name === 'string') data.name = body.name;
    if (body?.routeId) data.routeId = body.routeId;
    if (body?.when) data.when = new Date(body.when);
    const updated = await this.prisma.registration.update({ where: { id }, data });
    return updated;
  }

  // Admin: eliminar un registro y sus POIs asociados
  async deleteRegistration(id: string) {
    const reg = await this.prisma.registration.findUnique({ where: { id } });
    if (!reg) throw new NotFoundException('Registration not found');
    await this.prisma.sponsorLocation.deleteMany({ where: { registrationId: id } });
    await this.prisma.registration.delete({ where: { id } });
    return { deleted: true };
  }

  // Admin: agregar POI a un sponsor
  async addSponsorPoi(registrationId: string, body: { lat: number; lng: number; label?: string; category?: string; note?: string }) {
    const reg = await this.prisma.registration.findUnique({ where: { id: registrationId } });
    if (!reg) throw new NotFoundException('Registration not found');
    const poi = await this.prisma.sponsorLocation.create({
      data: {
        registrationId,
        lat: body.lat,
        lng: body.lng,
        label: body.label || undefined,
        category: body.category || undefined,
        note: body.note || undefined,
      },
    });
    return poi;
  }

  // Admin: actualizar POI
  async updateSponsorPoi(registrationId: string, poiId: string, body: { label?: string; category?: string; note?: string }) {
    const poi = await this.prisma.sponsorLocation.findUnique({ where: { id: poiId } });
    if (!poi || poi.registrationId !== registrationId) throw new NotFoundException('POI not found');
    const updated = await this.prisma.sponsorLocation.update({
      where: { id: poiId },
      data: {
        label: typeof body?.label === 'string' ? body.label : poi.label,
        category: typeof body?.category === 'string' ? body.category : poi.category,
        note: typeof body?.note === 'string' ? body.note : poi.note,
      },
    });
    return updated;
  }

  // Admin: eliminar POI
  async deleteSponsorPoi(registrationId: string, poiId: string) {
    const poi = await this.prisma.sponsorLocation.findUnique({ where: { id: poiId } });
    if (!poi || poi.registrationId !== registrationId) throw new NotFoundException('POI not found');
    await this.prisma.sponsorLocation.delete({ where: { id: poiId } });
    return { deleted: true };
  }
}
