import express from 'express';
import { createServer } from 'http';
import path from 'path';
import cors from 'cors';
import { WebSocketService } from './websocket.js';
import { MetricsService } from './metrics.js';
import { HealthService } from './health.js';
import { ExplainabilityService } from './explainability.js';
import { StorageService } from './storage.js';

export interface MonitoringConfig {
  port: number;
  host: string;
  mcpServerUrl?: string;
  enableMetrics: boolean;
  enableLogs: boolean;
  enableAlerts: boolean;
  retentionDays: number;
}

export class MonitoringServer {
  private app: express.Application;
  private server: any;
  private wsService: WebSocketService;
  private metricsService: MetricsService;
  private healthService: HealthService;
  private explainabilityService: ExplainabilityService;
  private storageService: StorageService;
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.app = express();
    this.server = createServer(this.app);

    // Initialize services
    this.storageService = new StorageService(config.retentionDays);
    this.wsService = new WebSocketService(this.server, this.storageService);
    this.metricsService = new MetricsService(this.storageService);
    this.healthService = new HealthService(config.mcpServerUrl);
    this.explainabilityService = new ExplainabilityService(this.storageService);

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Serve static files for dashboard
    this.app.use('/static', express.static(path.join(__dirname, 'public')));

    // Request logging middleware
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.metricsService.recordHttpRequest(req.method, req.path, res.statusCode, duration);

        this.storageService.logEvent({
          type: 'http_request',
          timestamp: new Date(),
          data: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            userAgent: req.get('User-Agent')
          }
        });
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Dashboard route
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'dashboard.html'));
    });

    // API Routes
    this.app.use('/api/health', this.createHealthRoutes());
    this.app.use('/api/metrics', this.createMetricsRoutes());
    this.app.use('/api/logs', this.createLogsRoutes());
    this.app.use('/api/explainability', this.createExplainabilityRoutes());
    this.app.use('/api/alerts', this.createAlertsRoutes());

    // Test execution monitoring
    this.app.post('/api/test-execution/start', (req, res) => {
      const { testId, testName, testType } = req.body;

      this.metricsService.recordTestStart(testId, testType);
      this.storageService.logEvent({
        type: 'test_start',
        timestamp: new Date(),
        data: { testId, testName, testType }
      });

      this.wsService.broadcast({
        type: 'test_start',
        data: { testId, testName, testType, timestamp: new Date() }
      });

      res.json({ success: true, testId });
    });

    this.app.post('/api/test-execution/step', (req, res) => {
      const { testId, stepName, stepType, status, data, reasoning } = req.body;

      this.metricsService.recordTestStep(testId, stepType, status);

      const event = {
        type: 'test_step',
        timestamp: new Date(),
        data: { testId, stepName, stepType, status, data, reasoning }
      };

      this.storageService.logEvent(event);
      this.wsService.broadcast({ type: 'test_step', data: event.data });

      // Store explainability data
      if (reasoning) {
        this.explainabilityService.recordDecision(testId, stepName, reasoning);
      }

      res.json({ success: true });
    });

    this.app.post('/api/test-execution/complete', (req, res) => {
      const { testId, status, duration, results, error } = req.body;

      this.metricsService.recordTestComplete(testId, status, duration);

      const event = {
        type: 'test_complete',
        timestamp: new Date(),
        data: { testId, status, duration, results, error }
      };

      this.storageService.logEvent(event);
      this.wsService.broadcast({ type: 'test_complete', data: event.data });

      res.json({ success: true });
    });

    // Error handling
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Monitoring server error:', error);

      this.storageService.logEvent({
        type: 'server_error',
        timestamp: new Date(),
        data: {
          error: error.message,
          stack: error.stack,
          path: req.path,
          method: req.method
        }
      });

      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    });
  }

  private createHealthRoutes(): express.Router {
    const router = express.Router();

    router.get('/', async (req, res) => {
      const health = await this.healthService.getOverallHealth();
      res.json(health);
    });

    router.get('/detailed', async (req, res) => {
      const detailed = await this.healthService.getDetailedHealth();
      res.json(detailed);
    });

    router.get('/mcp', async (req, res) => {
      const mcpHealth = await this.healthService.checkMcpServer();
      res.json(mcpHealth);
    });

    return router;
  }

  private createMetricsRoutes(): express.Router {
    const router = express.Router();

    router.get('/', (req, res) => {
      const metrics = this.metricsService.getMetrics();
      res.json(metrics);
    });

    router.get('/prometheus', (req, res) => {
      const prometheusMetrics = this.metricsService.getPrometheusMetrics();
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(prometheusMetrics);
    });

    router.get('/summary', (req, res) => {
      const summary = this.metricsService.getSummary();
      res.json(summary);
    });

    return router;
  }

  private createLogsRoutes(): express.Router {
    const router = express.Router();

    router.get('/', (req, res) => {
      const { limit = 100, offset = 0, type, level } = req.query;
      const logs = this.storageService.getLogs({
        limit: Number(limit),
        offset: Number(offset),
        type: type as string,
        level: level as string
      });
      res.json(logs);
    });

    router.get('/stream', (req, res) => {
      // SSE endpoint for log streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      const cleanup = this.storageService.onNewLog((log) => {
        res.write(`data: ${JSON.stringify(log)}\n\n`);
      });

      req.on('close', cleanup);
    });

    return router;
  }

  private createExplainabilityRoutes(): express.Router {
    const router = express.Router();

    router.get('/decisions/:testId', (req, res) => {
      const { testId } = req.params;
      const decisions = this.explainabilityService.getDecisions(testId);
      res.json(decisions);
    });

    router.get('/analysis/:testId', (req, res) => {
      const { testId } = req.params;
      const analysis = this.explainabilityService.analyzeTest(testId);
      res.json(analysis);
    });

    return router;
  }

  private createAlertsRoutes(): express.Router {
    const router = express.Router();

    router.get('/', (req, res) => {
      const alerts = this.storageService.getAlerts();
      res.json(alerts);
    });

    router.post('/acknowledge/:alertId', (req, res) => {
      const { alertId } = req.params;
      this.storageService.acknowledgeAlert(alertId);
      res.json({ success: true });
    });

    return router;
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(this.config.port, this.config.host, () => {
          console.log(`Monitoring server running on http://${this.config.host}:${this.config.port}`);
          console.log(`Dashboard available at http://${this.config.host}:${this.config.port}`);
          console.log(`Metrics endpoint: http://${this.config.host}:${this.config.port}/api/metrics/prometheus`);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('Monitoring server stopped');
        resolve();
      });
    });
  }

  public getMetricsService(): MetricsService {
    return this.metricsService;
  }

  public getStorageService(): StorageService {
    return this.storageService;
  }

  public getWebSocketService(): WebSocketService {
    return this.wsService;
  }
}

// Export factory function
export function createMonitoringServer(config: MonitoringConfig): MonitoringServer {
  return new MonitoringServer(config);
}