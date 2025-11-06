import { Body, Controller, Get, Patch, Post, Param, Delete, UseGuards, Req, ForbiddenException, BadRequestException, Query, ConflictException } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly service: RegistrationsService) {}

  // Público: crear solicitud de registro a una rodada
  @Post()
  async create(@Body() dto: CreateRegistrationDto) {
    try {
      // Validaciones mínimas del lado servidor por tipo
      const type = dto.type;
      if (!dto.name?.trim()) throw new BadRequestException('name required');
      if (!dto.email?.trim()) throw new BadRequestException('email required');
      if (!dto.phone?.trim()) throw new BadRequestException('phone required');
      if (!type) throw new BadRequestException('type required');
      if (type === 'PILOT' || type === 'SPECTATOR' || type === 'SPONSOR') {
        const hasRouteId = typeof (dto as any).routeId === 'string' && (dto as any).routeId.trim().length > 0;
        const hasRouteSlug = typeof (dto as any).routeSlug === 'string' && (dto as any).routeSlug.trim().length > 0;
        if (!hasRouteId && !hasRouteSlug) throw new BadRequestException('routeId or routeSlug required');
        // 'when' es obligatorio para PILOT y SPECTATOR, pero opcional para SPONSOR
        if ((type === 'PILOT' || type === 'SPECTATOR') && !dto.when?.trim()) throw new BadRequestException('when required');
      }
      if (type === 'PILOT') {
        if (!dto.license?.trim()) throw new BadRequestException('license required for PILOT');
      }
      if (type === 'SPONSOR') {
        if (!dto.companyName?.trim()) throw new BadRequestException('companyName required for SPONSOR');
        const locs = dto.sponsorLocations || [];
        if (!Array.isArray(locs) || locs.length === 0) throw new BadRequestException('At least one sponsor location is required');
        for (const l of locs) {
          if (typeof l?.lat !== 'number' || typeof l?.lng !== 'number') throw new BadRequestException('Each sponsor location must include numeric lat and lng');
        }
      }
      return await this.service.create(dto);
    } catch (e: any) {
      // Log para diagnóstico
      console.error('Registration create error', { dto, error: e?.message });
      if (e instanceof BadRequestException || e instanceof ConflictException) throw e;
      throw new BadRequestException('Invalid registration payload');
    }
  }

  // Admin: listar pendientes
  @UseGuards(JwtAuthGuard)
  @Get('pending')
  async pending(@Req() req: any) {
    if (req.user?.role !== 'ADMIN') throw new ForbiddenException();
    return this.service.listPending();
  }

  // Admin: listar sponsors por estado (o todos)
  @UseGuards(JwtAuthGuard)
  @Get('sponsors')
  async sponsors(@Req() req: any, @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    if (req.user?.role !== 'ADMIN') throw new ForbiddenException();
    return this.service.listSponsors(status);
  }

  // Público: sponsors aprobados con POIs
  @Get('sponsors-public')
  async sponsorsPublicApproved() {
    return this.service.listSponsors('APPROVED');
  }

  // Admin: aprobar/rechazar
  @UseGuards(JwtAuthGuard)
  @Patch(':id/status')
  async setStatus(@Param('id') id: string, @Body() body: { status: 'APPROVED' | 'REJECTED' }, @Req() req: any) {
    if (req.user?.role !== 'ADMIN') throw new ForbiddenException();
    const status = body?.status === 'APPROVED' ? 'APPROVED' : body?.status === 'REJECTED' ? 'REJECTED' : null;
    if (!status) throw new ForbiddenException('Invalid status');
    return this.service.setStatus(id, status);
  }

  // Admin: actualizar registro (campos básicos del sponsor)
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    if (req.user?.role !== 'ADMIN') throw new ForbiddenException();
    return this.service.updateRegistration(id, body);
  }

  // Admin: eliminar registro
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    if (req.user?.role !== 'ADMIN') throw new ForbiddenException();
    return this.service.deleteRegistration(id);
  }

  // Admin: POIs del sponsor - crear
  @UseGuards(JwtAuthGuard)
  @Post(':id/pois')
  async addPoi(@Param('id') id: string, @Body() body: { lat: number; lng: number; label?: string; category?: string; note?: string }, @Req() req: any) {
    if (req.user?.role !== 'ADMIN') throw new ForbiddenException();
    if (typeof body?.lat !== 'number' || typeof body?.lng !== 'number') throw new BadRequestException('lat/lng required');
    return this.service.addSponsorPoi(id, body);
  }

  // Admin: POIs del sponsor - actualizar
  @UseGuards(JwtAuthGuard)
  @Patch(':id/pois/:poiId')
  async updatePoi(@Param('id') id: string, @Param('poiId') poiId: string, @Body() body: { label?: string; category?: string; note?: string }, @Req() req: any) {
    if (req.user?.role !== 'ADMIN') throw new ForbiddenException();
    return this.service.updateSponsorPoi(id, poiId, body);
  }

  // Admin: POIs del sponsor - eliminar
  @UseGuards(JwtAuthGuard)
  @Delete(':id/pois/:poiId')
  async deletePoi(@Param('id') id: string, @Param('poiId') poiId: string, @Req() req: any) {
    if (req.user?.role !== 'ADMIN') throw new ForbiddenException();
    return this.service.deleteSponsorPoi(id, poiId);
  }
}
