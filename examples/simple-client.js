/**
 * Simple Client for MCP UI Probe
 *
 * This provides an easy-to-use interface for testing websites
 * without needing to understand the MCP protocol details.
 */

class SimpleUITester {
  constructor(serverUrl = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
  }

  /**
   * Test a website with a natural language goal
   * @param {string} goal - What you want to test in plain English
   * @param {string} url - The website URL to test
   * @returns {Promise<object>} Test results
   */
  async test(goal, url) {
    try {
      const response = await fetch(`${this.serverUrl}/api/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: 'run_flow',
          arguments: {
            goal,
            url,
          },
        }),
      });

      const result = await response.json();

      // Pretty print the results
      this.printResults(result);

      return result;
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      throw error;
    }
  }

  /**
   * Quick test - just provide a goal and URL as strings
   */
  async quickTest(instruction) {
    // Parse instruction like "Test signup on example.com"
    const match = instruction.match(/^(.+)\s+on\s+(.+)$/i);
    if (!match) {
      throw new Error('Format: "Test [what] on [website]"');
    }

    const [_, goal, url] = match;

    // Add http:// if missing
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;

    return this.test(goal, fullUrl);
  }

  /**
   * Print test results in a nice format
   */
  printResults(result) {
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(50));

    if (result.success || result.result === 'passed') {
      console.log('✅ TEST PASSED');
    } else {
      console.log('❌ TEST FAILED');
    }

    // Show steps
    if (result.flow || result.steps) {
      console.log('\n📝 Steps Executed:');
      (result.flow || result.steps || []).forEach((step, i) => {
        const icon = step.outcome === 'success' ? '✅' : '❌';
        console.log(`   ${i + 1}. ${icon} ${step.action}: ${step.inferredIntent || step.description}`);
      });
    }

    // Show timing
    if (result.metrics) {
      console.log('\n⏱️  Performance:');
      console.log(`   - Total time: ${result.metrics.totalTimeMs}ms`);
      console.log(`   - Steps: ${result.metrics.steps}`);
    }

    // Show errors
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️  Errors Found:');
      result.errors.forEach((error) => {
        console.log(`   - ${error.type}: ${error.message}`);
      });
    }

    console.log('\n🔗 View details at: http://localhost:3001');
    console.log('='.repeat(50) + '\n');
  }

  /**
   * Test multiple scenarios
   */
  async testScenarios(scenarios) {
    console.log('🎯 Running Test Scenarios\n');

    const results = [];
    for (const scenario of scenarios) {
      console.log(`\n▶️  ${scenario.name}`);
      try {
        const result = await this.test(scenario.goal, scenario.url);
        results.push({
          name: scenario.name,
          passed: result.success || result.result === 'passed',
          result,
        });
      } catch (error) {
        results.push({
          name: scenario.name,
          passed: false,
          error: error.message,
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SCENARIO TEST SUMMARY');
    console.log('='.repeat(50));

    const passed = results.filter(r => r.passed).length;
    console.log(`✅ Passed: ${passed}/${results.length}`);

    results.forEach((r) => {
      const icon = r.passed ? '✅' : '❌';
      console.log(`   ${icon} ${r.name}`);
    });

    return results;
  }
}

// Export for use in other files
module.exports = { SimpleUITester };

// Example usage if run directly
if (require.main === module) {
  async function runExamples() {
    const tester = new SimpleUITester();

    console.log('🚀 MCP UI Probe - Simple Examples\n');

    // Example 1: Quick test with single instruction
    console.log('Example 1: Quick Test');
    console.log('-------------------------');
    try {
      await tester.quickTest('Test signup form on example.com');
    } catch (error) {
      console.log('Note: Replace example.com with your actual website\n');
    }

    // Example 2: Specific goal and URL
    console.log('\nExample 2: Specific Test');
    console.log('-------------------------');
    await tester.test(
      'Check if the contact form accepts messages',
      'https://example.com/contact'
    );

    // Example 3: Multiple scenarios
    console.log('\nExample 3: Test Scenarios');
    console.log('-------------------------');
    await tester.testScenarios([
      {
        name: 'User Registration',
        goal: 'Create a new user account',
        url: 'https://example.com/signup',
      },
      {
        name: 'Password Reset',
        goal: 'Reset password using email',
        url: 'https://example.com/forgot-password',
      },
      {
        name: 'Search Function',
        goal: 'Search for "test" and verify results appear',
        url: 'https://example.com',
      },
    ]);
  }

  runExamples().catch(console.error);
}

/**
 * USAGE IN YOUR OWN CODE:
 *
 * const { SimpleUITester } = require('./simple-client');
 *
 * const tester = new SimpleUITester();
 *
 * // Test with natural language
 * await tester.test('Sign up for an account', 'https://mysite.com');
 *
 * // Or use quick test format
 * await tester.quickTest('Test login on mysite.com');
 */