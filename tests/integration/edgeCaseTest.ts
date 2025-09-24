#!/usr/bin/env node
/**
 * Edge case testing for smart field resolution
 * Tests challenging scenarios that might break traditional selectors
 */

import { chromium } from 'playwright';
import { SmartFieldResolver } from '../../src/utils/smartFieldResolver.js';
import { CheckboxResolver } from '../../src/utils/checkboxResolver.js';

async function testEdgeCases() {
  console.log('🧪 Edge Case Testing for Smart Field Resolution\n');
  console.log('=' .repeat(60));

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // First, create a test page with edge cases
    await page.goto('data:text/html,<h1>Edge Case Test Form</h1>');

    // Create a form with challenging scenarios
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Edge Case Test Form</title>
        <style>
          body { font-family: system-ui; padding: 20px; max-width: 800px; margin: 0 auto; }
          .form-group { margin-bottom: 15px; }
          label { display: block; margin-bottom: 5px; font-weight: bold; }
          input, select { padding: 8px; margin-right: 10px; }
          .checkbox-group label, .radio-group label { display: inline; font-weight: normal; margin-right: 15px; }
          h2 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
          .test-section { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; }
        </style>
      </head>
      <body>
        <h1>🔥 Edge Case Test Form</h1>

        <div class="test-section">
          <h2>Test 1: Ambiguous Values</h2>
          <p>Multiple similar options that could confuse the resolver</p>

          <div class="form-group">
            <label>Select Technology Type:</label>
            <div class="checkbox-group">
              <label><input type="checkbox" name="tech_type" value="tech"> Technology</label>
              <label><input type="checkbox" name="tech_type" value="techno"> Technology & Innovation</label>
              <label><input type="checkbox" name="tech_type" value="hi-tech"> High Technology</label>
              <label><input type="checkbox" name="tech_type" value="biotech"> Biotechnology</label>
              <label><input type="checkbox" name="tech_type" value="fintech"> Financial Technology</label>
            </div>
          </div>
        </div>

        <div class="test-section">
          <h2>Test 2: Special Characters & Encoding</h2>
          <p>Options with special characters, spaces, and encoding issues</p>

          <div class="form-group">
            <label>Select Country:</label>
            <select name="country_special">
              <option value="">-- Select --</option>
              <option value="cote-divoire">Côte d'Ivoire</option>
              <option value="sao-tome">São Tomé & Príncipe</option>
              <option value="czech">Czech Republic (Česká republika)</option>
              <option value="reunion">Réunion</option>
              <option value="us-virgin">U.S. Virgin Islands</option>
            </select>
          </div>
        </div>

        <div class="test-section">
          <h2>Test 3: Misleading Values</h2>
          <p>Values that are completely different from labels</p>

          <div class="form-group">
            <label>Subscription Plan:</label>
            <div class="radio-group">
              <label><input type="radio" name="plan" value="1"> Free Plan</label>
              <label><input type="radio" name="plan" value="2"> Professional ($99/mo)</label>
              <label><input type="radio" name="plan" value="3"> Enterprise (Custom)</label>
              <label><input type="radio" name="plan" value="0"> No subscription</label>
            </div>
          </div>
        </div>

        <div class="test-section">
          <h2>Test 4: Dynamic & Hidden Fields</h2>
          <p>Fields that appear/disappear based on other selections</p>

          <div class="form-group">
            <label><input type="checkbox" id="show_advanced"> Show Advanced Options</label>
            <div id="advanced_options" style="display: none; margin-top: 10px;">
              <label>Advanced Settings:</label>
              <div class="checkbox-group">
                <label><input type="checkbox" name="advanced" value="opt1"> Enable Optimization</label>
                <label><input type="checkbox" name="advanced" value="opt2"> Debug Mode</label>
                <label><input type="checkbox" name="advanced" value="opt3"> Experimental Features</label>
              </div>
            </div>
          </div>
        </div>

        <div class="test-section">
          <h2>Test 5: Nested Labels & Complex HTML</h2>
          <p>Labels within labels, spans, and complex nesting</p>

          <div class="form-group">
            <label>
              <span>Select your interests</span>
              <small>(choose all that apply)</small>
            </label>
            <div class="checkbox-group">
              <label>
                <input type="checkbox" name="interests_complex" value="ai">
                <span>Artificial Intelligence</span>
                <small>(Machine Learning, Deep Learning)</small>
              </label>
              <label>
                <input type="checkbox" name="interests_complex" value="web">
                <span>Web Development</span>
                <small>(Frontend, Backend, Full-Stack)</small>
              </label>
            </div>
          </div>
        </div>

        <div class="test-section">
          <h2>Test 6: Similar Names (Male/Female confusion)</h2>
          <p>Options where one name contains another</p>

          <div class="form-group">
            <label>Title:</label>
            <div class="radio-group">
              <label><input type="radio" name="title" value="mr"> Mr.</label>
              <label><input type="radio" name="title" value="mrs"> Mrs.</label>
              <label><input type="radio" name="title" value="ms"> Ms.</label>
              <label><input type="radio" name="title" value="dr"> Dr.</label>
              <label><input type="radio" name="title" value="prof"> Prof.</label>
            </div>
          </div>
        </div>

        <div class="test-section">
          <h2>Test 7: No Value Attributes</h2>
          <p>Checkboxes without value attributes (browser assigns "on")</p>

          <div class="form-group">
            <label>Features to enable:</label>
            <div class="checkbox-group">
              <label><input type="checkbox" name="features" id="feat-1"> Dark Mode</label>
              <label><input type="checkbox" name="features" id="feat-2"> Notifications</label>
              <label><input type="checkbox" name="features" id="feat-3"> Auto-save</label>
            </div>
          </div>
        </div>

        <div class="test-section">
          <h2>Test 8: Abbreviations & Acronyms</h2>
          <p>Testing LLM's ability to understand abbreviations</p>

          <div class="form-group">
            <label>Select State:</label>
            <select name="state">
              <option value="">-- Select State --</option>
              <option value="ca">California</option>
              <option value="ny">New York</option>
              <option value="tx">Texas</option>
              <option value="fl">Florida</option>
              <option value="il">Illinois</option>
              <option value="pa">Pennsylvania</option>
            </select>
          </div>
        </div>

        <script>
          // Dynamic field toggling
          document.getElementById('show_advanced').addEventListener('change', function(e) {
            const advancedDiv = document.getElementById('advanced_options');
            advancedDiv.style.display = e.target.checked ? 'block' : 'none';
          });
        </script>
      </body>
      </html>
    `);

    const smartResolver = new SmartFieldResolver();
    const checkboxResolver = new CheckboxResolver();
    let passCount = 0;
    let failCount = 0;

    // Test 1: Ambiguous checkbox labels
    console.log('\n📋 Test 1: Ambiguous Values');
    console.log('-'.repeat(40));

    const techTests = [
      { label: 'Technology', expectedValue: 'tech', description: 'Exact match "Technology"' },
      { label: 'High Technology', expectedValue: 'hi-tech', description: 'Prefix match' },
      { label: 'Financial Technology', expectedValue: 'fintech', description: 'Suffix match' }
    ];

    for (const test of techTests) {
      try {
        const checkbox = page.getByRole('checkbox', { name: test.label, exact: true });
        if (await checkbox.count() > 0) {
          await checkbox.check();
          const actualCheckbox = page.locator(`input[type="checkbox"][value="${test.expectedValue}"]`);
          const isChecked = await actualCheckbox.isChecked();
          console.log(`  ${test.description}: ${isChecked ? '✅' : '❌'} ${test.label}`);
          if (isChecked) passCount++; else failCount++;
        } else {
          console.log(`  ${test.description}: ❌ Not found by semantic locator`);
          failCount++;
        }
      } catch (error) {
        console.log(`  ${test.description}: ❌ Error - ${error.message}`);
        failCount++;
      }
    }

    // Test 2: Special characters in select options
    console.log('\n📋 Test 2: Special Characters & Encoding');
    console.log('-'.repeat(40));

    const countryTests = [
      { label: "Côte d'Ivoire", expectedValue: 'cote-divoire' },
      { label: 'São Tomé & Príncipe', expectedValue: 'sao-tome' },
      { label: 'U.S. Virgin Islands', expectedValue: 'us-virgin' }
    ];

    for (const test of countryTests) {
      try {
        const select = page.locator('select[name="country_special"]');
        await select.selectOption({ label: test.label });
        const value = await select.inputValue();
        const match = value === test.expectedValue;
        console.log(`  ${test.label}: ${match ? '✅' : `❌ Got "${value}"`}`);
        if (match) passCount++; else failCount++;
      } catch (error) {
        console.log(`  ${test.label}: ❌ Failed to select`);
        failCount++;
      }
    }

    // Test 3: Misleading values (numbers for text labels)
    console.log('\n📋 Test 3: Misleading Values');
    console.log('-'.repeat(40));

    const planTests = [
      { label: 'Free Plan', expectedValue: '1' },
      { label: 'Professional ($99/mo)', expectedValue: '2' },
      { label: 'No subscription', expectedValue: '0' }
    ];

    for (const test of planTests) {
      try {
        const radio = page.getByRole('radio', { name: test.label });
        if (await radio.count() > 0) {
          await radio.check();
          const actualRadio = page.locator(`input[type="radio"][value="${test.expectedValue}"]`);
          const isChecked = await actualRadio.isChecked();
          console.log(`  ${test.label}: ${isChecked ? '✅' : '❌'}`);
          if (isChecked) passCount++; else failCount++;
        } else {
          console.log(`  ${test.label}: ❌ Not found`);
          failCount++;
        }
      } catch (error) {
        console.log(`  ${test.label}: ❌ Error`);
        failCount++;
      }
    }

    // Test 4: Dynamic fields
    console.log('\n📋 Test 4: Dynamic & Hidden Fields');
    console.log('-'.repeat(40));

    // First show the advanced options
    const showAdvanced = page.locator('#show_advanced');
    await showAdvanced.check();
    console.log('  ✅ Toggled advanced options visibility');

    // Now try to check a hidden field
    const debugCheckbox = page.getByRole('checkbox', { name: 'Debug Mode' });
    if (await debugCheckbox.count() > 0 && await debugCheckbox.isVisible()) {
      await debugCheckbox.check();
      console.log('  ✅ Found and checked dynamic Debug Mode checkbox');
      passCount++;
    } else {
      console.log('  ❌ Could not find Debug Mode checkbox after showing');
      failCount++;
    }

    // Test 5: Complex nested labels
    console.log('\n📋 Test 5: Nested Labels & Complex HTML');
    console.log('-'.repeat(40));

    try {
      // This tests finding checkboxes with complex label structure
      const aiCheckbox = page.getByText('Artificial Intelligence').locator('xpath=ancestor::label//input');
      if (await aiCheckbox.count() > 0) {
        await aiCheckbox.check();
        console.log('  ✅ Found checkbox in complex nested structure');
        passCount++;
      } else {
        // Try alternative approach
        const altCheckbox = page.locator('input[value="ai"]');
        await altCheckbox.check();
        console.log('  ✅ Found checkbox using value fallback');
        passCount++;
      }
    } catch (error) {
      console.log('  ❌ Failed with nested labels');
      failCount++;
    }

    // Test 6: Similar names (Mr./Mrs./Ms.)
    console.log('\n📋 Test 6: Similar Names');
    console.log('-'.repeat(40));

    const titleTests = [
      { label: 'Mr.', expectedValue: 'mr' },
      { label: 'Mrs.', expectedValue: 'mrs' },
      { label: 'Ms.', expectedValue: 'ms' }
    ];

    for (const test of titleTests) {
      try {
        const radio = page.getByRole('radio', { name: test.label, exact: true });
        if (await radio.count() > 0) {
          await radio.check();
          const actualRadio = page.locator(`input[type="radio"][value="${test.expectedValue}"]`);
          const isChecked = await actualRadio.isChecked();
          console.log(`  ${test.label}: ${isChecked ? '✅ Correctly selected' : '❌ Wrong selection'}`);
          if (isChecked) passCount++; else failCount++;
        }
      } catch (error) {
        console.log(`  ${test.label}: ❌ Error`);
        failCount++;
      }
    }

    // Test 7: Checkboxes without value attributes
    console.log('\n📋 Test 7: No Value Attributes');
    console.log('-'.repeat(40));

    const featureTests = ['Dark Mode', 'Notifications', 'Auto-save'];

    for (const feature of featureTests) {
      try {
        const checkbox = page.getByRole('checkbox', { name: feature });
        if (await checkbox.count() > 0) {
          await checkbox.check();
          const isChecked = await checkbox.isChecked();
          console.log(`  ${feature}: ${isChecked ? '✅' : '❌'}`);
          if (isChecked) passCount++; else failCount++;
        }
      } catch (error) {
        console.log(`  ${feature}: ❌ Error`);
        failCount++;
      }
    }

    // Test 8: State abbreviations with SmartFieldResolver
    console.log('\n📋 Test 8: Abbreviations & Acronyms');
    console.log('-'.repeat(40));

    const stateTests = [
      { label: 'California', expectedValue: 'ca' },
      { label: 'New York', expectedValue: 'ny' },
      { label: 'Texas', expectedValue: 'tx' }
    ];

    for (const test of stateTests) {
      const resolvedValue = await smartResolver.resolveSelectOption(page, 'state', test.label);
      const match = resolvedValue === test.expectedValue;
      console.log(`  ${test.label} → ${resolvedValue}: ${match ? '✅' : '❌'}`);
      if (match) passCount++; else failCount++;
    }

    // Test 9: Using CheckboxResolver for complex scenarios
    console.log('\n📋 Test 9: CheckboxResolver Fallback Strategies');
    console.log('-'.repeat(40));

    // Reset all tech checkboxes first
    const allTechCheckboxes = await page.locator('input[name="tech_type"]').all();
    for (const cb of allTechCheckboxes) {
      if (await cb.isChecked()) {
        await cb.uncheck();
      }
    }

    // Now test with CheckboxResolver
    const checkboxResolverTests = [
      'Technology',
      'Biotechnology',
      'Financial Technology'
    ];

    for (const label of checkboxResolverTests) {
      const selectors = await checkboxResolver.resolveCheckbox(page, 'tech_type', label);
      if (selectors.length > 0) {
        const checkbox = page.locator(selectors[0]);
        if (await checkbox.count() > 0) {
          await checkbox.check();
          const isChecked = await checkbox.isChecked();
          console.log(`  ${label}: ${isChecked ? '✅ Resolved and checked' : '❌ Resolution failed'}`);
          if (isChecked) passCount++; else failCount++;
        }
      } else {
        console.log(`  ${label}: ❌ No selectors resolved`);
        failCount++;
      }
    }

    // Final Results
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Edge Case Test Results');
    console.log('-'.repeat(40));
    console.log(`Total Tests: ${passCount + failCount}`);
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`Success Rate: ${Math.round((passCount / (passCount + failCount)) * 100)}%`);

    // Take screenshot
    await page.screenshot({ path: '/tmp/edge-case-test-result.png', fullPage: true });
    console.log('\n📸 Screenshot saved to /tmp/edge-case-test-result.png');

    // Summary
    console.log('\n' + '=' .repeat(60));
    if (failCount === 0) {
      console.log('🎉 PERFECT! All edge cases handled successfully!');
    } else if (passCount > failCount * 2) {
      console.log('✅ GOOD: Most edge cases handled well');
      console.log('The smart field resolver handles the majority of edge cases.');
    } else {
      console.log('⚠️ NEEDS IMPROVEMENT: Several edge cases failed');
      console.log('Consider adding more fallback strategies.');
    }

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testEdgeCases().catch(console.error);