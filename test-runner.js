#!/usr/bin/env node

/**
 * MCP UI Probe Test Runner
 * This script tests the MCP server using its own tools
 * "Eating our own dog food"
 */

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { spawn } = require('child_process');

const TEST_BASE_URL = 'http://localhost:8888';

class MCPTestRunner {
  constructor() {
    this.client = null;
    this.testResults = [];
    this.passed = 0;
    this.failed = 0;
  }

  async connect() {
    console.log('🔌 Connecting to MCP server...');

    const transport = new StdioClientTransport({
      command: 'node',
      args: ['./dist/index.js']
    });

    this.client = new Client({
      name: 'test-runner',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await this.client.connect(transport);
    console.log('✅ Connected to MCP server\n');
  }

  async callTool(toolName, args) {
    try {
      const result = await this.client.callTool(toolName, args);
      return JSON.parse(result.content[0].text);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async test(name, testFn) {
    console.log(`\n📝 Testing: ${name}`);
    try {
      const result = await testFn();
      if (result.pass) {
        console.log(`  ✅ PASSED: ${result.message || ''}`);
        this.passed++;
        this.testResults.push({ test: name, status: 'PASS', details: result });
      } else {
        console.log(`  ❌ FAILED: ${result.message || ''}`);
        console.log(`     Details: ${JSON.stringify(result.details, null, 2)}`);
        this.failed++;
        this.testResults.push({ test: name, status: 'FAIL', details: result });
      }
    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}`);
      this.failed++;
      this.testResults.push({ test: name, status: 'ERROR', error: error.message });
    }
  }

  async runTests() {
    console.log('🧪 Starting MCP UI Probe Test Suite\n');
    console.log('=' .repeat(50));

    // Test 1: Navigate to success page
    await this.test('Navigate to valid page', async () => {
      const result = await this.callTool('navigate', {
        url: `${TEST_BASE_URL}/success.html`
      });

      return {
        pass: result.success === true && !result.data?.is404Page,
        message: `Navigation success=${result.success}, is404=${result.data?.is404Page}`,
        details: result
      };
    });

    // Test 2: Navigate to 404 page (content indicates 404 but status is 200)
    await this.test('Detect 404 page by content', async () => {
      const result = await this.callTool('navigate', {
        url: `${TEST_BASE_URL}/404`
      });

      return {
        pass: result.success === false || result.data?.is404Page === true,
        message: `Should detect 404 from content. Success=${result.success}, is404=${result.data?.is404Page}`,
        details: result
      };
    });

    // Test 3: Navigate to real 404 (HTTP status 404)
    await this.test('Detect real 404 by HTTP status', async () => {
      const result = await this.callTool('navigate', {
        url: `${TEST_BASE_URL}/real-404`
      });

      return {
        pass: result.success === false || result.data?.is404Page === true,
        message: `Should detect 404 from HTTP status. Success=${result.success}, status=${result.data?.httpStatus}`,
        details: result
      };
    });

    // Test 4: Click button
    await this.test('Click button by text', async () => {
      // First navigate to main page
      await this.callTool('navigate', {
        url: `${TEST_BASE_URL}/`
      });

      const result = await this.callTool('click_button', {
        text: 'Sign Up'
      });

      return {
        pass: result.success === true,
        message: `Button click success=${result.success}`,
        details: result
      };
    });

    // Test 5: Analyze UI
    await this.test('Analyze page UI', async () => {
      await this.callTool('navigate', {
        url: `${TEST_BASE_URL}/`
      });

      const result = await this.callTool('analyze_ui', {});

      const hasData = result.data?.forms?.length > 0 || result.data?.buttons?.length > 0;
      return {
        pass: result.success === true && hasData,
        message: `Found ${result.data?.forms?.length || 0} forms, ${result.data?.buttons?.length || 0} buttons`,
        details: result
      };
    });

    // Test 6: Form filling with validation
    await this.test('Fill form with invalid data should fail', async () => {
      await this.callTool('navigate', {
        url: `${TEST_BASE_URL}/`
      });

      // Analyze form first
      const analysis = await this.callTool('analyze_ui', {});
      const loginForm = analysis.data?.forms?.find(f => f.name.includes('login'));

      if (!loginForm) {
        return { pass: false, message: 'Could not find login form' };
      }

      // Infer form structure
      const inference = await this.callTool('infer_form', {
        goal: 'login'
      });

      // Fill with invalid data
      const fillResult = await this.callTool('fill_and_submit', {
        formSchema: inference.data?.formSchema,
        overrides: {
          email: 'invalid@',  // Invalid email
          password: 'short'   // Too short password
        }
      });

      // Should detect validation errors
      const hasValidationErrors = fillResult.data?.errors?.some(e => e.type === 'validation');
      return {
        pass: hasValidationErrors || fillResult.data?.result === 'failed',
        message: `Validation errors detected: ${hasValidationErrors}`,
        details: fillResult
      };
    });

    // Test 7: run_flow with button click goal
    await this.test('run_flow with button click goal', async () => {
      const result = await this.callTool('run_flow', {
        goal: 'Click the "Sign Up" button',
        url: `${TEST_BASE_URL}/`
      });

      // Check if it actually clicked a button (not filled a form)
      const clickedButton = result.data?.steps?.some(s => s.step === 'click_button');
      const filledForm = result.data?.steps?.some(s => s.step === 'execute');

      return {
        pass: clickedButton && !filledForm,
        message: `Clicked button: ${clickedButton}, Filled form: ${filledForm}`,
        details: result
      };
    });

    // Test 8: Custom dropdown interaction
    await this.test('Interact with custom dropdown', async () => {
      await this.callTool('navigate', {
        url: `${TEST_BASE_URL}/`
      });

      const analysis = await this.callTool('analyze_ui', {});
      const signupForm = analysis.data?.forms?.find(f => f.name.includes('signup'));

      if (!signupForm) {
        return { pass: false, message: 'Could not find signup form' };
      }

      // Try to fill form with custom dropdown
      const result = await this.callTool('run_flow', {
        goal: 'Fill signup form with business type as Startup'
      });

      return {
        pass: result.success === true,
        message: `Custom dropdown interaction: ${result.success}`,
        details: result
      };
    });

    // Print summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Test Summary:');
    console.log(`   ✅ Passed: ${this.passed}`);
    console.log(`   ❌ Failed: ${this.failed}`);
    console.log(`   📈 Success Rate: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%`);

    // Generate report
    this.generateReport();
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.passed + this.failed,
        passed: this.passed,
        failed: this.failed,
        successRate: Math.round((this.passed / (this.passed + this.failed)) * 100)
      },
      results: this.testResults
    };

    const fs = require('fs');
    const reportPath = './test-results.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }

  async cleanup() {
    if (this.client) {
      await this.client.close();
    }
  }
}

async function main() {
  const runner = new MCPTestRunner();

  try {
    await runner.connect();
    await runner.runTests();
  } catch (error) {
    console.error('Test runner error:', error);
  } finally {
    await runner.cleanup();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MCPTestRunner };