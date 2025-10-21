import winston from 'winston';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

// Ensure logs directory exists
const logsDir = 'logs';
if (!existsSync(logsDir)) {
  try {
    mkdirSync(logsDir, { recursive: true });
  } catch (err) {
    // Ignore if we can't create logs directory, will fall back to console only
  }
}

// Check if debug mode is enabled
const isDebugMode = process.env.UI_PROBE_DEBUG === 'true' || process.env.UI_PROBE_DEBUG === '1';
const logLevel = isDebugMode ? 'debug' : (process.env.LOG_LEVEL || 'info');

// Detect if running as MCP server (stdout is used for JSON-RPC)
// When MCP mode is active, we must NOT output colored text or any non-JSON to stdout
// MCP servers use stdio transport, so stdin will be a pipe when running as MCP
const isMCPMode = process.env.MCP_MODE === 'true' ||
                  process.argv.includes('--stdio') ||
                  !process.stdin.isTTY ||  // stdin is piped (typical for MCP)
                  (process.stdout.isTTY === false && process.env.NODE_ENV !== 'test');

// Custom format for debug mode
const debugFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
  return `[ui-probe] ${timestamp} ${level}: ${message} ${metaStr}`;
});

// Create transports array
const transports: winston.transport[] = [];

// Add file transports if logs directory is available
if (existsSync(logsDir)) {
  transports.push(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  );
}

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    isDebugMode ? debugFormat : winston.format.json()
  ),
  defaultMeta: { service: 'mcp-ui-probe' },
  transports,
});

// Add console transport (stderr for MCP mode, stdout otherwise)
if (isMCPMode) {
  // MCP mode: use stderr, no colors, JSON format to avoid breaking JSON-RPC
  logger.add(new winston.transports.Console({
    stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose', 'silly'],
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));
} else {
  // Normal mode: use stdout with colors
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      isDebugMode ? debugFormat : winston.format.simple()
    )
  }));
}

// Add debug helper methods
export const debugLog = {
  browserLaunch: (details: any) => {
    if (isDebugMode) {
      logger.debug('Browser launch attempt', details);
    }
  },

  navigation: (url: string, options: any) => {
    if (isDebugMode) {
      logger.debug('Navigation starting', { url, options });
    }
  },

  navigationComplete: (url: string, currentUrl: string, duration: number) => {
    if (isDebugMode) {
      logger.debug('Navigation completed', { url, currentUrl, durationMs: duration });
    }
  },

  pageState: (state: any) => {
    if (isDebugMode) {
      logger.debug('Page state', state);
    }
  },

  operation: (operation: string, details: any) => {
    if (isDebugMode) {
      logger.debug(`Operation: ${operation}`, details);
    }
  },

  error: (operation: string, error: any) => {
    logger.error(`Operation failed: ${operation}`, {
      error: error.message || error,
      stack: error.stack,
      code: error.code,
      details: error.details
    });
  }
};

export default logger;