#!/usr/bin/env tsx

/**
 * Example of complete workflow execution using MCP UI Probe
 *
 * This demonstrates the high-level run_flow tool for end-to-end automation
 */

import { SimpleMCPServer } from '../src/server/simple-mcp-server.js';

async function demonstrateCompleteWorkflow() {
  const server = new SimpleMCPServer();

  try {
    console.log('🚀 Starting complete workflow demonstration...\n');

    // Example: Complete signup flow
    console.log('1. Executing complete signup workflow...');
    const workflowResult = await server.handleToolCall({
      name: 'run_flow',
      arguments: {
        goal: 'Sign up a new user',
        url: 'https://httpbin.org/forms/post'  // Example form endpoint
      }
    });

    if (workflowResult.success && workflowResult.data) {
      const testRun = workflowResult.data;

      console.log('\n📊 Workflow Results:');
      console.log(`   Run ID: ${testRun.runId}`);
      console.log(`   Target URL: ${testRun.target.url}`);
      console.log(`   Result: ${testRun.result}`);
      console.log(`   Total Time: ${testRun.metrics.totalTimeMs}ms`);
      console.log(`   Steps Executed: ${testRun.metrics.steps}`);
      console.log(`   Errors Found: ${testRun.errors.length}`);

      // Show detailed steps
      console.log('\n📝 Execution Steps:');
      testRun.flow.forEach((step: any, index: number) => {
        const status = step.outcome === 'success' ? '✅' : '❌';
        console.log(`   ${index + 1}. ${status} ${step.inferredIntent} (${step.latencyMs}ms)`);
      });

      // Show errors if any
      if (testRun.errors.length > 0) {
        console.log('\n⚠️  Errors Encountered:');
        testRun.errors.forEach((error: any, index: number) => {
          console.log(`   ${index + 1}. [${error.type}] ${error.message}`);
        });
      }

      // Export report example
      console.log('\n2. Exporting test report...');
      const exportResult = await server.handleToolCall({
        name: 'export_report',
        arguments: {
          runId: testRun.runId,
          format: 'json'
        }
      });

      if (exportResult.success && exportResult.data) {
        console.log(`✅ Report exported to: ${exportResult.data.path}`);
        console.log(`   Format: ${exportResult.data.format}`);
      }
    }

    console.log('\n🎉 Complete workflow demonstration finished!');

  } catch (error) {
    console.error('❌ Workflow demonstration failed:', error);
  } finally {
    await server.close();
  }
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateCompleteWorkflow().catch(console.error);
}

export { demonstrateCompleteWorkflow };