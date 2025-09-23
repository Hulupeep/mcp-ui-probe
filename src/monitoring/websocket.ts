import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { StorageService } from './storage.js';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp?: Date;
}

export class WebSocketService {
  private io: SocketIOServer;
  private storageService: StorageService;
  private connectedClients: Set<string> = new Set();

  constructor(server: HttpServer, storageService: StorageService) {
    this.storageService = storageService;

    this.io = new SocketIOServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      const clientId = socket.id;
      this.connectedClients.add(clientId);

      console.log(`WebSocket client connected: ${clientId}`);

      // Send welcome message with current status
      socket.emit('connection', {
        type: 'welcome',
        data: {
          clientId,
          serverTime: new Date(),
          connectedClients: this.connectedClients.size
        }
      });

      // Send recent logs to new client
      this.sendRecentLogs(socket);

      // Handle client requests
      socket.on('request_logs', (params) => {
        this.handleLogRequest(socket, params);
      });

      socket.on('request_metrics', () => {
        this.handleMetricsRequest(socket);
      });

      socket.on('subscribe', (params) => {
        this.handleSubscription(socket, params);
      });

      socket.on('disconnect', (reason) => {
        this.connectedClients.delete(clientId);
        console.log(`WebSocket client disconnected: ${clientId} (${reason})`);

        // Broadcast updated connection count
        this.broadcast({
          type: 'client_disconnected',
          data: {
            clientId,
            connectedClients: this.connectedClients.size,
            reason
          }
        });
      });

      socket.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);

        this.storageService.logEvent({
          type: 'websocket_error',
          timestamp: new Date(),
          data: {
            clientId,
            error: error.message,
            stack: error.stack
          }
        });
      });

      // Broadcast new connection to other clients
      socket.broadcast.emit('client_connected', {
        type: 'client_connected',
        data: {
          clientId,
          connectedClients: this.connectedClients.size
        }
      });
    });

    // Setup periodic heartbeat
    setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // Every 30 seconds
  }

  private async sendRecentLogs(socket: any): Promise<void> {
    try {
      const recentLogs = await this.storageService.getLogs({ limit: 50 });

      socket.emit('logs_batch', {
        type: 'logs_batch',
        data: {
          logs: recentLogs,
          count: recentLogs.length
        }
      });
    } catch (error: unknown) {
      console.error('Failed to send recent logs:', error);
    }
  }

  private async handleLogRequest(socket: any, params: any): Promise<void> {
    try {
      const { limit = 100, offset = 0, type, level } = params;

      const logs = await this.storageService.getLogs({
        limit,
        offset,
        type,
        level
      });

      socket.emit('logs_response', {
        type: 'logs_response',
        data: {
          logs,
          params,
          count: logs.length
        }
      });
    } catch (error: unknown) {
      console.error('Failed to handle log request:', error);

      socket.emit('error', {
        type: 'log_request_error',
        data: {
          error: error instanceof Error ? error.message : String(error),
          params
        }
      });
    }
  }

  private handleMetricsRequest(socket: any): void {
    try {
      // This would integrate with MetricsService
      const metrics = {
        connectedClients: this.connectedClients.size,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date()
      };

      socket.emit('metrics_response', {
        type: 'metrics_response',
        data: metrics
      });
    } catch (error: unknown) {
      console.error('Failed to handle metrics request:', error);

      socket.emit('error', {
        type: 'metrics_request_error',
        data: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  private handleSubscription(socket: any, params: any): void {
    const { type, filters } = params;

    // Join room based on subscription type
    const roomName = `subscription_${type}`;
    socket.join(roomName);

    console.log(`Client ${socket.id} subscribed to ${type}`);

    socket.emit('subscription_confirmed', {
      type: 'subscription_confirmed',
      data: {
        subscriptionType: type,
        filters,
        roomName
      }
    });
  }

  private sendHeartbeat(): void {
    this.broadcast({
      type: 'heartbeat',
      data: {
        timestamp: new Date(),
        connectedClients: this.connectedClients.size,
        uptime: process.uptime()
      }
    });
  }

  // Public methods
  public broadcast(message: WebSocketMessage): void {
    const messageWithTimestamp = {
      ...message,
      timestamp: message.timestamp || new Date()
    };

    this.io.emit('message', messageWithTimestamp);

    // Log the broadcast for debugging
    this.storageService.logEvent({
      type: 'websocket_broadcast',
      timestamp: new Date(),
      data: {
        messageType: message.type,
        clientCount: this.connectedClients.size,
        messageSize: JSON.stringify(message).length
      }
    });
  }

  public broadcastToRoom(room: string, message: WebSocketMessage): void {
    const messageWithTimestamp = {
      ...message,
      timestamp: message.timestamp || new Date()
    };

    this.io.to(room).emit('message', messageWithTimestamp);
  }

  public sendToClient(clientId: string, message: WebSocketMessage): void {
    const messageWithTimestamp = {
      ...message,
      timestamp: message.timestamp || new Date()
    };

    this.io.to(clientId).emit('message', messageWithTimestamp);
  }

  public broadcastLog(logEntry: any): void {
    this.broadcast({
      type: 'log',
      data: logEntry
    });
  }

  public broadcastTestUpdate(testUpdate: any): void {
    this.broadcast({
      type: 'test_update',
      data: testUpdate
    });
  }

  public broadcastMetrics(metrics: any): void {
    this.broadcast({
      type: 'metrics',
      data: metrics
    });
  }

  public broadcastAlert(alert: any): void {
    this.broadcast({
      type: 'alert',
      data: alert
    });

    // Also send to alert-specific room
    this.broadcastToRoom('subscription_alerts', {
      type: 'alert',
      data: alert
    });
  }

  public getConnectedClientCount(): number {
    return this.connectedClients.size;
  }

  public getConnectedClients(): string[] {
    return Array.from(this.connectedClients);
  }

  public isClientConnected(clientId: string): boolean {
    return this.connectedClients.has(clientId);
  }

  public disconnect(clientId: string): void {
    const socket = this.io.sockets.sockets.get(clientId);
    if (socket) {
      socket.disconnect(true);
    }
  }

  public async close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        console.log('WebSocket server closed');
        resolve();
      });
    });
  }

  // Event streaming for Server-Sent Events (SSE) alternative
  public createEventStream(): (req: any, res: any) => void {
    return (req, res) => {
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial connection event
      res.write(`data: ${JSON.stringify({
        type: 'connected',
        timestamp: new Date(),
        clientId: req.connection.remoteAddress
      })}\n\n`);

      // Setup log streaming
      const cleanup = this.storageService.onNewLog((log) => {
        try {
          res.write(`data: ${JSON.stringify({
            type: 'log',
            data: log,
            timestamp: new Date()
          })}\n\n`);
        } catch (error) {
          console.error('SSE write error:', error);
        }
      });

      // Cleanup on client disconnect
      req.on('close', () => {
        cleanup();
        console.log('SSE client disconnected');
      });

      req.on('error', (error) => {
        console.error('SSE error:', error);
        cleanup();
      });

      // Keep connection alive
      const keepAlive = setInterval(() => {
        try {
          res.write(`data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date()
          })}\n\n`);
        } catch (error) {
          clearInterval(keepAlive);
          cleanup();
        }
      }, 30000);

      req.on('close', () => clearInterval(keepAlive));
    };
  }
}