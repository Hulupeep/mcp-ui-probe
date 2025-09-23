import fetch from 'node-fetch';

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
  details?: any;
  lastChecked: Date;
}

export interface OverallHealth {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  uptime: number;
  version?: string;
  timestamp: Date;
}

export class HealthService {
  private mcpServerUrl?: string;
  private checks: Map<string, HealthCheck> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(mcpServerUrl?: string) {
    this.mcpServerUrl = mcpServerUrl;
    this.startPeriodicChecks();
  }

  private startPeriodicChecks(): void {
    // Run health checks every 30 seconds
    this.checkInterval = setInterval(() => {
      this.runAllChecks();
    }, 30000);

    // Run initial checks
    this.runAllChecks();
  }

  private async runAllChecks(): Promise<void> {
    try {
      await Promise.allSettled([
        this.checkSystemHealth(),
        this.checkMemoryHealth(),
        this.checkDiskSpace(),
        this.checkMcpServer(),
        this.checkDatabaseConnectivity(),
        this.checkExternalDependencies()
      ]);
    } catch (error) {
      console.error('Error running health checks:', error);
    }
  }

  private async checkSystemHealth(): Promise<void> {
    const startTime = Date.now();

    try {
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      const cpuUsage = process.cpuUsage();

      // Check if system is under stress
      const memoryUsagePercent = memUsage.heapUsed / memUsage.heapTotal;
      const isMemoryHealthy = memoryUsagePercent < 0.9;
      const isUptimeHealthy = uptime > 0; // Basic uptime check

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let details: any = {
        memory: {
          usage: memUsage,
          usagePercent: memoryUsagePercent
        },
        uptime,
        cpu: cpuUsage
      };

      if (!isMemoryHealthy) {
        status = memoryUsagePercent > 0.95 ? 'unhealthy' : 'degraded';
        details.issues = ['High memory usage'];
      }

      this.updateCheck('system', {
        name: 'System Health',
        status,
        responseTime: Date.now() - startTime,
        details,
        lastChecked: new Date()
      });

    } catch (error: unknown) {
      this.updateCheck('system', {
        name: 'System Health',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
        lastChecked: new Date()
      });
    }
  }

  private async checkMemoryHealth(): Promise<void> {
    const startTime = Date.now();

    try {
      const memUsage = process.memoryUsage();
      const totalMemory = memUsage.heapTotal;
      const usedMemory = memUsage.heapUsed;
      const freeMemory = totalMemory - usedMemory;

      const usagePercent = usedMemory / totalMemory;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let issues: string[] = [];

      if (usagePercent > 0.95) {
        status = 'unhealthy';
        issues.push('Critical memory usage');
      } else if (usagePercent > 0.85) {
        status = 'degraded';
        issues.push('High memory usage');
      }

      this.updateCheck('memory', {
        name: 'Memory Health',
        status,
        responseTime: Date.now() - startTime,
        details: {
          total: totalMemory,
          used: usedMemory,
          free: freeMemory,
          usagePercent,
          issues: issues.length > 0 ? issues : undefined
        },
        lastChecked: new Date()
      });

    } catch (error: unknown) {
      this.updateCheck('memory', {
        name: 'Memory Health',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
        lastChecked: new Date()
      });
    }
  }

  private async checkDiskSpace(): Promise<void> {
    const startTime = Date.now();

    try {
      const fs = await import('fs');
      const path = await import('path');

      // Check disk space for the current working directory
      const stats = await fs.promises.statfs?.(process.cwd()) || null;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let details: any = {
        path: process.cwd()
      };

      if (stats) {
        const totalSpace = stats.blocks * stats.bavail;
        const freeSpace = stats.bavail * stats.bsize;
        const usedSpace = totalSpace - freeSpace;
        const usagePercent = totalSpace > 0 ? usedSpace / totalSpace : 0;

        details = {
          ...details,
          totalSpace,
          freeSpace,
          usedSpace,
          usagePercent
        };

        if (usagePercent > 0.95) {
          status = 'unhealthy';
          details.issues = ['Critical disk space'];
        } else if (usagePercent > 0.85) {
          status = 'degraded';
          details.issues = ['Low disk space'];
        }
      } else {
        // Fallback for platforms that don't support statfs
        details.note = 'Disk space monitoring not available on this platform';
      }

      this.updateCheck('disk', {
        name: 'Disk Space',
        status,
        responseTime: Date.now() - startTime,
        details,
        lastChecked: new Date()
      });

    } catch (error: unknown) {
      this.updateCheck('disk', {
        name: 'Disk Space',
        status: 'degraded',
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
        lastChecked: new Date()
      });
    }
  }

  public async checkMcpServer(): Promise<HealthCheck> {
    const startTime = Date.now();

    if (!this.mcpServerUrl) {
      const check: HealthCheck = {
        name: 'MCP Server',
        status: 'degraded',
        error: 'MCP server URL not configured',
        responseTime: Date.now() - startTime,
        lastChecked: new Date()
      };

      this.updateCheck('mcp', check);
      return check;
    }

    try {
      const healthUrl = `${this.mcpServerUrl}/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let details: any = {
        url: healthUrl,
        statusCode: response.status,
        responseTime
      };

      if (!response.ok) {
        status = response.status >= 500 ? 'unhealthy' : 'degraded';
        details.error = `HTTP ${response.status}`;
      } else {
        try {
          const data = await response.json();
          details.serverData = data;
        } catch (e) {
          // Response might not be JSON, that's okay
        }
      }

      const check: HealthCheck = {
        name: 'MCP Server',
        status,
        responseTime,
        details,
        lastChecked: new Date()
      };

      this.updateCheck('mcp', check);
      return check;

    } catch (error: unknown) {
      const check: HealthCheck = {
        name: 'MCP Server',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
        details: {
          url: this.mcpServerUrl
        },
        lastChecked: new Date()
      };

      this.updateCheck('mcp', check);
      return check;
    }
  }

  private async checkDatabaseConnectivity(): Promise<void> {
    const startTime = Date.now();

    try {
      // For now, we're using file-based storage, so check if we can write to the data directory
      const fs = await import('fs');
      const path = await import('path');

      const dataDir = path.join(process.cwd(), 'data');
      const testFile = path.join(dataDir, '.health-check');

      // Ensure data directory exists
      await fs.promises.mkdir(dataDir, { recursive: true });

      // Test write
      await fs.promises.writeFile(testFile, JSON.stringify({ timestamp: new Date() }));

      // Test read
      const content = await fs.promises.readFile(testFile, 'utf8');
      const data = JSON.parse(content);

      // Clean up
      await fs.promises.unlink(testFile);

      this.updateCheck('database', {
        name: 'Database Connectivity',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          type: 'file-based',
          dataDir,
          testSuccessful: true
        },
        lastChecked: new Date()
      });

    } catch (error: unknown) {
      this.updateCheck('database', {
        name: 'Database Connectivity',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
        lastChecked: new Date()
      });
    }
  }

  private async checkExternalDependencies(): Promise<void> {
    const startTime = Date.now();

    try {
      // Check if external services are reachable (if any)
      // For now, this is a placeholder that checks basic Node.js functionality

      const dependencies = {
        nodejs: {
          version: process.version,
          platform: process.platform,
          arch: process.arch
        },
        npm: {
          // Could check npm connectivity if needed
          available: true
        }
      };

      this.updateCheck('dependencies', {
        name: 'External Dependencies',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: dependencies,
        lastChecked: new Date()
      });

    } catch (error: unknown) {
      this.updateCheck('dependencies', {
        name: 'External Dependencies',
        status: 'degraded',
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
        lastChecked: new Date()
      });
    }
  }

  private updateCheck(key: string, check: HealthCheck): void {
    this.checks.set(key, check);
  }

  public async getOverallHealth(): Promise<OverallHealth> {
    // Ensure we have recent checks
    if (this.checks.size === 0) {
      await this.runAllChecks();
    }

    const checks = Array.from(this.checks.values());
    const healthyChecks = checks.filter(c => c.status === 'healthy').length;
    const degradedChecks = checks.filter(c => c.status === 'degraded').length;
    const unhealthyChecks = checks.filter(c => c.status === 'unhealthy').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (unhealthyChecks > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedChecks > 0) {
      overallStatus = 'degraded';
    }

    return {
      healthy: overallStatus === 'healthy',
      status: overallStatus,
      checks,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date()
    };
  }

  public async getDetailedHealth(): Promise<any> {
    const overall = await this.getOverallHealth();

    return {
      ...overall,
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        workingDirectory: process.cwd(),
        timestamp: new Date()
      },
      statistics: {
        totalChecks: this.checks.size,
        healthyChecks: overall.checks.filter(c => c.status === 'healthy').length,
        degradedChecks: overall.checks.filter(c => c.status === 'degraded').length,
        unhealthyChecks: overall.checks.filter(c => c.status === 'unhealthy').length,
        averageResponseTime: overall.checks.reduce((sum, c) => sum + (c.responseTime || 0), 0) / overall.checks.length
      }
    };
  }

  public getCheck(name: string): HealthCheck | undefined {
    return this.checks.get(name);
  }

  public getAllChecks(): HealthCheck[] {
    return Array.from(this.checks.values());
  }

  public async runCheck(name: string): Promise<HealthCheck> {
    switch (name) {
      case 'mcp':
        return await this.checkMcpServer();
      case 'system':
        await this.checkSystemHealth();
        break;
      case 'memory':
        await this.checkMemoryHealth();
        break;
      case 'disk':
        await this.checkDiskSpace();
        break;
      case 'database':
        await this.checkDatabaseConnectivity();
        break;
      case 'dependencies':
        await this.checkExternalDependencies();
        break;
      default:
        throw new Error(`Unknown health check: ${name}`);
    }

    return this.checks.get(name)!;
  }

  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}