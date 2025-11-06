import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadedFile, UseInterceptors, Res, BadRequestException, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
// Use require to avoid TS type issues for JS-only packages
const gpxParse: any = require('gpx-parse');
// removed togpx to avoid runtime resolution issues

@Controller('routes')
export class RoutesController {
  constructor(private readonly service: RoutesService) {}

  @Get()
  list() {
    return this.service.findAll();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get('by-slug/:slug')
  getBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateRouteDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRouteDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // Importar GPX y convertir a GeoJSON para almacenar en la ruta
  @UseGuards(JwtAuthGuard)
  @Post(':id/import-gpx')
  @UseInterceptors(FileInterceptor('file'))
  async importGpx(
    @Param('id') id: string,
    @UploadedFile() file?: any,
  ) {
    if (!file || !file.buffer || !file.originalname) {
      throw new BadRequestException('file required');
    }
    const content = file.buffer.toString('utf8');
    const parsed = await new Promise<any>((resolve, reject) => {
      gpxParse.parseGpx(content, (err: any, data: any) => (err ? reject(err) : resolve(data)));
    }).catch(() => { throw new BadRequestException('Invalid GPX file'); });

    // Construir GeoJSON FeatureCollection desde tracks y waypoints
    const features: any[] = [];
    // tracks -> LineString(s)
    const tracks = Array.isArray(parsed?.tracks) ? parsed.tracks : [];
    for (const t of tracks) {
      const segs = Array.isArray(t?.segments) ? t.segments : [];
      for (const seg of segs) {
        const coords = (seg || [])
          .filter((p: any) => typeof p?.lat === 'number' && typeof p?.lon === 'number')
          .map((p: any) => [p.lon, p.lat]);
        if (coords.length > 1) {
          features.push({ type: 'Feature', properties: { source: 'gpx', kind: 'track' }, geometry: { type: 'LineString', coordinates: coords } });
        }
      }
    }
    // waypoints -> Points
    const wpts = Array.isArray(parsed?.waypoints) ? parsed.waypoints : [];
    for (const w of wpts) {
      if (typeof w?.lat === 'number' && typeof w?.lon === 'number') {
        features.push({ type: 'Feature', properties: { kind: 'poi', name: w?.name || undefined, description: w?.desc || undefined }, geometry: { type: 'Point', coordinates: [w.lon, w.lat] } });
      }
    }
    let geojson: any = null;
    if (features.length === 1) geojson = features[0];
    else geojson = { type: 'FeatureCollection', features };

    const updated = await this.service.update(id, { geojson });
    return updated;
  }

  // Exportar GPX a partir del GeoJSON almacenado en la ruta
  @Get(':id/export.gpx')
  async exportGpx(@Param('id') id: string, @Res() res: Response) {
    const route = await this.service.findOne(id).catch(() => null);
    if (!route) throw new NotFoundException('Route not found');
    let g: any = (route as any).geojson;
    if (!g) throw new NotFoundException('Route has no geojson');
    try { if (typeof g === 'string') g = JSON.parse(g); } catch { /* ignore */ }
    const toFC = (x: any) => (x?.type === 'FeatureCollection' ? x : (x?.type ? { type: 'Feature', properties: {}, geometry: x } : { type: 'FeatureCollection', features: [] }));
    const fcLike = toFC(g);
    const features: any[] = fcLike.type === 'FeatureCollection' ? (fcLike.features || []) : [fcLike];
    const lineCoords: Array<[number, number]> = [];
    const waypoints: Array<{ lon: number; lat: number; name?: string; desc?: string }> = [];
    const pushLine = (coords: any) => {
      if (Array.isArray(coords)) {
        for (const c of coords) {
          if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') lineCoords.push([c[0], c[1]]);
        }
      }
    };
    const visitGeom = (geom: any, props: any) => {
      if (!geom) return;
      const t = geom.type;
      if (t === 'LineString') pushLine(geom.coordinates);
      else if (t === 'MultiLineString') {
        for (const seg of geom.coordinates || []) pushLine(seg);
      } else if (t === 'Point') {
        const [lon, lat] = geom.coordinates || [];
        if (typeof lon === 'number' && typeof lat === 'number') {
          const name = props?.name;
          const desc = props?.description || props?.poiType || props?.type;
          waypoints.push({ lon, lat, name, desc });
        }
      } else if (t === 'FeatureCollection') {
        for (const f of geom.features || []) visitGeom(f.geometry, f.properties);
      } else if (t === 'Feature') {
        visitGeom(geom.geometry, geom.properties);
      }
    };
    for (const f of features) visitGeom(f.geometry || f, f.properties || {});
    let xml = '';
    xml += '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<gpx version="1.1" creator="motoapp" xmlns="http://www.topografix.com/GPX/1/1">\n';
    for (const w of waypoints) {
      const name = w.name ? `<name>${escapeXml(String(w.name))}</name>` : '';
      const desc = w.desc ? `<desc>${escapeXml(String(w.desc))}</desc>` : '';
      xml += `  <wpt lat="${w.lat}" lon="${w.lon}">${name}${desc}</wpt>\n`;
    }
    if (lineCoords.length > 1) {
      xml += '  <trk><name>route</name><trkseg>\n';
      for (const c of lineCoords) xml += `    <trkpt lat="${c[1]}" lon="${c[0]}"></trkpt>\n`;
      xml += '  </trkseg></trk>\n';
    }
    xml += '</gpx>';
    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader('Content-Disposition', `attachment; filename="route-${id}.gpx"`);
    res.send(xml);
  }
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
