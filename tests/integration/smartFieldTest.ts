#!/usr/bin/env node
import { chromium } from 'playwright';
import { SmartFieldResolver } from '../../src/utils/smartFieldResolver.js';

async function testSmartFieldResolution() {
  console.log('🧪 Testing Smart Field Resolution for ALL form fields...\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to test forms page
    await page.goto('http://localhost:8081/test/forms');
    await page.waitForLoadState('networkidle');

    console.log('✅ Navigated to test forms page\n');

    // Initialize resolver
    const resolver = new SmartFieldResolver();

    // Test 1: Checkbox Resolution
    console.log('📋 Test 1: Smart Checkbox Resolution');
    console.log('----------------------------------');

    // Using Playwright semantic locator approach
    const techCheckbox = page.getByRole('checkbox', { name: 'Technology' });
    if (await techCheckbox.count() > 0) {
      await techCheckbox.check();
      console.log('✅ Found checkbox using getByRole');
    } else {
      // Fallback to smart resolver
      const locators = await resolver.resolveField(page, 'checkbox', 'interests', 'Technology');
      if (locators.length > 0) {
        await locators[0].check();
        console.log('✅ Found checkbox using smart resolver');
      } else {
        console.log('❌ Could not find Technology checkbox');
      }
    }

    // Test 2: Radio Button Resolution
    console.log('\n📋 Test 2: Smart Radio Button Resolution');
    console.log('---------------------------------------');

    // Test with "Male" radio button - use exact match
    const maleRadio = page.getByRole('radio', { name: 'Male', exact: true });
    if (await maleRadio.count() > 0) {
      await maleRadio.check();
      console.log('✅ Found radio button using getByRole with exact match');
    } else {
      const locators = await resolver.resolveField(page, 'radio', 'gender', 'Male');
      if (locators.length > 0) {
        await locators[0].check();
        console.log('✅ Found radio button using smart resolver');
      } else {
        console.log('❌ Could not find Male radio button');
      }
    }

    // Test 3: Select/Dropdown Resolution
    console.log('\n📋 Test 3: Smart Select Option Resolution');
    console.log('----------------------------------------');

    // Test with "United States" option
    const countrySelect = page.locator('select[name="country"]');
    if (await countrySelect.count() > 0) {
      // Try semantic approach
      try {
        await countrySelect.selectOption({ label: 'United States' });
        console.log('✅ Selected option using label');
      } catch {
        // Try smart resolver
        const resolvedValue = await resolver.resolveSelectOption(page, 'country', 'United States');
        if (resolvedValue) {
          await countrySelect.selectOption(resolvedValue);
          console.log(`✅ Selected option using resolved value: ${resolvedValue}`);
        } else {
          console.log('❌ Could not resolve United States option');
        }
      }
    }

    // Test 4: Multiple checkboxes with value mismatches
    console.log('\n📋 Test 4: Multiple Checkbox Resolution');
    console.log('--------------------------------------');

    const checkboxLabels = ['Sports', 'Music', 'Technology', 'Travel'];
    let checkedCount = 0;

    for (const label of checkboxLabels) {
      // Try semantic locator first
      const checkbox = page.getByLabel(label).and(page.locator('input[type="checkbox"]'));
      if (await checkbox.count() > 0) {
        await checkbox.check();
        checkedCount++;
        console.log(`✅ Checked ${label} using getByLabel`);
      } else {
        // Try smart resolver
        const locators = await resolver.resolveField(page, 'checkbox', 'interests', label);
        if (locators.length > 0) {
          await locators[0].check();
          checkedCount++;
          console.log(`✅ Checked ${label} using smart resolver`);
        } else {
          console.log(`❌ Could not find ${label} checkbox`);
        }
      }
    }
    console.log(`\nTotal checked: ${checkedCount}/${checkboxLabels.length}`);

    // Test 5: Verify actual HTML structure
    console.log('\n📋 Test 5: Analyzing Form Field Structure');
    console.log('----------------------------------------');

    // Analyze checkboxes
    const checkboxes = await page.locator('input[type="checkbox"][name="interests"]').all();
    console.log(`\nCheckboxes (${checkboxes.length} found):`);
    for (const cb of checkboxes) {
      const value = await cb.getAttribute('value');
      const isChecked = await cb.isChecked();
      console.log(`  value="${value}" - ${isChecked ? '✅ Checked' : '⬜ Unchecked'}`);
    }

    // Analyze radio buttons
    const radios = await page.locator('input[type="radio"][name="gender"]').all();
    console.log(`\nRadio Buttons (${radios.length} found):`);
    for (const radio of radios) {
      const value = await radio.getAttribute('value');
      const isChecked = await radio.isChecked();
      console.log(`  value="${value}" - ${isChecked ? '🔘 Selected' : '⭕ Not selected'}`);
    }

    // Analyze select options
    const options = await page.locator('select[name="country"] option').all();
    console.log(`\nSelect Options (${options.length} found):`);
    for (const option of options) {
      const value = await option.getAttribute('value');
      const text = await option.textContent();
      const isSelected = await option.evaluate((el) => (el as HTMLOptionElement).selected);
      console.log(`  value="${value}" text="${text}" ${isSelected ? '✅ Selected' : ''}`);
    }

    // Test 6: Test Playwright's advanced selectors
    console.log('\n📋 Test 6: Testing Playwright Semantic Selectors');
    console.log('-----------------------------------------------');

    // getByRole examples
    const submitButton = page.getByRole('button', { name: /submit/i });
    console.log(`Submit button found: ${await submitButton.count() > 0 ? '✅' : '❌'}`);

    const emailField = page.getByRole('textbox', { name: /email/i });
    console.log(`Email field found: ${await emailField.count() > 0 ? '✅' : '❌'}`);

    // getByLabel examples
    const firstNameField = page.getByLabel('First Name');
    console.log(`First Name field found: ${await firstNameField.count() > 0 ? '✅' : '❌'}`);

    const termsCheckbox = page.getByLabel(/terms and conditions/i);
    console.log(`Terms checkbox found: ${await termsCheckbox.count() > 0 ? '✅' : '❌'}`);

    // Take screenshot of the result
    await page.screenshot({ path: '/tmp/smart-field-test-result.png' });
    console.log('\n📸 Screenshot saved to /tmp/smart-field-test-result.png');

    console.log('\n✅ All smart field resolution tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testSmartFieldResolution().catch(console.error);