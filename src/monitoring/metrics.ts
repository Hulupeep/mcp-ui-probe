import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { StorageService } from './storage.js';

export interface MetricsSummary {
  testsTotal: number;
  testsSucceeded: number;
  testsFailed: number;
  testsRunning: number;
  successRate: number;
  averageDuration: number;
  httpRequestsTotal: number;
  httpRequestDuration: number;
  memoryUsage: number;
  uptime: number;
  lastUpdated: Date;
}

export class MetricsService {
  private storageService: StorageService;

  // Prometheus metrics
  private testsTotal!: Counter<string>;
  private testDuration!: Histogram<string>;
  private testsRunning!: Gauge<string>;
  private httpRequestsTotal!: Counter<string>;
  private httpRequestDuration!: Histogram<string>;
  private testStepsTotal!: Counter<string>;
  private testStepDuration!: Histogram<string>;
  private memoryUsage!: Gauge<string>;
  private activeConnections!: Gauge<string>;
  private errorRate!: Counter<string>;
  private alertsTotal!: Counter<string>;

  // Internal metrics tracking
  private metrics: {
    tests: Map<string, any>;
    http: {
      requestCount: number;
      totalDuration: number;
      errorCount: number;
    };
    system: {
      startTime: Date;
      peakMemory: number;
    };
  };

  constructor(storageService: StorageService) {
    this.storageService = storageService;

    // Initialize internal metrics
    this.metrics = {
      tests: new Map(),
      http: {
        requestCount: 0,
        totalDuration: 0,
        errorCount: 0
      },
      system: {
        startTime: new Date(),
        peakMemory: 0
      }
    };

    this.initializePrometheusMetrics();
    this.setupDefaultMetrics();
    this.startPeriodicCollection();
  }

  private initializePrometheusMetrics(): void {
    // Test metrics
    this.testsTotal = new Counter({
      name: 'mcp_tests_total',
      help: 'Total number of tests executed',
      labelNames: ['test_type', 'status']
    });

    this.testDuration = new Histogram({
      name: 'mcp_test_duration_seconds',
      help: 'Test execution duration in seconds',
      labelNames: ['test_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
    });

    this.testsRunning = new Gauge({
      name: 'mcp_tests_running',
      help: 'Number of currently running tests',
      labelNames: ['test_type']
    });

    // HTTP metrics
    this.httpRequestsTotal = new Counter({
      name: 'mcp_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status_code']
    });

    this.httpRequestDuration = new Histogram({
      name: 'mcp_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    });

    // Test step metrics
    this.testStepsTotal = new Counter({
      name: 'mcp_test_steps_total',
      help: 'Total number of test steps executed',
      labelNames: ['step_type', 'status']
    });

    this.testStepDuration = new Histogram({
      name: 'mcp_test_step_duration_seconds',
      help: 'Test step execution duration in seconds',
      labelNames: ['step_type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
    });

    // System metrics
    this.memoryUsage = new Gauge({
      name: 'mcp_memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type']
    });

    this.activeConnections = new Gauge({
      name: 'mcp_active_connections',
      help: 'Number of active WebSocket connections'
    });

    this.errorRate = new Counter({
      name: 'mcp_errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'component']
    });

    this.alertsTotal = new Counter({
      name: 'mcp_alerts_total',
      help: 'Total number of alerts generated',
      labelNames: ['severity', 'type']
    });
  }

  private setupDefaultMetrics(): void {
    // Collect default Node.js metrics
    collectDefaultMetrics({
      register,
      prefix: 'mcp_nodejs_'
    });
  }

  private startPeriodicCollection(): void {
    // Update system metrics every 10 seconds
    setInterval(() => {
      this.updateSystemMetrics();
    }, 10000);

    // Calculate and store summary metrics every minute
    setInterval(() => {
      this.calculateSummaryMetrics();
    }, 60000);
  }

  private updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();

    this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
    this.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
    this.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
    this.memoryUsage.set({ type: 'external' }, memUsage.external);

    // Track peak memory
    if (memUsage.heapUsed > this.metrics.system.peakMemory) {
      this.metrics.system.peakMemory = memUsage.heapUsed;
    }
  }

  private calculateSummaryMetrics(): void {
    try {
      const summary = this.getSummary();

      // Store summary in storage for historical tracking
      this.storageService.logEvent({
        type: 'metrics_summary',
        timestamp: new Date(),
        data: summary
      });

      // Check for alerts based on metrics
      this.checkMetricAlerts(summary);
    } catch (error) {
      console.error('Failed to calculate summary metrics:', error);
      this.errorRate.inc({ type: 'metrics_calculation', component: 'summary' });
    }
  }

  private checkMetricAlerts(summary: MetricsSummary): void {
    // Success rate alert
    if (summary.successRate < 0.8 && summary.testsTotal > 10) {
      this.generateAlert('warning', 'low_success_rate', {
        successRate: summary.successRate,
        testsTotal: summary.testsTotal
      });
    }

    // High memory usage alert
    const memUsage = process.memoryUsage();
    const memUsagePercent = memUsage.heapUsed / memUsage.heapTotal;
    if (memUsagePercent > 0.9) {
      this.generateAlert('critical', 'high_memory_usage', {
        usagePercent: memUsagePercent,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal
      });
    }

    // Long-running tests alert
    if (summary.averageDuration > 30000) { // 30 seconds
      this.generateAlert('warning', 'slow_tests', {
        averageDuration: summary.averageDuration
      });
    }
  }

  private generateAlert(severity: string, type: string, data: any): void {
    this.alertsTotal.inc({ severity, type });

    this.storageService.logEvent({
      type: 'alert',
      timestamp: new Date(),
      data: {
        severity,
        alertType: type,
        ...data
      }
    });
  }

  // Public methods for recording metrics
  public recordTestStart(testId: string, testType: string): void {
    this.metrics.tests.set(testId, {
      id: testId,
      type: testType,
      startTime: Date.now(),
      steps: []
    });

    this.testsRunning.inc({ test_type: testType });
  }

  public recordTestStep(testId: string, stepType: string, status: string, duration?: number): void {
    const test = this.metrics.tests.get(testId);
    if (test) {
      test.steps.push({
        type: stepType,
        status,
        timestamp: Date.now(),
        duration
      });
    }

    this.testStepsTotal.inc({ step_type: stepType, status });

    if (duration) {
      this.testStepDuration.observe({ step_type: stepType }, duration / 1000);
    }
  }

  public recordTestComplete(testId: string, status: string, duration: number): void {
    const test = this.metrics.tests.get(testId);
    if (test) {
      test.endTime = Date.now();
      test.status = status;
      test.duration = duration;

      this.testsRunning.dec({ test_type: test.type });
      this.testsTotal.inc({ test_type: test.type, status });
      this.testDuration.observe({ test_type: test.type }, duration / 1000);
    }
  }

  public recordHttpRequest(method: string, path: string, statusCode: number, duration: number): void {
    this.httpRequestsTotal.inc({
      method,
      path: this.sanitizePath(path),
      status_code: statusCode.toString()
    });

    this.httpRequestDuration.observe({
      method,
      path: this.sanitizePath(path)
    }, duration / 1000);

    this.metrics.http.requestCount++;
    this.metrics.http.totalDuration += duration;

    if (statusCode >= 400) {
      this.metrics.http.errorCount++;
      this.errorRate.inc({ type: 'http_error', component: 'api' });
    }
  }

  public recordError(type: string, component: string): void {
    this.errorRate.inc({ type, component });
  }

  public updateActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  private sanitizePath(path: string): string {
    // Replace dynamic segments with placeholders
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-f0-9]{24}/g, '/:objectid');
  }

  // Public methods for retrieving metrics
  public getMetrics(): any {
    return {
      tests: {
        total: this.testsTotal,
        running: Array.from(this.metrics.tests.values()).filter(t => !t.endTime).length,
        completed: Array.from(this.metrics.tests.values()).filter(t => t.endTime).length
      },
      http: this.metrics.http,
      system: {
        uptime: Date.now() - this.metrics.system.startTime.getTime(),
        memory: process.memoryUsage(),
        peakMemory: this.metrics.system.peakMemory
      },
      lastUpdated: new Date()
    };
  }

  public getSummary(): MetricsSummary {
    const completedTests = Array.from(this.metrics.tests.values()).filter(t => t.endTime);
    const runningTests = Array.from(this.metrics.tests.values()).filter(t => !t.endTime);

    const successfulTests = completedTests.filter(t => t.status === 'success').length;
    const failedTests = completedTests.filter(t => t.status === 'failed' || t.status === 'error').length;

    const totalDuration = completedTests.reduce((sum, test) => sum + (test.duration || 0), 0);
    const averageDuration = completedTests.length > 0 ? totalDuration / completedTests.length : 0;

    const successRate = completedTests.length > 0 ? successfulTests / completedTests.length : 0;

    const memUsage = process.memoryUsage();

    return {
      testsTotal: completedTests.length,
      testsSucceeded: successfulTests,
      testsFailed: failedTests,
      testsRunning: runningTests.length,
      successRate,
      averageDuration,
      httpRequestsTotal: this.metrics.http.requestCount,
      httpRequestDuration: this.metrics.http.requestCount > 0 ?
        this.metrics.http.totalDuration / this.metrics.http.requestCount : 0,
      memoryUsage: memUsage.heapUsed,
      uptime: Date.now() - this.metrics.system.startTime.getTime(),
      lastUpdated: new Date()
    };
  }

  public async getPrometheusMetrics(): Promise<string> {
    return await register.metrics();
  }

  public getTestMetrics(testId: string): any {
    return this.metrics.tests.get(testId);
  }

  public getAllTestMetrics(): any[] {
    return Array.from(this.metrics.tests.values());
  }

  public getHistoricalMetrics(timeRange: string = '24h'): any {
    // This would query historical data from storage
    const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 1;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return this.storageService.getLogs({
      type: 'metrics_summary',
      since
    });
  }

  public reset(): void {
    // Reset internal metrics (useful for testing)
    this.metrics.tests.clear();
    this.metrics.http = {
      requestCount: 0,
      totalDuration: 0,
      errorCount: 0
    };
    this.metrics.system.startTime = new Date();
    this.metrics.system.peakMemory = 0;

    // Reset Prometheus metrics
    register.clear();
    this.initializePrometheusMetrics();
    this.setupDefaultMetrics();
  }
}