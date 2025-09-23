#!/usr/bin/env node

import 'dotenv/config';
import { MCPServer } from './server/MCPServer.js';
import logger from './utils/logger.js';
import { fileURLToPath } from 'url';

async function main(): Promise<void> {
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