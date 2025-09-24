#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🧪 Node.js MCP Protocol Test');
console.log('============================\n');

// Start the MCP server
console.log('Starting MCP server...');
const mcp = spawn('npx', ['mcp-ui-probe@latest', 'start'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';

// Handle server output
mcp.stdout.on('data', (data) => {
  buffer += data.toString();

  // Try to parse complete JSON objects from buffer
  const lines = buffer.split('\n');
  buffer = lines.pop(); // Keep incomplete line in buffer

  lines.forEach(line => {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('📥 Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        // Not JSON, probably log output
        if (!line.includes('[32m') && !line.includes('info:')) {
          console.log('📄 Output:', line);
        }
      }
    }
  });
});

mcp.stderr.on('data', (data) => {
  const output = data.toString();
  if (!output.includes('npm warn')) {
    console.error('❌ Error:', output);
  }
});

// Send requests after server starts
setTimeout(() => {
  // Test 1: Initialize
  console.log('\n1️⃣ Testing initialize...');
  const initRequest = {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '0.1.0',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    },
    id: 1
  };
  mcp.stdin.write(JSON.stringify(initRequest) + '\n');

  // Test 2: List tools after init
  setTimeout(() => {
    console.log('\n2️⃣ Testing tools/list...');
    const toolsRequest = {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 2
    };
    mcp.stdin.write(JSON.stringify(toolsRequest) + '\n');
  }, 1000);

  // Test 3: Call a tool
  setTimeout(() => {
    console.log('\n3️⃣ Testing navigate tool...');
    const navigateRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'navigate',
        arguments: {
          url: 'http://localhost:8081/test'
        }
      },
      id: 3
    };
    mcp.stdin.write(JSON.stringify(navigateRequest) + '\n');
  }, 2000);

  // End test
  setTimeout(() => {
    console.log('\n✅ Test complete!');
    mcp.kill();
    process.exit(0);
  }, 4000);
}, 2000);

// Handle termination
process.on('SIGINT', () => {
  mcp.kill();
  process.exit(0);
});