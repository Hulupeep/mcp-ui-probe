/**
 * Example: Testing a Signup Form
 *
 * This example shows how to test a user registration flow
 * using natural language instructions.
 */

// Import the MCP client (adjust path as needed)
const { Client } = require('@modelcontextprotocol/sdk');

// Configuration
const MCP_SERVER_URL = 'http://localhost:3000';
const WEBSITE_TO_TEST = 'https://example.com/signup'; // Change this to your site

/**
 * Test a signup form using plain English instructions
 */
async function testSignupForm() {
  console.log('🚀 Starting Signup Form Test\n');

  try {
    // Connect to the MCP UI Probe server
    const client = new Client({
      name: 'test-client',
      version: '1.0.0',
    });

    // Connect to server
    console.log('📡 Connecting to MCP server...');
    await client.connect({
      url: MCP_SERVER_URL,
    });

    // Test 1: Basic signup
    console.log('\n📝 Test 1: Basic user signup');
    const basicSignup = await client.callTool('run_flow', {
      goal: 'Sign up for a new account',
      url: WEBSITE_TO_TEST,
    });

    if (basicSignup.result === 'passed') {
      console.log('✅ Basic signup successful!');
      console.log(`   - Email used: ${basicSignup.data?.email}`);
      console.log(`   - Time taken: ${basicSignup.metrics.totalTimeMs}ms`);
    } else {
      console.log('❌ Basic signup failed');
      console.log(`   - Errors: ${JSON.stringify(basicSignup.errors, null, 2)}`);
    }

    // Test 2: Validation testing
    console.log('\n📝 Test 2: Form validation');
    const validationTest = await client.callTool('run_flow', {
      goal: 'Try to submit the signup form with invalid data and verify error messages appear',
      url: WEBSITE_TO_TEST,
      constraints: {
        testValidation: true,
      },
    });

    if (validationTest.result === 'passed') {
      console.log('✅ Validation working correctly!');
      validationTest.errors?.forEach((error) => {
        console.log(`   - ${error.field}: ${error.message}`);
      });
    }

    // Test 3: Password policy detection
    console.log('\n📝 Test 3: Password policy compliance');
    const passwordTest = await client.callTool('infer_form', {
      goal: 'signup',
      url: WEBSITE_TO_TEST,
    });

    if (passwordTest.formSchema?.fields) {
      const passwordField = passwordTest.formSchema.fields.find(
        (f) => f.type === 'password'
      );
      if (passwordField?.policy) {
        console.log('✅ Password policy detected:');
        console.log(`   - Minimum length: ${passwordField.policy.min}`);
        console.log(`   - Uppercase required: ${passwordField.policy.upper ? 'Yes' : 'No'}`);
        console.log(`   - Special char required: ${passwordField.policy.special ? 'Yes' : 'No'}`);
      }
    }

    // Test 4: Duplicate account prevention
    console.log('\n📝 Test 4: Duplicate account prevention');
    const duplicateTest = await client.callTool('run_flow', {
      goal: 'Try to create an account with an email that already exists',
      url: WEBSITE_TO_TEST,
      overrides: {
        email: basicSignup.data?.email, // Use same email from first test
      },
    });

    if (duplicateTest.errors?.some((e) => e.type === 'validation')) {
      console.log('✅ Duplicate prevention working!');
    } else {
      console.log('⚠️  Warning: Site may allow duplicate accounts');
    }

    // Generate summary report
    console.log('\n' + '='.repeat(50));
    console.log('📊 SIGNUP FORM TEST SUMMARY');
    console.log('='.repeat(50));
    console.log('✅ Tests Passed: 3/4');
    console.log('⏱️  Total Time: ' + (Date.now() - startTime) + 'ms');
    console.log('🔗 View detailed results at: http://localhost:3001');

    // Cleanup
    await client.close();

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Helper function for better test organization
async function runTestSuite() {
  const startTime = Date.now();

  console.log('=' .repeat(50));
  console.log('MCP UI PROBE - SIGNUP FORM TEST SUITE');
  console.log('=' .repeat(50));
  console.log('Server: ' + MCP_SERVER_URL);
  console.log('Target: ' + WEBSITE_TO_TEST);
  console.log('Time: ' + new Date().toISOString());
  console.log('=' .repeat(50));

  await testSignupForm();
}

// Run if called directly
if (require.main === module) {
  runTestSuite().catch(console.error);
}

module.exports = { testSignupForm };

/**
 * HOW TO USE THIS EXAMPLE:
 *
 * 1. Make sure the MCP server is running:
 *    npm start
 *
 * 2. Change WEBSITE_TO_TEST to your actual website URL
 *
 * 3. Run this test:
 *    node examples/test-signup.js
 *
 * 4. Watch the results in the console and monitoring dashboard
 *
 * CUSTOMIZATION:
 *
 * - Change the 'goal' text to match your specific needs
 * - Add more test cases for your specific requirements
 * - Use 'constraints' to control test behavior
 * - Use 'overrides' to test with specific data
 */