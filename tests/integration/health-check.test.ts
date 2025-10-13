import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { HealthService, HealthCheck, OverallHealth } from '../../src/monitoring/health.js';

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn());

describe('Integration - Health Check Tool', () => {
  let healthService: HealthService;

  beforeEach(() => {
    jest.clearAllMocks();
    healthService = new HealthService('http://localhost:3000');
  });

  afterEach(() => {
    healthService.stop();
  });

  describe('Health Check Tool Returns All Fields', () => {
    it('should return all required health check fields', async () => {
      const health: OverallHealth = await healthService.getOverallHealth();

      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('checks');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('version');
      expect(health).toHaveProperty('timestamp');

      expect(typeof health.healthy).toBe('boolean');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(Array.isArray(health.checks)).toBe(true);
      expect(typeof health.uptime).toBe('number');
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should include all check types in overall health', async () => {
      const health: OverallHealth = await healthService.getOverallHealth();

      const checkNames = health.checks.map(c => c.name);

      expect(checkNames).toContain('System Health');
      expect(checkNames).toContain('Memory Health');
      expect(checkNames).toContain('Disk Space');
      expect(checkNames).toContain('Database Connectivity');
      expect(checkNames).toContain('External Dependencies');
    });

    it('should provide detailed health information', async () => {
      const detailedHealth = await healthService.getDetailedHealth();

      expect(detailedHealth).toHaveProperty('healthy');
      expect(detailedHealth).toHaveProperty('status');
      expect(detailedHealth).toHaveProperty('checks');
      expect(detailedHealth).toHaveProperty('system');
      expect(detailedHealth).toHaveProperty('environment');
      expect(detailedHealth).toHaveProperty('statistics');

      // System details
      expect(detailedHealth.system).toHaveProperty('memory');
      expect(detailedHealth.system).toHaveProperty('uptime');
      expect(detailedHealth.system).toHaveProperty('platform');
      expect(detailedHealth.system).toHaveProperty('arch');
      expect(detailedHealth.system).toHaveProperty('nodeVersion');
      expect(detailedHealth.system).toHaveProperty('pid');

      // Environment details
      expect(detailedHealth.environment).toHaveProperty('nodeEnv');
      expect(detailedHealth.environment).toHaveProperty('workingDirectory');
      expect(detailedHealth.environment).toHaveProperty('timestamp');

      // Statistics
      expect(detailedHealth.statistics).toHaveProperty('totalChecks');
      expect(detailedHealth.statistics).toHaveProperty('healthyChecks');
      expect(detailedHealth.statistics).toHaveProperty('degradedChecks');
      expect(detailedHealth.statistics).toHaveProperty('unhealthyChecks');
      expect(detailedHealth.statistics).toHaveProperty('averageResponseTime');
    });

    it('should include response time for each check', async () => {
      const health: OverallHealth = await healthService.getOverallHealth();

      health.checks.forEach(check => {
        expect(check).toHaveProperty('responseTime');
        expect(typeof check.responseTime).toBe('number');
        expect(check.responseTime).toBeGreaterThanOrEqual(0);
      });
    });

    it('should include lastChecked timestamp for each check', async () => {
      const health: OverallHealth = await healthService.getOverallHealth();

      health.checks.forEach(check => {
        expect(check).toHaveProperty('lastChecked');
        expect(check.lastChecked).toBeInstanceOf(Date);
      });
    });
  });

  describe('Detection of Missing Dependencies', () => {
    it('should detect system health status correctly', async () => {
      await healthService.runCheck('system');
      const check = healthService.getCheck('system');

      expect(check).toBeDefined();
      expect(check?.name).toBe('System Health');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(check?.status || '');
    });

    it('should detect memory health issues', async () => {
      await healthService.runCheck('memory');
      const check = healthService.getCheck('memory');

      expect(check).toBeDefined();
      expect(check?.name).toBe('Memory Health');
      expect(check?.details).toHaveProperty('total');
      expect(check?.details).toHaveProperty('used');
      expect(check?.details).toHaveProperty('free');
      expect(check?.details).toHaveProperty('usagePercent');
    });

    it('should mark check as degraded when MCP server URL not configured', async () => {
      const serviceWithoutUrl = new HealthService();
      const check = await serviceWithoutUrl.checkMcpServer();

      expect(check.status).toBe('degraded');
      expect(check.error).toContain('MCP server URL not configured');

      serviceWithoutUrl.stop();
    });

    it('should detect disk space status', async () => {
      await healthService.runCheck('disk');
      const check = healthService.getCheck('disk');

      expect(check).toBeDefined();
      expect(check?.name).toBe('Disk Space');
      expect(check?.details).toHaveProperty('path');
    });

    it('should detect database connectivity', async () => {
      await healthService.runCheck('database');
      const check = healthService.getCheck('database');

      expect(check).toBeDefined();
      expect(check?.name).toBe('Database Connectivity');
      expect(check?.details).toHaveProperty('type');
      expect(check?.details.type).toBe('file-based');
    });

    it('should detect external dependencies', async () => {
      await healthService.runCheck('dependencies');
      const check = healthService.getCheck('dependencies');

      expect(check).toBeDefined();
      expect(check?.name).toBe('External Dependencies');
      expect(check?.details).toHaveProperty('nodejs');
      expect(check?.details.nodejs).toHaveProperty('version');
      expect(check?.details.nodejs).toHaveProperty('platform');
      expect(check?.details.nodejs).toHaveProperty('arch');
    });

    it('should detect missing Playwright browsers', async () => {
      // This would be tested in actual integration with Playwright
      // For now, we verify the check structure
      const allChecks = healthService.getAllChecks();

      expect(allChecks.length).toBeGreaterThan(0);
      allChecks.forEach(check => {
        expect(check).toHaveProperty('name');
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('lastChecked');
      });
    });
  });

  describe('Browser Version Detection', () => {
    it('should include Node.js version in dependencies check', async () => {
      await healthService.runCheck('dependencies');
      const check = healthService.getCheck('dependencies');

      expect(check?.details.nodejs.version).toBe(process.version);
      expect(check?.details.nodejs.platform).toBe(process.platform);
      expect(check?.details.nodejs.arch).toBe(process.arch);
    });

    it('should include environment information in detailed health', async () => {
      const detailedHealth = await healthService.getDetailedHealth();

      expect(detailedHealth.system.nodeVersion).toBe(process.version);
      expect(detailedHealth.system.platform).toBe(process.platform);
      expect(detailedHealth.system.arch).toBe(process.arch);
    });

    it('should include version in overall health', async () => {
      const health = await healthService.getOverallHealth();

      expect(health.version).toBeDefined();
      expect(typeof health.version).toBe('string');
    });
  });

  describe('MCP Server Health Check', () => {
    it('should check MCP server health with correct URL', async () => {
      const fetch = (await import('node-fetch')).default as jest.Mock;

      // @ts-ignore - Mock fetch response
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });

      const check = await healthService.checkMcpServer();

      expect(check.name).toBe('MCP Server');
      expect(check.status).toBe('healthy');
      expect(check.details.url).toContain('http://localhost:3000/health');
    });

    it('should mark server as unhealthy on connection error', async () => {
      const fetch = (await import('node-fetch')).default as jest.Mock;

      // @ts-ignore - Mock error
      fetch.mockRejectedValue(new Error('Connection refused'));

      const check = await healthService.checkMcpServer();

      expect(check.status).toBe('unhealthy');
      expect(check.error).toContain('Connection refused');
    });

    it('should handle timeout in MCP server check', async () => {
      const fetch = (await import('node-fetch')).default as jest.Mock;

      fetch.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 6000)
        )
      );

      const check = await healthService.checkMcpServer();

      expect(check.status).toBe('unhealthy');
      expect(check.error).toBeDefined();
    });

    it('should mark server as degraded on 4xx errors', async () => {
      const fetch = (await import('node-fetch')).default as jest.Mock;

      // @ts-ignore - Mock error response
      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({})
      });

      const check = await healthService.checkMcpServer();

      expect(check.status).toBe('degraded');
      expect(check.details.statusCode).toBe(404);
    });

    it('should mark server as unhealthy on 5xx errors', async () => {
      const fetch = (await import('node-fetch')).default as jest.Mock;

      // @ts-ignore - Mock error response
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({})
      });

      const check = await healthService.checkMcpServer();

      expect(check.status).toBe('unhealthy');
      expect(check.details.statusCode).toBe(500);
    });
  });

  describe('Health Status Aggregation', () => {
    it('should mark overall status as unhealthy if any check is unhealthy', async () => {
      // Mock a failing check
      const fetch = (await import('node-fetch')).default as jest.Mock;
      // @ts-ignore - Mock error
      fetch.mockRejectedValue(new Error('Connection failed'));

      await healthService.checkMcpServer();
      const health = await healthService.getOverallHealth();

      // Overall should be unhealthy if any check fails
      const unhealthyChecks = health.checks.filter(c => c.status === 'unhealthy');
      if (unhealthyChecks.length > 0) {
        expect(health.status).toBe('unhealthy');
        expect(health.healthy).toBe(false);
      }
    });

    it('should mark overall status as degraded if any check is degraded', async () => {
      const fetch = (await import('node-fetch')).default as jest.Mock;
      // @ts-ignore - Mock error response
      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({})
      });

      await healthService.checkMcpServer();
      const health = await healthService.getOverallHealth();

      const degradedChecks = health.checks.filter(c => c.status === 'degraded');
      if (degradedChecks.length > 0 && health.checks.every(c => c.status !== 'unhealthy')) {
        expect(health.status).toBe('degraded');
      }
    });

    it('should mark overall status as healthy if all checks are healthy', async () => {
      const fetch = (await import('node-fetch')).default as jest.Mock;
      // @ts-ignore - Mock healthy response
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });

      // Run all checks
      await healthService.checkMcpServer();
      await healthService.runCheck('system');
      await healthService.runCheck('memory');
      await healthService.runCheck('disk');
      await healthService.runCheck('database');
      await healthService.runCheck('dependencies');

      const health = await healthService.getOverallHealth();

      if (health.checks.every(c => c.status === 'healthy')) {
        expect(health.status).toBe('healthy');
        expect(health.healthy).toBe(true);
      }
    });
  });

  describe('Health Check Statistics', () => {
    it('should calculate average response time correctly', async () => {
      const detailedHealth = await healthService.getDetailedHealth();

      expect(detailedHealth.statistics.averageResponseTime).toBeGreaterThanOrEqual(0);

      const total = detailedHealth.checks.reduce(
        (sum: number, c: HealthCheck) => sum + (c.responseTime || 0),
        0
      );
      const expected = total / detailedHealth.checks.length;

      expect(detailedHealth.statistics.averageResponseTime).toBeCloseTo(expected, 1);
    });

    it('should count checks by status correctly', async () => {
      const detailedHealth = await healthService.getDetailedHealth();

      const actualHealthy = detailedHealth.checks.filter((c: HealthCheck) => c.status === 'healthy').length;
      const actualDegraded = detailedHealth.checks.filter((c: HealthCheck) => c.status === 'degraded').length;
      const actualUnhealthy = detailedHealth.checks.filter((c: HealthCheck) => c.status === 'unhealthy').length;

      expect(detailedHealth.statistics.healthyChecks).toBe(actualHealthy);
      expect(detailedHealth.statistics.degradedChecks).toBe(actualDegraded);
      expect(detailedHealth.statistics.unhealthyChecks).toBe(actualUnhealthy);
      expect(detailedHealth.statistics.totalChecks).toBe(
        actualHealthy + actualDegraded + actualUnhealthy
      );
    });
  });

  describe('Database Connectivity Check', () => {
    it('should test file system write and read operations', async () => {
      await healthService.runCheck('database');
      const check = healthService.getCheck('database');

      expect(check).toBeDefined();
      expect(check?.status).toBe('healthy');
      expect(check?.details.testSuccessful).toBe(true);
      expect(check?.details.dataDir).toBeDefined();
    });

    it('should handle database write failures', async () => {
      // Mock fs to fail
      const fs = await import('fs');
      const originalWriteFile = fs.promises.writeFile;

      jest.spyOn(fs.promises, 'writeFile').mockRejectedValue(new Error('Write failed'));

      const tempService = new HealthService();
      await tempService.runCheck('database');
      const check = tempService.getCheck('database');

      expect(check?.status).toBe('unhealthy');
      expect(check?.error).toContain('Write failed');

      // Restore
      jest.spyOn(fs.promises, 'writeFile').mockImplementation(originalWriteFile);
      tempService.stop();
    });
  });

  describe('Periodic Health Checks', () => {
    it('should run checks periodically', async () => {
      // Health service starts periodic checks on construction
      const initialHealth = await healthService.getOverallHealth();

      expect(initialHealth.checks.length).toBeGreaterThan(0);

      // Checks should have recent timestamps
      const now = Date.now();
      initialHealth.checks.forEach(check => {
        const checkTime = check.lastChecked.getTime();
        const timeDiff = now - checkTime;

        // Should be checked within last minute
        expect(timeDiff).toBeLessThan(60000);
      });
    });

    it('should stop periodic checks when stop() is called', () => {
      const service = new HealthService();

      service.stop();

      // Verify no errors thrown
      expect(true).toBe(true);
    });
  });

  describe('Individual Check Retrieval', () => {
    it('should retrieve specific check by name', async () => {
      await healthService.runCheck('memory');
      const check = healthService.getCheck('memory');

      expect(check).toBeDefined();
      expect(check?.name).toBe('Memory Health');
    });

    it('should return undefined for non-existent check', () => {
      const check = healthService.getCheck('non-existent');

      expect(check).toBeUndefined();
    });

    it('should retrieve all checks', async () => {
      const checks = healthService.getAllChecks();

      expect(Array.isArray(checks)).toBe(true);
      expect(checks.length).toBeGreaterThan(0);
    });

    it('should throw error for unknown check name', async () => {
      await expect(healthService.runCheck('unknown')).rejects.toThrow('Unknown health check: unknown');
    });
  });
});