#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { platform } from 'os';

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
    console.log('🧪 Starting test server on http://localhost:3456...');
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

function startTestServer() {
  const testServerPath = join(__dirname, 'test-server', 'server.js');
  const child = spawn('node', [testServerPath], {
    stdio: 'inherit',
    env: { ...process.env }
  });

  child.on('error', (err) => {
    console.error('❌ Failed to start test server:', err);
    process.exit(1);
  });
}

function startMonitoring() {
  const monitoringPath = join(__dirname, 'monitoring', 'server.js');
  const child = spawn('node', [monitoringPath], {
    stdio: 'inherit',
    env: { ...process.env }
  });

  child.on('error', (err) => {
    console.error('❌ Failed to start monitoring:', err);
    process.exit(1);
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

Usage: npx mcp-ui-probe [command]

Commands:
  start, server    Start the MCP server for Claude integration
  test-server      Start the built-in test server (http://localhost:3456)
  monitor          Start the monitoring dashboard (http://localhost:3002)
  init, setup      Install dependencies and set up Playwright
  help             Show this help message

Quick Start:
  1. npx mcp-ui-probe setup              # First time setup
  2. npx mcp-ui-probe test-server        # Start test environment
  3. npx mcp-ui-probe start              # Start MCP server

For Claude integration, add to your Claude config:
  claude mcp add ui-probe "npx mcp-ui-probe start"

Learn more: https://github.com/Hulupeep/mcp-ui-probe
`);
}