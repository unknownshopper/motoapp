import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PositionsGateway } from './positions.gateway';
import { CreatePositionDto } from './dto/create-position.dto';

@Injectable()
export class PositionsService {
  constructor(private prisma: PrismaService, private gateway: PositionsGateway) {}

  async create(dto: CreatePositionDto) {
    const pos = await this.prisma.position.create({
      data: {
        vehicleId: dto.vehicleId,
        lat: dto.lat,
        lng: dto.lng,
        speed: dto.speed,
        timestamp: dto.timestamp ?? undefined,
      },
    });
    this.gateway.broadcastUpdate({ vehicleId: pos.vehicleId, lat: pos.lat, lng: pos.lng, ts: new Date(pos.timestamp).getTime() });
    return pos;
  }

  async lastByVehicle(vehicleId: string) {
    return this.prisma.position.findFirst({ where: { vehicleId }, orderBy: { timestamp: 'desc' } });
  }

  async lastAll() {
    // última posición por cada vehículo usando groupBy + findMany
    const groups = await this.prisma.position.groupBy({
      by: ['vehicleId'],
      _max: { timestamp: true },
    });
    if (groups.length === 0) return [] as any[];
    const whereOr: { vehicleId: string; timestamp: Date }[] = (groups as Array<{ vehicleId: string; _max: { timestamp: Date | null } }>)
      .filter((g: { vehicleId: string; _max: { timestamp: Date | null } }): g is { vehicleId: string; _max: { timestamp: Date } } => !!g._max.timestamp)
      .map((g: { vehicleId: string; _max: { timestamp: Date } }) => ({ vehicleId: g.vehicleId, timestamp: g._max.timestamp }));
    const rows = await this.prisma.position.findMany({
      where: { OR: whereOr },
    });
    return rows;
  }
}
