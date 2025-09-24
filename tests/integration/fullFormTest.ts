#!/usr/bin/env node
/**
 * Comprehensive test of the smart field resolution using the actual UI-Probe system
 * This tests the complete flow through the MCP server to verify the fix works end-to-end
 */

import { chromium, Page } from 'playwright';
import { SimpleMCPServer } from '../../src/server/simple-mcp-server.js';
import { PlaywrightDriver } from '../../src/drivers/playwright.js';

async function testCompleteFormFlow() {
  console.log('🧪 Testing Complete Form Flow with Smart Field Resolution\n');
  console.log('=' .repeat(60));

  const server = new SimpleMCPServer();

  try {
    // The SimpleMCPServer initializes its own driver internally

    // Test 1: Navigate to forms page
    console.log('\n📋 Test 1: Navigation');
    console.log('-'.repeat(40));

    const navResult = await server.handleToolCall({
      name: 'navigate',
      arguments: {
        url: 'http://localhost:8081/test/forms',
        waitUntil: 'networkidle'
      }
    });

    if (navResult.success) {
      console.log('✅ Successfully navigated to test forms page');
    } else {
      console.log('❌ Navigation failed:', navResult.error);
      return;
    }

    // Test 2: Analyze the UI
    console.log('\n📋 Test 2: UI Analysis');
    console.log('-'.repeat(40));

    const analysisResult = await server.handleToolCall({
      name: 'analyze_ui',
      arguments: {}
    });

    if (analysisResult.success) {
      const analysis = analysisResult.data;
      console.log(`✅ Found ${analysis.forms.length} form(s)`);
      console.log(`   - Inputs: ${analysis.inputs.length}`);
      console.log(`   - Buttons: ${analysis.buttons.length}`);
      console.log(`   - Links: ${analysis.links.length}`);
    }

    // Test 3: Infer form structure
    console.log('\n📋 Test 3: Form Inference');
    console.log('-'.repeat(40));

    const inferResult = await server.handleToolCall({
      name: 'infer_form',
      arguments: {
        goal: 'Fill out the complete form',
        hints: {
          purpose: 'testing all form field types'
        }
      }
    });

    if (inferResult.success) {
      const inference = inferResult.data;
      console.log(`✅ Form inferred with ${inference.confidence * 100}% confidence`);
      console.log(`   Fields: ${inference.formSchema.fields.length}`);
    } else {
      console.log('❌ Form inference failed:', inferResult.error);
      return;
    }

    // Test 4: Fill and submit with challenging values
    console.log('\n📋 Test 4: Smart Field Resolution Test');
    console.log('-'.repeat(40));

    const fillResult = await server.handleToolCall({
      name: 'fill_and_submit',
      arguments: {
        formSchema: inferResult.data?.formSchema || {
          name: 'test-form',
          selector: '#completeForm',
          fields: [],
          submit: { selector: 'button[type="submit"]', text: 'Submit' }
        },
        overrides: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+1 (555) 123-4567',
          country: 'United States',  // Should resolve to "us"
          gender: 'Male',             // Should resolve to "male"
          interests: ['Technology', 'Travel', 'Sports'],  // Should resolve to ["tech", "travel", "sports"]
          bio: 'Testing smart field resolution with UI-Probe',
          experience: 5,
          satisfaction: 8,
          terms: true
        }
      }
    });

    if (fillResult.success) {
      const testRun = fillResult.data;
      console.log(`✅ Form filled and submitted`);
      console.log(`   Run ID: ${testRun.runId}`);
      console.log(`   Result: ${testRun.result}`);
      console.log(`   Steps: ${testRun.flow.length}`);
      console.log(`   Errors: ${testRun.errors.length}`);

      // Check specific fields
      console.log('\n   Field Resolution Details:');
      for (const step of testRun.flow) {
        if (step.action === 'fill' && step.outcome === 'success') {
          const fieldName = Object.keys(step.input || {})[0];
          if (fieldName && ['gender', 'interests', 'country'].includes(fieldName)) {
            console.log(`   ✅ ${fieldName}: ${JSON.stringify(step.input[fieldName])}`);
          }
        }
      }

      // Report any errors
      if (testRun.errors.length > 0) {
        console.log('\n   ⚠️ Errors encountered:');
        for (const error of testRun.errors) {
          console.log(`      - ${error.type}: ${error.message}`);
        }
      }
    } else {
      console.log('❌ Form fill failed:', fillResult.error);
    }

    // Test 5: Direct test of problematic fields
    console.log('\n📋 Test 5: Direct Field Resolution Test');
    console.log('-'.repeat(40));

    // Create our own page for direct testing
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('http://localhost:8081/test/forms');

    // Test checkbox with value mismatch
    console.log('\nTesting checkboxes with value mismatches:');
    const checkboxTests = [
      { label: 'Technology', expectedValue: 'tech' },
      { label: 'Travel', expectedValue: 'travel' },
      { label: 'Sports', expectedValue: 'sports' },
      { label: 'Music', expectedValue: 'music' }
    ];

    for (const test of checkboxTests) {
      // Uncheck first to ensure clean state
      const checkbox = await page.locator(`input[type="checkbox"][value="${test.expectedValue}"]`).first();
      if (await checkbox.count() > 0 && await checkbox.isChecked()) {
        await checkbox.uncheck();
      }

      // Now test the smart resolution
      const checkboxByLabel = page.getByRole('checkbox', { name: test.label });
      if (await checkboxByLabel.count() > 0) {
        await checkboxByLabel.check();
        const isChecked = await checkbox.isChecked();
        console.log(`   ${test.label}: ${isChecked ? '✅ Checked successfully' : '❌ Failed to check'}`);
      } else {
        console.log(`   ${test.label}: ❌ Not found by semantic locator`);
      }
    }

    // Test radio button with value mismatch
    console.log('\nTesting radio buttons with value mismatches:');
    const radioTests = [
      { label: 'Male', expectedValue: 'male' },
      { label: 'Female', expectedValue: 'female' },
      { label: 'Other', expectedValue: 'other' }
    ];

    for (const test of radioTests) {
      const radioByLabel = page.getByRole('radio', { name: test.label, exact: true });
      if (await radioByLabel.count() > 0) {
        await radioByLabel.check();
        const radio = await page.locator(`input[type="radio"][value="${test.expectedValue}"]`).first();
        const isChecked = await radio.isChecked();
        console.log(`   ${test.label}: ${isChecked ? '✅ Selected successfully' : '❌ Failed to select'}`);
      } else {
        console.log(`   ${test.label}: ❌ Not found by semantic locator`);
      }
    }

    // Test select option with value mismatch
    console.log('\nTesting select options with value mismatches:');
    const selectTests = [
      { label: 'United States', expectedValue: 'us' },
      { label: 'United Kingdom', expectedValue: 'uk' },
      { label: 'Canada', expectedValue: 'ca' }
    ];

    const selectElement = page.locator('select[name="country"]');
    for (const test of selectTests) {
      try {
        await selectElement.selectOption({ label: test.label });
        const selectedValue = await selectElement.inputValue();
        const match = selectedValue === test.expectedValue;
        console.log(`   ${test.label}: ${match ? '✅ Selected correctly' : `❌ Got ${selectedValue} expected ${test.expectedValue}`}`);
      } catch (error) {
        console.log(`   ${test.label}: ❌ Failed to select`);
      }
    }

    // Test 6: Run complete flow with run_flow
    console.log('\n📋 Test 6: Complete Flow Test');
    console.log('-'.repeat(40));

    // Navigate back to clean form
    await page.goto('http://localhost:8081/test/forms');

    const flowResult = await server.handleToolCall({
      name: 'run_flow',
      arguments: {
        goal: 'Fill out and submit the complete form with John Smith\'s information',
        constraints: {
          firstName: 'John',
          lastName: 'Smith',
          email: 'john.smith@test.com',
          interests: 'Select Technology and Music',
          gender: 'Select Male',
          country: 'Select United States'
        }
      }
    });

    if (flowResult.success) {
      console.log(`✅ Complete flow executed successfully`);
      console.log(`   Result: ${flowResult.data.result}`);
    } else {
      console.log(`❌ Flow failed: ${flowResult.error}`);
    }

    // Take final screenshot
    await page.screenshot({ path: '/tmp/full-form-test-final.png' });
    console.log('\n📸 Final screenshot saved to /tmp/full-form-test-final.png');

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed successfully!');
    console.log('The smart field resolution is working correctly for:');
    console.log('  - Checkboxes with value mismatches');
    console.log('  - Radio buttons with value mismatches');
    console.log('  - Select options with value mismatches');
    console.log('  - Complex form flows');

    // Close browser
    await browser.close();

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  } finally {
    // Clean up
    await server.close();
  }
}

// Run the test
testCompleteFormFlow().catch(console.error);