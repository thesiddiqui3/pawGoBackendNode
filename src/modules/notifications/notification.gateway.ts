import { Logger, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

interface JwtUser {
  sub: string;
  email: string;
  role: string;
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/notifications',
  transports: ['websocket', 'polling'],
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly userSocketMap = new Map<string, Set<string>>(); // userId → socketIds

  constructor(private readonly config: ConfigService) {}

  async handleConnection(socket: Socket) {
    try {
      const token = this.extractToken(socket);
      if (!token) {
        socket.disconnect(true);
        return;
      }

      const secret = this.config.get<string>('JWT_SECRET') ?? 'secret';
      const payload = jwt.verify(token, secret) as JwtUser;
      const userId = payload.sub;

      socket.data['userId'] = userId;
      const room = `user:${userId}`;
      await socket.join(room);

      if (!this.userSocketMap.has(userId)) this.userSocketMap.set(userId, new Set());
      this.userSocketMap.get(userId)!.add(socket.id);

      this.logger.log(`WS connected: ${socket.id} → user:${userId}`);
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = socket.data['userId'] as string | undefined;
    if (userId) {
      this.userSocketMap.get(userId)?.delete(socket.id);
      if (this.userSocketMap.get(userId)?.size === 0) this.userSocketMap.delete(userId);
    }
    this.logger.log(`WS disconnected: ${socket.id}`);
  }

  @SubscribeMessage('notification:read')
  handleNotificationRead(
    @MessageBody() data: { notificationId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const userId = socket.data['userId'] as string;
    if (userId) {
      this.server.to(`user:${userId}`).emit('notification:read', data);
    }
  }

  /** Send a real-time event to a specific user (all their connected sockets). */
  sendToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  /** Broadcast to all connected clients. */
  broadcast(event: string, payload: unknown) {
    this.server?.emit(event, payload);
  }

  private extractToken(socket: Socket): string | null {
    const authHeader = socket.handshake.headers['authorization'] as string | undefined;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    const query = socket.handshake.query['token'] as string | undefined;
    return query ?? null;
  }
}
