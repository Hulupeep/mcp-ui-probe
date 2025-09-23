import { promises as fs } from 'fs';
import path from 'path';

export interface LogEvent {
  id?: string;
  type: string;
  timestamp: Date;
  level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  data: any;
  testId?: string;
  sessionId?: string;
}

export interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  data?: any;
}

export interface LogQuery {
  limit?: number;
  offset?: number;
  type?: string;
  level?: string;
  testId?: string;
  since?: Date;
  until?: Date;
}

export class StorageService {
  private dataDir: string;
  private logsFile: string;
  private alertsFile: string;
  private metricsFile: string;
  private rotationSize: number = 100 * 1024 * 1024; // 100MB
  private retentionDays: number;
  private logBuffer: LogEvent[] = [];
  private bufferSize: number = 100;
  private flushInterval: NodeJS.Timeout | null = null;
  private logListeners: ((log: LogEvent) => void)[] = [];

  constructor(retentionDays: number = 30) {
    this.retentionDays = retentionDays;
    this.dataDir = path.join(process.cwd(), 'data', 'monitoring');
    this.logsFile = path.join(this.dataDir, 'logs.jsonl');
    this.alertsFile = path.join(this.dataDir, 'alerts.json');
    this.metricsFile = path.join(this.dataDir, 'metrics.jsonl');

    this.initialize();
    this.startBufferFlush();
    this.startRotationSchedule();
  }

  private async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });

      // Create files if they don't exist
      for (const file of [this.logsFile, this.alertsFile, this.metricsFile]) {
        try {
          await fs.access(file);
        } catch {
          if (file === this.alertsFile) {
            await fs.writeFile(file, JSON.stringify([]));
          } else {
            await fs.writeFile(file, '');
          }
        }
      }

      // Clean up old logs on startup
      await this.cleanupOldLogs();
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  }

  private startBufferFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 5000); // Flush every 5 seconds
  }

  private startRotationSchedule(): void {
    // Check for rotation every hour
    setInterval(() => {
      this.rotateLogsIfNeeded();
    }, 3600000);
  }

  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    try {
      const logsToWrite = [...this.logBuffer];
      this.logBuffer = [];

      const logLines = logsToWrite.map(log => {
        const logWithId = {
          ...log,
          id: log.id || this.generateId(),
          timestamp: typeof log.timestamp === 'string' ? new Date(log.timestamp) : log.timestamp
        };
        return JSON.stringify(logWithId);
      }).join('\n') + '\n';

      await fs.appendFile(this.logsFile, logLines);

      // Notify listeners
      logsToWrite.forEach(log => {
        this.logListeners.forEach(listener => {
          try {
            listener(log);
          } catch (error) {
            console.error('Error in log listener:', error);
          }
        });
      });

    } catch (error) {
      console.error('Failed to flush log buffer:', error);
      // Put logs back in buffer if write failed
      this.logBuffer.unshift(...this.logBuffer);
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async rotateLogsIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.logsFile);

      if (stats.size > this.rotationSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = path.join(this.dataDir, `logs_${timestamp}.jsonl`);

        // Move current log file
        await fs.rename(this.logsFile, rotatedFile);

        // Create new log file
        await fs.writeFile(this.logsFile, '');

        console.log(`Rotated logs to ${rotatedFile}`);

        // Compress rotated file
        await this.compressFile(rotatedFile);
      }
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  private async compressFile(filePath: string): Promise<void> {
    try {
      const { createGzip } = await import('zlib');
      const { createReadStream, createWriteStream } = await import('fs');

      const gzipPath = `${filePath}.gz`;
      const readStream = createReadStream(filePath);
      const writeStream = createWriteStream(gzipPath);
      const gzip = createGzip();

      await new Promise((resolve, reject) => {
        readStream
          .pipe(gzip)
          .pipe(writeStream)
          .on('finish', () => resolve(undefined))
          .on('error', reject);
      });

      // Remove original file after compression
      await fs.unlink(filePath);
      console.log(`Compressed ${filePath} to ${gzipPath}`);
    } catch (error) {
      console.error('Failed to compress file:', error);
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.dataDir);
      const cutoffDate = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);

      for (const file of files) {
        if (file.startsWith('logs_') && (file.endsWith('.jsonl') || file.endsWith('.gz'))) {
          const filePath = path.join(this.dataDir, file);
          const stats = await fs.stat(filePath);

          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            console.log(`Cleaned up old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  // Public methods
  public logEvent(event: LogEvent): void {
    const eventWithDefaults = {
      ...event,
      id: event.id || this.generateId(),
      level: event.level || 'INFO',
      timestamp: event.timestamp || new Date()
    };

    this.logBuffer.push(eventWithDefaults);

    // Flush immediately if buffer is full
    if (this.logBuffer.length >= this.bufferSize) {
      this.flushBuffer();
    }
  }

  public async getLogs(query: LogQuery = {}): Promise<LogEvent[]> {
    try {
      await this.flushBuffer(); // Ensure recent logs are written

      const content = await fs.readFile(this.logsFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());

      let logs = lines.map(line => {
        try {
          const log = JSON.parse(line);
          // Ensure timestamp is a Date object
          log.timestamp = new Date(log.timestamp);
          return log;
        } catch (error) {
          console.error('Failed to parse log line:', line, error);
          return null;
        }
      }).filter(log => log !== null);

      // Apply filters
      if (query.type) {
        logs = logs.filter(log => log.type === query.type);
      }

      if (query.level) {
        logs = logs.filter(log => log.level === query.level);
      }

      if (query.testId) {
        logs = logs.filter(log => log.testId === query.testId);
      }

      if (query.since) {
        logs = logs.filter(log => log.timestamp >= query.since!);
      }

      if (query.until) {
        logs = logs.filter(log => log.timestamp <= query.until!);
      }

      // Sort by timestamp (newest first)
      logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 100;

      return logs.slice(offset, offset + limit);
    } catch (error) {
      console.error('Failed to get logs:', error);
      return [];
    }
  }

  public async createAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>): Promise<Alert> {
    const newAlert: Alert = {
      ...alert,
      id: this.generateId(),
      timestamp: new Date(),
      acknowledged: false
    };

    try {
      const alerts = await this.getAlerts();
      alerts.push(newAlert);

      await fs.writeFile(this.alertsFile, JSON.stringify(alerts, null, 2));

      // Log the alert
      this.logEvent({
        type: 'alert_created',
        level: alert.severity === 'critical' ? 'ERROR' : 'WARN',
        timestamp: new Date(),
        data: newAlert
      });

      return newAlert;
    } catch (error) {
      console.error('Failed to create alert:', error);
      throw error;
    }
  }

  public async getAlerts(): Promise<Alert[]> {
    try {
      const content = await fs.readFile(this.alertsFile, 'utf8');
      const alerts = JSON.parse(content);

      // Ensure timestamps are Date objects
      return alerts.map((alert: any) => ({
        ...alert,
        timestamp: new Date(alert.timestamp),
        acknowledgedAt: alert.acknowledgedAt ? new Date(alert.acknowledgedAt) : undefined
      }));
    } catch (error) {
      console.error('Failed to get alerts:', error);
      return [];
    }
  }

  public async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      const alerts = await this.getAlerts();
      const alert = alerts.find(a => a.id === alertId);

      if (alert) {
        alert.acknowledged = true;
        alert.acknowledgedAt = new Date();

        await fs.writeFile(this.alertsFile, JSON.stringify(alerts, null, 2));

        this.logEvent({
          type: 'alert_acknowledged',
          level: 'INFO',
          timestamp: new Date(),
          data: { alertId, acknowledgedAt: alert.acknowledgedAt }
        });
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }

  public onNewLog(callback: (log: LogEvent) => void): () => void {
    this.logListeners.push(callback);

    // Return cleanup function
    return () => {
      const index = this.logListeners.indexOf(callback);
      if (index > -1) {
        this.logListeners.splice(index, 1);
      }
    };
  }

  public async getLogStats(): Promise<any> {
    try {
      const logs = await this.getLogs({ limit: 10000 }); // Get recent logs for stats

      const stats = {
        total: logs.length,
        byType: {} as { [key: string]: number },
        byLevel: {} as { [key: string]: number },
        errorRate: 0,
        timeRange: {
          earliest: null as Date | null,
          latest: null as Date | null
        }
      };

      logs.forEach(log => {
        // Count by type
        stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;

        // Count by level
        if (log.level) {
          stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
        }

        // Track time range
        if (!stats.timeRange.earliest || log.timestamp < stats.timeRange.earliest) {
          stats.timeRange.earliest = log.timestamp;
        }
        if (!stats.timeRange.latest || log.timestamp > stats.timeRange.latest) {
          stats.timeRange.latest = log.timestamp;
        }
      });

      // Calculate error rate
      const errorLogs = (stats.byLevel['ERROR'] || 0) + (stats.byLevel['WARN'] || 0);
      stats.errorRate = logs.length > 0 ? errorLogs / logs.length : 0;

      return stats;
    } catch (error) {
      console.error('Failed to get log stats:', error);
      return null;
    }
  }

  public async exportLogs(format: 'json' | 'csv' = 'json'): Promise<string> {
    const logs = await this.getLogs({ limit: 50000 }); // Export recent logs

    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'type', 'testId', 'data'];
      const csvLines = [headers.join(',')];

      logs.forEach(log => {
        const row = [
          log.timestamp.toISOString(),
          log.level,
          log.type,
          log.testId || '',
          JSON.stringify(log.data).replace(/"/g, '""')
        ];
        csvLines.push(row.map(field => `"${field}"`).join(','));
      });

      return csvLines.join('\n');
    }

    return JSON.stringify(logs, null, 2);
  }

  public async cleanup(): Promise<void> {
    // Flush any remaining logs
    await this.flushBuffer();

    // Clear intervals
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Clear listeners
    this.logListeners = [];
  }

  // Storage health check
  public async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      // Test write
      const testFile = path.join(this.dataDir, '.health-test');
      await fs.writeFile(testFile, 'test');

      // Test read
      const content = await fs.readFile(testFile, 'utf8');

      // Cleanup
      await fs.unlink(testFile);

      // Get storage stats
      const logsStats = await fs.stat(this.logsFile).catch(() => null);
      const alertsStats = await fs.stat(this.alertsFile).catch(() => null);

      return {
        healthy: content === 'test',
        details: {
          dataDir: this.dataDir,
          logsSize: logsStats?.size || 0,
          alertsSize: alertsStats?.size || 0,
          bufferSize: this.logBuffer.length,
          retentionDays: this.retentionDays
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : String(error),
          dataDir: this.dataDir
        }
      };
    }
  }
}