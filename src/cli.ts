#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { platform } from 'os';
import * as net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check for Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
if (majorVersion < 18) {
  console.error('❌ Error: Node.js 18+ is required. You have', nodeVersion);
  console.error('Please update Node.js: https://nodejs.org');
  process.exit(1);
}

const args = process.argv.slice(2);

// Parse command
const command = args[0];

switch (command) {
  case 'start':
  case 'server':
    console.log('🚀 Starting UI-Probe MCP server...');
    startMCPServer();
    break;

  case 'test-server':
    startTestServer();
    break;

  case 'monitor':
  case 'monitoring':
    console.log('📊 Starting monitoring dashboard on http://localhost:3002...');
    startMonitoring();
    break;

  case 'init':
  case 'setup':
    console.log('📦 Setting up UI-Probe...');
    runSetup();
    break;

  case 'help':
  case '--help':
  case '-h':
  default:
    showHelp();
    break;
}

function startMCPServer() {
  const serverPath = join(__dirname, 'index.js');
  const child = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: { ...process.env }
  });

  child.on('error', (err) => {
    console.error('❌ Failed to start MCP server:', err);
    process.exit(1);
  });
}

async function startTestServer() {
  const defaultPort = 8081;
  const alternativePorts = [8082, 8083, 3456, 3457, 8090];

  // Parse --port flag if provided
  const portIndex = args.indexOf('--port');
  let requestedPort = defaultPort;
  if (portIndex !== -1 && args[portIndex + 1]) {
    requestedPort = parseInt(args[portIndex + 1]);
    if (isNaN(requestedPort)) {
      console.error('❌ Invalid port number');
      process.exit(1);
    }
  }

  // Check if requested port is available
  const availablePort = await findAvailablePort(requestedPort, alternativePorts);

  if (!availablePort) {
    console.error('❌ No available ports found. Please stop other services or specify a different port with --port');
    process.exit(1);
  }

  if (availablePort !== requestedPort && portIndex !== -1) {
    console.log(`⚠️  Port ${requestedPort} is in use`);
  }

  console.log(`🧪 Starting test server on http://localhost:${availablePort}...`);

  const testServerPath = join(__dirname, 'test-server', 'server.js');
  const child = spawn('node', [testServerPath], {
    stdio: 'inherit',
    env: { ...process.env, PORT: availablePort.toString() }
  });

  child.on('error', (err) => {
    console.error('❌ Failed to start test server:', err);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    child.kill();
    process.exit(0);
  });
}

async function startMonitoring() {
  const defaultPort = 3002;
  const alternativePorts = [3003, 3004, 3005, 3456, 3457];

  // Parse --port flag if provided
  const portIndex = args.indexOf('--port');
  let requestedPort = defaultPort;
  if (portIndex !== -1 && args[portIndex + 1]) {
    requestedPort = parseInt(args[portIndex + 1]);
    if (isNaN(requestedPort)) {
      console.error('❌ Invalid port number');
      process.exit(1);
    }
  }

  // Check if requested port is available
  const availablePort = await findAvailablePort(requestedPort, alternativePorts);

  if (!availablePort) {
    console.error('❌ No available ports found. Please stop other services or specify a different port with --port');
    process.exit(1);
  }

  if (availablePort !== requestedPort && portIndex !== -1) {
    console.log(`⚠️  Port ${requestedPort} is in use`);
  }

  console.log(`📊 Starting monitoring dashboard on http://localhost:${availablePort}...`);

  const monitoringPath = join(__dirname, 'monitoring', 'server.js');
  const child = spawn('node', [monitoringPath], {
    stdio: 'inherit',
    env: { ...process.env, PORT: availablePort.toString() }
  });

  child.on('error', (err) => {
    console.error('❌ Failed to start monitoring:', err);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    child.kill();
    process.exit(0);
  });
}

function runSetup() {
  console.log('📦 Checking Playwright installation...');

  // Check if Playwright browsers are already installed
  const playwrightPath = join(process.env.HOME || process.env.USERPROFILE || '', '.cache', 'ms-playwright');
  const browsersExist = existsSync(playwrightPath);

  if (browsersExist) {
    console.log('✅ Playwright browsers already installed!');
    console.log('\nNext steps:');
    console.log('1. Configure Claude to use UI-Probe:');
    console.log('   claude mcp add ui-probe "npx mcp-ui-probe start"');
    console.log('\n2. Test it with:');
    console.log('   npx mcp-ui-probe test-server');
    return;
  }

  console.log('Installing Playwright browsers (one-time setup, ~500MB)...');
  console.log('This may take a few minutes...');

  const npmCmd = platform() === 'win32' ? 'npx.cmd' : 'npx';
  const child = spawn(npmCmd, ['playwright', 'install', 'chromium'], {
    stdio: 'inherit',
    shell: platform() === 'win32'
  });

  child.on('error', (err) => {
    console.error('❌ Failed to run Playwright install:', err.message);
    console.error('\nTry running manually:');
    console.error('   npx playwright install chromium');
    process.exit(1);
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Setup complete! You can now use UI-Probe.');
      console.log('\nNext steps:');
      console.log('1. Configure Claude to use UI-Probe:');
      console.log('   claude mcp add ui-probe "npx mcp-ui-probe start"');
      console.log('\n2. Test it with:');
      console.log('   npx mcp-ui-probe test-server');
    } else {
      console.error('❌ Setup failed with code', code);
      console.error('\nTry running manually:');
      console.error('   npx playwright install chromium');
      process.exit(1);
    }
  });
}

function showHelp() {
  console.log(`
UI-Probe - Test Any Website in Plain English

Usage: npx mcp-ui-probe [command] [options]

Commands:
  start, server    Start the MCP server for Claude integration
  test-server      Start the built-in test server (default: port 8081)
  monitor          Start the monitoring dashboard (default: port 3002)
  init, setup      Install dependencies and set up Playwright
  help             Show this help message

Options:
  --port <number>  Specify custom port for test-server or monitor commands

Quick Start:
  1. npx mcp-ui-probe setup              # First time setup
  2. npx mcp-ui-probe test-server        # Start test environment
  3. npx mcp-ui-probe start              # Start MCP server

Examples:
  npx mcp-ui-probe test-server --port 3000   # Use custom port
  npx mcp-ui-probe monitor --port 4000       # Use custom port

For Claude integration, add to your Claude config:
  claude mcp add ui-probe "npx mcp-ui-probe start"

Learn more: https://github.com/Hulupeep/mcp-ui-probe
`);
}

// Helper function to check port availability
async function findAvailablePort(preferredPort: number, alternatives: number[]): Promise<number | null> {
  // First try the preferred port
  if (await isPortAvailable(preferredPort)) {
    return preferredPort;
  }

  // If preferred port is taken, show what's using it
  console.log(`⚠️  Port ${preferredPort} is already in use`);

  // Try alternative ports
  for (const port of alternatives) {
    if (await isPortAvailable(port)) {
      console.log(`✅ Using alternative port ${port}`);
      return port;
    }
  }

  return null;
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, '0.0.0.0');
  });
}