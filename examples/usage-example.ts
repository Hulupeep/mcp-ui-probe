#!/usr/bin/env tsx

/**
 * Example usage of the MCP UI Probe server
 *
 * This demonstrates how to use the SimpleMCPServer for automated UI testing
 */

import { SimpleMCPServer } from '../src/server/simple-mcp-server.js';

async function demonstrateUITesting() {
  const server = new SimpleMCPServer();

  try {
    console.log('🚀 Starting MCP UI Probe demonstration...\n');

    // Example 1: Navigate to a page
    console.log('1. Navigating to test page...');
    const navResult = await server.handleToolCall({
      name: 'navigate',
      arguments: { url: 'https://example.com' }
    });
    console.log('Navigation result:', navResult.success ? '✅ Success' : '❌ Failed');

    // Example 2: Analyze UI structure
    console.log('\n2. Analyzing UI structure...');
    const uiResult = await server.handleToolCall({
      name: 'analyze_ui',
      arguments: { scope: 'document' }
    });

    if (uiResult.success && uiResult.data) {
      console.log(`✅ Found ${uiResult.data.forms?.length || 0} forms`);
      console.log(`✅ Found ${uiResult.data.buttons?.length || 0} buttons`);
      console.log(`✅ Found ${uiResult.data.inputs?.length || 0} inputs`);
    }

    // Example 3: Infer form structure (if forms exist)
    if (uiResult.success && uiResult.data?.forms?.length > 0) {
      console.log('\n3. Inferring form structure...');
      const formResult = await server.handleToolCall({
        name: 'infer_form',
        arguments: { goal: 'contact' }
      });

      if (formResult.success && formResult.data) {
        console.log(`✅ Form inference confidence: ${(formResult.data.confidence * 100).toFixed(1)}%`);
        console.log(`✅ Inferred ${formResult.data.formSchema.fields.length} fields`);
      }
    }

    // Example 4: Assert page elements
    console.log('\n4. Asserting page elements...');
    const assertResult = await server.handleToolCall({
      name: 'assert_selectors',
      arguments: {
        assertions: [
          { selector: 'h1', exists: true },
          { selector: 'body', exists: true, visible: true },
          { selector: '.non-existent', exists: false }
        ]
      }
    });

    if (assertResult.success && assertResult.data) {
      const passed = assertResult.data.results.filter((r: any) => r.passed).length;
      const total = assertResult.data.results.length;
      console.log(`✅ Assertions passed: ${passed}/${total}`);
    }

    // Example 5: Collect errors
    console.log('\n5. Collecting page errors...');
    const errorResult = await server.handleToolCall({
      name: 'collect_errors',
      arguments: { types: ['console', 'network'] }
    });

    if (errorResult.success && errorResult.data) {
      console.log(`✅ Found ${errorResult.data.errors.length} errors`);
    }

    console.log('\n🎉 Demonstration completed successfully!');

  } catch (error) {
    console.error('❌ Demonstration failed:', error);
  } finally {
    await server.close();
  }
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateUITesting().catch(console.error);
}

export { demonstrateUITesting };