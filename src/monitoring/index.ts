import { createMonitoringServer, MonitoringConfig } from './server.js';

// Default configuration
const defaultConfig: MonitoringConfig = {
  port: parseInt(process.env.MONITORING_PORT || '3001'),
  host: process.env.MONITORING_HOST || '127.0.0.1',
  mcpServerUrl: process.env.MCP_SERVER_URL,
  enableMetrics: process.env.ENABLE_METRICS !== 'false',
  enableLogs: process.env.ENABLE_LOGS !== 'false',
  enableAlerts: process.env.ENABLE_ALERTS !== 'false',
  retentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '30')
};

// Factory function to create monitoring server with custom config
export function createMonitoring(config?: Partial<MonitoringConfig>) {
  const finalConfig = { ...defaultConfig, ...config };
  return createMonitoringServer(finalConfig);
}

// Export all monitoring components
export * from './server.js';
export * from './websocket.js';
export * from './metrics.js';
export * from './health.js';
export * from './explainability.js';
export * from './storage.js';

// CLI runner (if called directly)
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createMonitoring();

  server.start().then(() => {
    console.log('Monitoring server started successfully');
  }).catch((error) => {
    console.error('Failed to start monitoring server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down monitoring server...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down monitoring server...');
    await server.stop();
    process.exit(0);
  });
}