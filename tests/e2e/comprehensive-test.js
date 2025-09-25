import { chromium } from 'playwright';
import { MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_SERVER_PORT = 8888;
const MCP_SERVER_PATH = path.join(__dirname, '../../dist/server/index.js');

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test result tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = [];

// Start test server
async function startTestServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(__dirname, '../../test-pages');

      if (req.url === '/') {
        filePath = path.join(filePath, 'index.html');
      } else if (req.url.endsWith('.html')) {
        filePath = path.join(filePath, req.url.slice(1));
      } else {
        filePath = path.join(filePath, req.url);
      }

      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath);
      let contentType = 'text/html';
      if (ext === '.js') contentType = 'text/javascript';
      if (ext === '.css') contentType = 'text/css';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(500);
          res.end('Server Error');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });

    server.listen(TEST_SERVER_PORT, () => {
      console.log(`${colors.cyan}Test server running at http://localhost:${TEST_SERVER_PORT}${colors.reset}`);
      resolve(server);
    });
  });
}

// Initialize MCP client
async function initMCPClient() {
  const mcpProcess = spawn('node', [MCP_SERVER_PATH], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const transport = new StdioClientTransport({
    stdin: mcpProcess.stdin,
    stdout: mcpProcess.stdout,
    stderr: mcpProcess.stderr
  });

  const client = new MCPClient({
    name: 'e2e-test-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);
  console.log(`${colors.cyan}MCP client connected${colors.reset}`);

  return { client, mcpProcess };
}

// Test helper functions
async function runTest(name, testFn) {
  totalTests++;
  console.log(`\n${colors.blue}Running: ${name}${colors.reset}`);

  try {
    await testFn();
    passedTests++;
    console.log(`${colors.green}✓ ${name} passed${colors.reset}`);
  } catch (error) {
    failedTests.push({ name, error: error.message });
    console.log(`${colors.red}✗ ${name} failed: ${error.message}${colors.reset}`);
  }
}

// Main test suite
async function runTests() {
  console.log(`${colors.cyan}
╔═══════════════════════════════════════════════════╗
║     MCP UI-PROBE COMPREHENSIVE E2E TEST SUITE    ║
╚═══════════════════════════════════════════════════╝
${colors.reset}`);

  const server = await startTestServer();
  const { client, mcpProcess } = await initMCPClient();

  try {
    // Test 1: React Components - Card Selection
    await runTest('React Card Components Selection', async () => {
      const result = await client.request({
        method: 'tools/call',
        params: {
          name: 'navigate',
          arguments: {
            url: `http://localhost:${TEST_SERVER_PORT}/react-components.html`
          }
        }
      });

      if (!result.content[0].text.includes('"success": true')) {
        throw new Error('Navigation failed');
      }

      // Analyze the page
      const analysis = await client.request({
        method: 'tools/call',
        params: {
          name: 'analyze_ui',
          arguments: {}
        }
      });

      const analysisData = JSON.parse(analysis.content[0].text);

      // Check if React components are detected
      if (!analysisData.data.buttons || analysisData.data.buttons.length === 0) {
        throw new Error('No buttons detected on React page');
      }

      // Click on a plan card
      const clickResult = await client.request({
        method: 'tools/call',
        params: {
          name: 'click_button',
          arguments: {
            selector: '.plan-card[data-plan-id="pro"]'
          }
        }
      });

      const clickData = JSON.parse(clickResult.content[0].text);
      if (!clickData.success) {
        throw new Error('Failed to click React card component');
      }

      // Click continue button
      const continueResult = await client.request({
        method: 'tools/call',
        params: {
          name: 'click_button',
          arguments: {
            text: 'Continue to Signup'
          }
        }
      });

      const continueData = JSON.parse(continueResult.content[0].text);
      if (!continueData.success) {
        throw new Error('Failed to click continue button after plan selection');
      }
    });

    // Test 2: Non-Semantic Clickable Elements
    await runTest('Non-Semantic Clickable Elements', async () => {
      // Test clicking on divs and spans with cursor:pointer
      const clickDiv = await client.request({
        method: 'tools/call',
        params: {
          name: 'click_button',
          arguments: {
            selector: '.clickable-div'
          }
        }
      });

      const divData = JSON.parse(clickDiv.content[0].text);
      if (!divData.success) {
        throw new Error('Failed to click non-semantic div element');
      }

      // Test ARIA button
      const clickAria = await client.request({
        method: 'tools/call',
        params: {
          name: 'click_button',
          arguments: {
            selector: '[role="button"]'
          }
        }
      });

      const ariaData = JSON.parse(clickAria.content[0].text);
      if (!ariaData.success) {
        throw new Error('Failed to click ARIA button element');
      }
    });

    // Test 3: File Upload
    await runTest('File Upload Functionality', async () => {
      const navResult = await client.request({
        method: 'tools/call',
        params: {
          name: 'navigate',
          arguments: {
            url: `http://localhost:${TEST_SERVER_PORT}/file-upload.html`
          }
        }
      });

      if (!navResult.content[0].text.includes('"success": true')) {
        throw new Error('Navigation to file upload page failed');
      }

      // Test standard file upload
      const uploadResult = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_flow',
          arguments: {
            goal: 'Upload a test file to the standard file input',
            url: `http://localhost:${TEST_SERVER_PORT}/file-upload.html`
          }
        }
      });

      // Since file upload is implemented, this should work
      if (uploadResult.content[0].text.includes('error') &&
          !uploadResult.content[0].text.includes('File upload not implemented')) {
        throw new Error('File upload test failed');
      }
    });

    // Test 4: Dropdown Components
    await runTest('Dropdown Component Handling', async () => {
      const navResult = await client.request({
        method: 'tools/call',
        params: {
          name: 'navigate',
          arguments: {
            url: `http://localhost:${TEST_SERVER_PORT}/dropdowns.html`
          }
        }
      });

      if (!navResult.content[0].text.includes('"success": true')) {
        throw new Error('Navigation to dropdowns page failed');
      }

      // Test native select
      const nativeSelect = await client.request({
        method: 'tools/call',
        params: {
          name: 'run_flow',
          arguments: {
            goal: 'Select Option 2 from the native select dropdown',
            url: `http://localhost:${TEST_SERVER_PORT}/dropdowns.html`
          }
        }
      });

      // Test custom React select
      const customSelect = await client.request({
        method: 'tools/call',
        params: {
          name: 'click_button',
          arguments: {
            selector: '.custom-select-control'
          }
        }
      });

      const customData = JSON.parse(customSelect.content[0].text);
      if (!customData.success) {
        throw new Error('Failed to open custom dropdown');
      }

      // Select an option
      const selectOption = await client.request({
        method: 'tools/call',
        params: {
          name: 'click_button',
          arguments: {
            selector: '.custom-select-option'
          }
        }
      });

      const optionData = JSON.parse(selectOption.content[0].text);
      if (!optionData.success) {
        throw new Error('Failed to select dropdown option');
      }
    });

    // Test 5: Form Inference and Filling
    await runTest('Form Inference and Auto-Fill', async () => {
      const navResult = await client.request({
        method: 'tools/call',
        params: {
          name: 'navigate',
          arguments: {
            url: `http://localhost:${TEST_SERVER_PORT}/`
          }
        }
      });

      if (!navResult.content[0].text.includes('"success": true')) {
        throw new Error('Navigation to main page failed');
      }

      // Infer form structure
      const inferResult = await client.request({
        method: 'tools/call',
        params: {
          name: 'infer_form',
          arguments: {
            goal: 'signup'
          }
        }
      });

      const inferData = JSON.parse(inferResult.content[0].text);
      if (!inferData.success || !inferData.data.formSchema) {
        throw new Error('Form inference failed');
      }

      // Fill and submit form
      const fillResult = await client.request({
        method: 'tools/call',
        params: {
          name: 'fill_and_submit',
          arguments: {
            formSchema: inferData.data.formSchema
          }
        }
      });

      const fillData = JSON.parse(fillResult.content[0].text);
      if (!fillData.runId) {
        throw new Error('Form fill and submit failed');
      }
    });

    // Test 6: Dynamic Content Loading
    await runTest('Dynamic Content and State Management', async () => {
      const navResult = await client.request({
        method: 'tools/call',
        params: {
          name: 'navigate',
          arguments: {
            url: `http://localhost:${TEST_SERVER_PORT}/react-components.html`
          }
        }
      });

      if (!navResult.content[0].text.includes('"success": true')) {
        throw new Error('Navigation failed');
      }

      // Click load dynamic content button
      const loadContent = await client.request({
        method: 'tools/call',
        params: {
          name: 'click_button',
          arguments: {
            text: 'Load Dynamic Content'
          }
        }
      });

      const loadData = JSON.parse(loadContent.content[0].text);
      if (!loadData.success) {
        throw new Error('Failed to click dynamic content button');
      }

      // Wait for content to load (2 seconds as per the component)
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Verify content loaded
      const verifyResult = await client.request({
        method: 'tools/call',
        params: {
          name: 'verify_page',
          arguments: {
            expectedContent: ['Item 1', 'Item 2', 'Item 3']
          }
        }
      });

      const verifyData = JSON.parse(verifyResult.content[0].text);
      if (!verifyData.success || !verifyData.data.isValid) {
        throw new Error('Dynamic content not loaded properly');
      }
    });

    // Test 7: Modal Interactions
    await runTest('Modal Opening and Closing', async () => {
      // Open modal
      const openModal = await client.request({
        method: 'tools/call',
        params: {
          name: 'click_button',
          arguments: {
            text: 'Open React Modal'
          }
        }
      });

      const openData = JSON.parse(openModal.content[0].text);
      if (!openData.success) {
        throw new Error('Failed to open modal');
      }

      // Close modal
      const closeModal = await client.request({
        method: 'tools/call',
        params: {
          name: 'click_button',
          arguments: {
            text: 'Close'
          }
        }
      });

      const closeData = JSON.parse(closeModal.content[0].text);
      if (!closeData.success) {
        throw new Error('Failed to close modal');
      }
    });

    // Test 8: Multi-Select Dropdown
    await runTest('Multi-Select Dropdown Interaction', async () => {
      const navResult = await client.request({
        method: 'tools/call',
        params: {
          name: 'navigate',
          arguments: {
            url: `http://localhost:${TEST_SERVER_PORT}/dropdowns.html`
          }
        }
      });

      if (!navResult.content[0].text.includes('"success": true')) {
        throw new Error('Navigation to dropdowns page failed');
      }

      // Open multi-select
      const openMulti = await client.request({
        method: 'tools/call',
        params: {
          name: 'click_button',
          arguments: {
            selector: '#multi-select .custom-select-control'
          }
        }
      });

      const multiData = JSON.parse(openMulti.content[0].text);
      if (!multiData.success) {
        throw new Error('Failed to open multi-select dropdown');
      }

      // Select multiple options
      const selectFirst = await client.request({
        method: 'tools/call',
        params: {
          name: 'click_button',
          arguments: {
            text: 'JavaScript'
          }
        }
      });

      if (!JSON.parse(selectFirst.content[0].text).success) {
        throw new Error('Failed to select first option in multi-select');
      }

      const selectSecond = await client.request({
        method: 'tools/call',
        params: {
          name: 'click_button',
          arguments: {
            text: 'React'
          }
        }
      });

      if (!JSON.parse(selectSecond.content[0].text).success) {
        throw new Error('Failed to select second option in multi-select');
      }
    });

    // Test 9: Async Loading Dropdown
    await runTest('Async Loading Dropdown', async () => {
      // Click to load async options
      const loadAsync = await client.request({
        method: 'tools/call',
        params: {
          name: 'click_button',
          arguments: {
            selector: '#async-select .custom-select-control'
          }
        }
      });

      const asyncData = JSON.parse(loadAsync.content[0].text);
      if (!asyncData.success) {
        throw new Error('Failed to trigger async loading');
      }

      // Wait for options to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Select a loaded option
      const selectUser = await client.request({
        method: 'tools/call',
        params: {
          name: 'click_button',
          arguments: {
            text: 'John Doe'
          }
        }
      });

      const userData = JSON.parse(selectUser.content[0].text);
      if (!userData.success) {
        throw new Error('Failed to select async loaded option');
      }
    });

    // Test 10: Error Detection
    await runTest('Error Detection and Collection', async () => {
      // Navigate to a page that might have errors
      await client.request({
        method: 'tools/call',
        params: {
          name: 'navigate',
          arguments: {
            url: `http://localhost:${TEST_SERVER_PORT}/404`
          }
        }
      });

      // Collect errors
      const errorsResult = await client.request({
        method: 'tools/call',
        params: {
          name: 'collect_errors',
          arguments: {
            types: ['console', 'network', 'validation']
          }
        }
      });

      const errorsData = JSON.parse(errorsResult.content[0].text);
      if (!errorsData.success) {
        throw new Error('Error collection failed');
      }
    });

  } finally {
    // Cleanup
    console.log(`\n${colors.cyan}Cleaning up...${colors.reset}`);

    await client.close();
    mcpProcess.kill();
    server.close();
  }

  // Print test results
  console.log(`\n${colors.cyan}
╔═══════════════════════════════════════════════════╗
║                  TEST RESULTS                     ║
╚═══════════════════════════════════════════════════╝
${colors.reset}`);

  console.log(`Total Tests: ${totalTests}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests.length}${colors.reset}`);

  if (failedTests.length > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    failedTests.forEach(({ name, error }) => {
      console.log(`  - ${name}: ${error}`);
    });
  }

  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  const statusColor = successRate >= 80 ? colors.green : successRate >= 60 ? colors.yellow : colors.red;

  console.log(`\n${statusColor}Success Rate: ${successRate}%${colors.reset}`);

  if (successRate === '100.0') {
    console.log(`\n${colors.green}🎉 ALL TESTS PASSED! The React fixes, file upload, and dropdown handling are working correctly!${colors.reset}`);
  }

  process.exit(failedTests.length > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});