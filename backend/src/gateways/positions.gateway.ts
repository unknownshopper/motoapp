import { Logger } from '@nestjs/common';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  namespace: '/ws',
})
export class PositionsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PositionsGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Cliente emite: 'positions:upsert' con payload { vehicleId, lat, lng, speed? }
  @SubscribeMessage('positions:upsert')
  onUpsert(@MessageBody() payload: any) {
    // Para MVP no persistimos aún; solo reenviamos a todos.
    this.server.emit('positions:update', payload);
    return { ok: true };
  }
}
