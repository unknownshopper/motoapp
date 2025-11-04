import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ namespace: '/positions', cors: { origin: process.env.CORS_ORIGIN || '*' } })
export class PositionsGateway {
  @WebSocketServer()
  server!: Server;

  broadcastUpdate(payload: { vehicleId: string; lat: number; lng: number; ts?: number }) {
    this.server.emit('position:update', payload);
  }
}
