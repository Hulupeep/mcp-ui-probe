#!/usr/bin/env node
import { chromium } from 'playwright';
import { CheckboxResolver } from '../../src/utils/checkboxResolver.js';

async function testCheckboxResolution() {
  console.log('🧪 Testing Checkbox Resolution...\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to test forms page
    await page.goto('http://localhost:8081/test/forms');
    await page.waitForLoadState('networkidle');

    console.log('✅ Navigated to test forms page');

    // Initialize resolver
    const resolver = new CheckboxResolver();

    // Test 1: Resolve checkbox for "Technology"
    console.log('\n📋 Test 1: Resolving "Technology" checkbox...');
    const techSelectors = await resolver.resolveCheckbox(page, 'interests', 'Technology');

    if (techSelectors.length > 0) {
      console.log(`✅ Found selector: ${techSelectors[0]}`);

      // Try to check it
      const checkbox = page.locator(techSelectors[0]).first();
      if (await checkbox.count() > 0) {
        await checkbox.check();
        console.log('✅ Successfully checked "Technology" checkbox');
      } else {
        console.log('❌ Could not find checkbox element');
      }
    } else {
      console.log('❌ Could not resolve "Technology" checkbox');
    }

    // Test 2: Resolve multiple checkboxes
    console.log('\n📋 Test 2: Resolving multiple checkboxes...');
    const multipleValues = ['Technology', 'Travel', 'Sports'];
    const multipleSelectors = await resolver.resolveCheckbox(page, 'interests', multipleValues);

    console.log(`Found ${multipleSelectors.length} selectors:`);
    for (const selector of multipleSelectors) {
      console.log(`  - ${selector}`);
    }

    // Try to check all of them
    let checkedCount = 0;
    for (const selector of multipleSelectors) {
      const checkbox = page.locator(selector).first();
      if (await checkbox.count() > 0 && !(await checkbox.isChecked())) {
        await checkbox.check();
        checkedCount++;
      }
    }
    console.log(`✅ Checked ${checkedCount} checkboxes`);

    // Test 3: Verify actual HTML structure
    console.log('\n📋 Test 3: Analyzing actual checkbox structure...');
    const checkboxes = await page.locator('input[type="checkbox"][name="interests"]').all();

    console.log(`Found ${checkboxes.length} checkboxes with name="interests":`);
    for (let i = 0; i < checkboxes.length; i++) {
      const checkbox = checkboxes[i];
      const value = await checkbox.getAttribute('value');
      const id = await checkbox.getAttribute('id');

      // Find associated label
      let labelText = 'Unknown';
      const parent = await checkbox.locator('xpath=..').first();
      if (await parent.count() > 0) {
        labelText = (await parent.textContent() || '').trim();
      }

      console.log(`  [${i}] value="${value}", id="${id}", label="${labelText}"`);
    }

    // Test 4: Test with actual form values
    console.log('\n📋 Test 4: Testing with actual value attributes...');
    const actualValues = [];
    for (const checkbox of checkboxes) {
      const value = await checkbox.getAttribute('value');
      if (value) actualValues.push(value);
    }

    console.log('Actual checkbox values:', actualValues);

    // Now try resolving with actual values
    if (actualValues.includes('tech')) {
      const techSelector = await resolver.resolveCheckbox(page, 'interests', 'tech');
      console.log(`Resolved 'tech' to: ${techSelector[0] || 'not found'}`);
    }

    // Take screenshot of the result
    await page.screenshot({ path: '/tmp/checkbox-test-result.png' });
    console.log('\n📸 Screenshot saved to /tmp/checkbox-test-result.png');

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testCheckboxResolution().catch(console.error);