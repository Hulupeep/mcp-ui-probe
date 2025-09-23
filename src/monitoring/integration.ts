import { MonitoringServer } from './server.js';
// import { UITestingServer } from '../index.js';

// Define a basic interface for the MCP server to avoid circular dependencies
export interface UITestingServer {
  [key: string]: any;
}

/**
 * Integration hooks for connecting the monitoring system with the MCP UI Testing server
 */

export interface MonitoringIntegration {
  monitoring: MonitoringServer;
  attachToMcpServer(mcpServer: UITestingServer): void;
  detach(): void;
  setupTestExecutionHooks(mcpServer: UITestingServer): void;
  setupErrorHooks(mcpServer: UITestingServer): void;
  setupPerformanceHooks(mcpServer: UITestingServer): void;
}

export function createMonitoringIntegration(monitoring: MonitoringServer): MonitoringIntegration {
  let attachedServer: UITestingServer | null = null;
  let originalHandlers: Map<string, Function> = new Map();

  const integration: MonitoringIntegration = {
    monitoring,

    attachToMcpServer(mcpServer: UITestingServer) {
      if (attachedServer) {
        console.warn('Monitoring already attached to an MCP server');
        return;
      }

      attachedServer = mcpServer;

      // Hook into test execution events
      integration.setupTestExecutionHooks(mcpServer);

      // Hook into error handling
      integration.setupErrorHooks(mcpServer);

      // Hook into performance tracking
      integration.setupPerformanceHooks(mcpServer);

      console.log('Monitoring system attached to MCP server');
    },

    detach() {
      if (!attachedServer) return;

      // Restore original handlers
      originalHandlers.forEach((handler, event) => {
        // This would restore original event handlers if the MCP server supports it
      });

      attachedServer = null;
      originalHandlers.clear();

      console.log('Monitoring system detached from MCP server');
    },

    setupTestExecutionHooks(mcpServer: UITestingServer) {
      // Wrapper for test methods to add monitoring
      const wrapTestMethod = (methodName: string, originalMethod: Function) => {
        return async function(this: any, ...args: any[]) {
          const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const startTime = Date.now();

          // Record test start
          monitoring.getStorageService().logEvent({
            type: 'test_start',
            timestamp: new Date(),
            data: {
              testId,
              method: methodName,
              args: args.length > 0 ? args[0] : undefined // Log first arg (usually contains test info)
            }
          });

          // Notify via WebSocket
          monitoring.getWebSocketService().broadcast({
            type: 'test_start',
            data: {
              testId,
              testName: methodName,
              testType: 'ui_test',
              timestamp: new Date()
            }
          });

          try {
            // Execute original method
            const result = await originalMethod.apply(this, args);
            const duration = Date.now() - startTime;

            // Record successful completion
            monitoring.getStorageService().logEvent({
              type: 'test_complete',
              timestamp: new Date(),
              data: {
                testId,
                status: 'success',
                duration,
                result
              }
            });

            monitoring.getWebSocketService().broadcast({
              type: 'test_complete',
              data: {
                testId,
                status: 'success',
                duration,
                results: result
              }
            });

            // Update metrics
            monitoring.getMetricsService().recordTestComplete(testId, 'success', duration);

            return result;

          } catch (error: unknown) {
            const duration = Date.now() - startTime;

            // Record failure
            monitoring.getStorageService().logEvent({
              type: 'test_complete',
              level: 'ERROR',
              timestamp: new Date(),
              data: {
                testId,
                status: 'failed',
                duration,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
              }
            });

            monitoring.getWebSocketService().broadcast({
              type: 'test_complete',
              data: {
                testId,
                status: 'failed',
                duration,
                error: error instanceof Error ? error.message : String(error)
              }
            });

            // Update metrics
            monitoring.getMetricsService().recordTestComplete(testId, 'failed', duration);
            monitoring.getMetricsService().recordError('test_execution', 'mcp_server');

            throw error;
          }
        };
      };

      // Note: This is a conceptual implementation. In practice, you'd need to:
      // 1. Identify the actual test execution methods in the MCP server
      // 2. Wrap them with monitoring hooks
      // 3. Store references to original methods for cleanup

      // Example of what methods might be wrapped:
      const methodsToWrap = [
        'takeScreenshot',
        'clickElement',
        'typeText',
        'waitForElement',
        'navigateToPage',
        'findElements',
        'executeScript'
      ];

      // This is pseudocode - actual implementation would depend on MCP server architecture
      methodsToWrap.forEach(methodName => {
        const originalMethod = (mcpServer as any)[methodName];
        if (typeof originalMethod === 'function') {
          originalHandlers.set(methodName, originalMethod);
          (mcpServer as any)[methodName] = wrapTestMethod(methodName, originalMethod);
        }
      });
    },

    setupErrorHooks(mcpServer: UITestingServer) {
      // Hook into error events
      const originalErrorHandler = process.listeners('uncaughtException')[0];

      process.on('uncaughtException', (error) => {
        monitoring.getStorageService().logEvent({
          type: 'uncaught_exception',
          level: 'ERROR',
          timestamp: new Date(),
          data: {
            error: error.message,
            stack: error.stack,
            source: 'mcp_server'
          }
        });

        monitoring.getMetricsService().recordError('uncaught_exception', 'mcp_server');

        // Call original handler if it exists
        if (originalErrorHandler && typeof originalErrorHandler === 'function') {
          (originalErrorHandler as (error: Error) => void)(error);
        }
      });

      // Hook into promise rejections
      process.on('unhandledRejection', (reason, promise) => {
        monitoring.getStorageService().logEvent({
          type: 'unhandled_rejection',
          level: 'ERROR',
          timestamp: new Date(),
          data: {
            reason: reason?.toString(),
            promise: promise.toString(),
            source: 'mcp_server'
          }
        });

        monitoring.getMetricsService().recordError('unhandled_rejection', 'mcp_server');
      });
    },

    setupPerformanceHooks(mcpServer: UITestingServer) {
      // Monitor memory usage
      setInterval(() => {
        const memUsage = process.memoryUsage();

        monitoring.getStorageService().logEvent({
          type: 'memory_usage',
          timestamp: new Date(),
          data: {
            rss: memUsage.rss,
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external
          }
        });

        // Check for memory leaks
        if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
          monitoring.getStorageService().createAlert({
            type: 'high_memory_usage',
            severity: 'warning',
            message: `High memory usage detected: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            data: memUsage
          });
        }
      }, 30000); // Every 30 seconds

      // Monitor event loop lag
      const startTime = process.hrtime();
      setInterval(() => {
        const delta = process.hrtime(startTime);
        const lagMs = (delta[0] * 1000) + (delta[1] * 1e-6) - 1000; // Expected 1000ms

        if (lagMs > 100) { // 100ms lag threshold
          monitoring.getStorageService().logEvent({
            type: 'event_loop_lag',
            level: 'WARN',
            timestamp: new Date(),
            data: {
              lagMs,
              threshold: 100
            }
          });
        }
      }, 1000);
    }
  };

  return integration;
}

/**
 * Helper function to automatically set up monitoring for an MCP server
 */
export async function setupMcpServerMonitoring(
  mcpServer: UITestingServer,
  monitoringConfig?: Partial<MonitoringIntegration['monitoring']['config']>
): Promise<MonitoringIntegration> {

  // Create and start monitoring server
  const { createMonitoring } = await import('./index.js');
  const monitoring = createMonitoring(monitoringConfig);

  await monitoring.start();

  // Create and attach integration
  const integration = createMonitoringIntegration(monitoring);
  integration.attachToMcpServer(mcpServer);

  console.log('MCP server monitoring setup complete');

  return integration;
}

/**
 * Middleware for adding explainability to AI decisions
 */
export function withExplainability(
  action: string,
  reasoning: string,
  context?: any,
  confidence?: number
) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const testId = (this as any).currentTestId || 'unknown';

      // Record the decision before execution
      const monitoring = (this as any).monitoring;
      if (monitoring?.getExplainabilityService) {
        monitoring.getExplainabilityService().recordDecision(
          testId,
          propertyKey,
          reasoning,
          { action, context, args },
          'executing',
          confidence
        );
      }

      try {
        const result = await originalMethod.apply(this, args);

        // Record successful outcome
        if (monitoring?.getExplainabilityService) {
          monitoring.getExplainabilityService().recordDecision(
            testId,
            propertyKey,
            reasoning,
            { action, context, args, result },
            'success',
            confidence
          );
        }

        return result;
      } catch (error) {
        // Record failed outcome
        if (monitoring?.getExplainabilityService) {
          monitoring.getExplainabilityService().recordDecision(
            testId,
            propertyKey,
            reasoning,
            { action, context, args, error: error instanceof Error ? error.message : String(error) },
            'failed',
            confidence
          );
        }

        throw error;
      }
    };

    return descriptor;
  };
}