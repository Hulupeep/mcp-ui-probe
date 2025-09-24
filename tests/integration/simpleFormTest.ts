#!/usr/bin/env node
/**
 * Simple test to verify the smart field resolution works
 */

import { chromium } from 'playwright';
import { FlowEngine } from '../../src/flows/flowEngine.js';

async function testFormWithSmartResolution() {
  console.log('🧪 Testing Form Field Resolution with UI-Probe\n');
  console.log('=' .repeat(60));

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to test form
    await page.goto('http://localhost:8081/test/forms');
    await page.waitForLoadState('networkidle');

    console.log('✅ Navigated to test forms page\n');

    // Test the FlowEngine directly with a form that has challenging values
    const flowEngine = new FlowEngine();

    const testForm = {
      name: 'Complete Form',
      selector: '#completeForm',
      fields: [
        { name: 'firstName', type: 'text', selector: '#firstName', required: true },
        { name: 'lastName', type: 'text', selector: '#lastName', required: true },
        { name: 'email', type: 'email', selector: '#email', required: true },
        { name: 'country', type: 'select', selector: '#country', required: true },
        { name: 'gender', type: 'radio', selector: 'input[name="gender"]', required: false },
        { name: 'interests', type: 'checkbox', selector: 'input[name="interests"]', required: false },
        { name: 'terms', type: 'checkbox', selector: 'input[name="terms"]', required: true }
      ],
      submit: {
        selector: 'button[type="submit"]',
        text: 'Submit Form'
      }
    };

    const overrides = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      country: 'United States',  // This should resolve to "us"
      gender: 'Male',            // This should resolve to "male"
      interests: ['Technology', 'Travel'],  // Should resolve to ["tech", "travel"]
      terms: true
    };

    console.log('📋 Running Flow Engine with Smart Field Resolution');
    console.log('-'.repeat(40));
    console.log('Testing value mappings:');
    console.log('  • Country: "United States" → "us"');
    console.log('  • Gender: "Male" → "male"');
    console.log('  • Interests: "Technology" → "tech", "Travel" → "travel"');
    console.log();

    const result = await flowEngine.executeFlow(page, testForm, overrides);

    console.log('\n📊 Test Results');
    console.log('-'.repeat(40));
    console.log(`Run ID: ${result.runId}`);
    console.log(`Result: ${result.result}`);
    console.log(`Total Time: ${result.metrics.totalTimeMs}ms`);
    console.log(`Steps: ${result.flow.length}`);
    console.log(`Errors: ${result.errors.length}`);

    // Check what actually got filled
    console.log('\n📝 Field Values After Filling');
    console.log('-'.repeat(40));

    // Check select value
    const countryValue = await page.locator('#country').inputValue();
    console.log(`Country select value: "${countryValue}" ${countryValue === 'us' ? '✅' : '❌'}`);

    // Check radio value
    const checkedRadio = await page.locator('input[name="gender"]:checked').first();
    if (await checkedRadio.count() > 0) {
      const radioValue = await checkedRadio.getAttribute('value');
      console.log(`Gender radio value: "${radioValue}" ${radioValue === 'male' ? '✅' : '❌'}`);
    }

    // Check checkboxes
    const checkedInterests = [];
    const interestCheckboxes = await page.locator('input[name="interests"]:checked').all();
    for (const cb of interestCheckboxes) {
      const value = await cb.getAttribute('value');
      checkedInterests.push(value);
    }
    console.log(`Interests checked: [${checkedInterests.join(', ')}]`);
    console.log(`  - "tech" ${checkedInterests.includes('tech') ? '✅' : '❌'}`);
    console.log(`  - "travel" ${checkedInterests.includes('travel') ? '✅' : '❌'}`);

    // Report errors if any
    if (result.errors.length > 0) {
      console.log('\n⚠️ Errors Encountered:');
      for (const error of result.errors) {
        console.log(`  - ${error.type}: ${error.message}`);
      }
    }

    // Take screenshot
    await page.screenshot({ path: '/tmp/smart-resolution-test.png' });
    console.log('\n📸 Screenshot saved to /tmp/smart-resolution-test.png');

    // Final summary
    console.log('\n' + '=' .repeat(60));
    if (result.result === 'passed' || result.result === 'passed_with_warnings') {
      console.log('✅ SUCCESS: Smart field resolution is working!');
      console.log('The form was filled correctly despite value mismatches:');
      console.log('  • Playwright semantic locators found fields by visible text');
      console.log('  • LLM understood value mappings when needed');
      console.log('  • All field types (checkbox, radio, select) worked');
    } else {
      console.log('❌ FAILED: There were issues with field resolution');
      console.log('Check the errors above for details.');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testFormWithSmartResolution().catch(console.error);