#!/usr/bin/env node

import 'dotenv/config';
import { MCPServer } from './server/MCPServer.js';
import logger from './utils/logger.js';
import { llmValidator } from './llm/validator.js';
import { fileURLToPath } from 'url';

async function main(): Promise<void> {
  // Validate LLM configuration on startup
  try {
    const llmHealth = await llmValidator.validateLLMConfig();

    if (!llmHealth.available) {
      const fallbackMode = process.env.UI_PROBE_FALLBACK_MODE === 'true';

      if (fallbackMode) {
        logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logger.warn('⚠️  UI-Probe running in FALLBACK MODE');
        logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logger.warn('LLM features disabled - basic Playwright mode only');
        logger.warn('Available: Navigate, Click, Collect Errors');
        logger.warn('Unavailable: Intelligent Workflows, Form Inference, Enhanced Errors');
        logger.warn('');
        logger.warn('To enable full features:');
        logger.warn('  1. Get API key: https://platform.openai.com/api-keys');
        logger.warn('  2. Set: export OPENAI_API_KEY=sk-...');
        logger.warn('  3. Restart UI-Probe');
        logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      } else {
        // Show warning but continue
        logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logger.warn('⚠️  LLM API not configured');
        logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        logger.warn(`Status: ${llmHealth.error || 'No API key configured'}`);
        logger.warn('');
        logger.warn('Some features may be degraded or unavailable.');
        logger.warn('');
        logger.warn('To enable full features:');
        logger.warn('  • Get API key: https://platform.openai.com/api-keys');
        logger.warn(`  • Cost: ${llmHealth.estimatedCostPerTest} per test`);
        logger.warn('  • Set: export OPENAI_API_KEY=sk-...');
        logger.warn('');
        logger.warn('To suppress this warning:');
        logger.warn('  • Set: export UI_PROBE_FALLBACK_MODE=true');
        logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    } else {
      logger.info(`✅ LLM available (${llmHealth.provider.toUpperCase()}) - all features enabled`);
    }
  } catch (error) {
    logger.error('LLM validation failed', { error });
    // Continue anyway - server will handle degraded mode
  }

  const server = new MCPServer();

  // Graceful shutdown handling
  const cleanup = async () => {
    logger.info('Shutting down MCP UI Probe server...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    cleanup();
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    cleanup();
  });

  try {
    logger.info('Starting MCP UI Probe server...');
    await server.start();
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// ESM equivalent of require.main === module
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                     import.meta.url === fileURLToPath(process.argv[1]);

if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { MCPServer };