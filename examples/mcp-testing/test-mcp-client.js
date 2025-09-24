#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';

// Start the MCP server as a subprocess
const server = spawn('npx', ['mcp-ui-probe@latest', 'start'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

// Create readline interface for interactive communication
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Handle server output
server.stdout.on('data', (data) => {
  try {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      if (line.trim()) {
        const response = JSON.parse(line);
        console.log('\n📥 Server Response:', JSON.stringify(response, null, 2));
      }
    });
  } catch (e) {
    // Initial connection messages might not be JSON
    console.log('Server:', data.toString());
  }
});

server.stderr.on('data', (data) => {
  console.error('Server Error:', data.toString());
});

// Send JSON-RPC message to server
function sendMessage(message) {
  const jsonMessage = JSON.stringify(message) + '\n';
  console.log('\n📤 Sending:', JSON.stringify(message, null, 2));
  server.stdin.write(jsonMessage);
}

// Test sequence
async function runTests() {
  console.log('🚀 MCP UI-Probe Test Client');
  console.log('==========================\n');

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 1. Initialize connection
  console.log('\n1️⃣ Testing: Initialize Connection');
  sendMessage({
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '0.1.0',
      capabilities: {}
    },
    id: 1
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // 2. List available tools
  console.log('\n2️⃣ Testing: List Tools');
  sendMessage({
    jsonrpc: '2.0',
    method: 'tools/list',
    params: {},
    id: 2
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // 3. Navigate to a test page
  console.log('\n3️⃣ Testing: Navigate to Test Page');
  sendMessage({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'navigate',
      arguments: {
        url: 'http://localhost:8081/test'
      }
    },
    id: 3
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // 4. Analyze the page
  console.log('\n4️⃣ Testing: Analyze UI');
  sendMessage({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'analyze_ui',
      arguments: {}
    },
    id: 4
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // 5. Infer form structure
  console.log('\n5️⃣ Testing: Infer Form');
  sendMessage({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'infer_form',
      arguments: {
        goal: 'signup'
      }
    },
    id: 5
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // 6. Run a simple flow
  console.log('\n6️⃣ Testing: Run Flow');
  sendMessage({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'run_flow',
      arguments: {
        goal: 'Click the test button',
        url: 'http://localhost:8081/test'
      }
    },
    id: 6
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Interactive mode
  console.log('\n✅ Tests complete! Entering interactive mode.');
  console.log('Commands:');
  console.log('  navigate <url> - Navigate to URL');
  console.log('  analyze - Analyze current page');
  console.log('  click <text> - Click button with text');
  console.log('  list - List available tools');
  console.log('  exit - Quit\n');

  rl.on('line', (input) => {
    const [cmd, ...args] = input.trim().split(' ');

    switch(cmd) {
      case 'navigate':
        sendMessage({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'navigate',
            arguments: { url: args.join(' ') }
          },
          id: Date.now()
        });
        break;

      case 'analyze':
        sendMessage({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'analyze_ui',
            arguments: {}
          },
          id: Date.now()
        });
        break;

      case 'click':
        sendMessage({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'click_button',
            arguments: { text: args.join(' ') }
          },
          id: Date.now()
        });
        break;

      case 'list':
        sendMessage({
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: Date.now()
        });
        break;

      case 'exit':
        console.log('Goodbye!');
        process.exit(0);

      default:
        console.log('Unknown command. Try: navigate, analyze, click, list, or exit');
    }
  });
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.kill();
  process.exit();
});

// Run the tests
runTests().catch(console.error);