import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    headless: false, // Set to false to see the browser
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console messages for debugging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text());
    }
  });

  try {
    console.log('🚀 Navigating to forms page...');
    await page.goto('http://localhost:8090/test/forms', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for the form to be visible
    await page.waitForSelector('#completeForm', { timeout: 5000 });
    console.log('✅ Form found!');

    console.log('\n📝 Filling out the form fields...');

    // Fill in the First Name field
    await page.fill('#firstName', 'John');
    console.log('  ✓ Filled First Name: John');

    // Fill in the Last Name field
    await page.fill('#lastName', 'Smith');
    console.log('  ✓ Filled Last Name: Smith');

    // Fill in the Email field
    await page.fill('#email', 'john.smith@example.com');
    console.log('  ✓ Filled Email: john.smith@example.com');

    // Fill in the Phone field
    await page.fill('#phone', '+1 (555) 123-4567');
    console.log('  ✓ Filled Phone: +1 (555) 123-4567');

    // Fill in the Birth Date field
    await page.fill('#birthDate', '1990-01-15');
    console.log('  ✓ Filled Birth Date: 1990-01-15');

    // Check if there are more fields (select dropdowns, checkboxes, etc.)
    // Try to find and fill a select dropdown if it exists
    const selectExists = await page.$('select');
    if (selectExists) {
      const selectId = await selectExists.getAttribute('id');
      if (selectId) {
        // Select the second option (first non-default option)
        await page.selectOption(`#${selectId}`, { index: 1 });
        const selectedText = await page.$eval(`#${selectId}`, el => el.options[el.selectedIndex].text);
        console.log(`  ✓ Selected option: ${selectedText}`);
      }
    }

    // Check for textarea
    const textareaExists = await page.$('textarea');
    if (textareaExists) {
      const textareaId = await textareaExists.getAttribute('id');
      if (textareaId) {
        await page.fill(`#${textareaId}`, 'This is a test message for the form submission.');
        console.log('  ✓ Filled textarea with test message');
      }
    }

    // Check for checkboxes
    const checkboxes = await page.$$('input[type="checkbox"]');
    for (const checkbox of checkboxes) {
      const checkboxId = await checkbox.getAttribute('id');
      if (checkboxId) {
        await page.check(`#${checkboxId}`);
        const label = await page.$eval(`label[for="${checkboxId}"]`, el => el.textContent).catch(() => checkboxId);
        console.log(`  ✓ Checked: ${label}`);
      }
    }

    // Take a screenshot before submitting
    await page.screenshot({
      path: 'scripts/form-filled-correct.png',
      fullPage: true
    });
    console.log('\n📸 Screenshot saved: scripts/form-filled-correct.png');

    // Find and click the submit button
    console.log('\n🎯 Looking for submit button...');

    // Try different selectors for the submit button
    const submitButton = await page.$('button[type="submit"]') ||
                        await page.$('button:has-text("Submit")') ||
                        await page.$('input[type="submit"]') ||
                        await page.$('#completeForm button');

    if (submitButton) {
      console.log('✓ Submit button found, clicking...');
      await submitButton.click();

      // Wait for response or navigation
      await page.waitForTimeout(2000);

      // Check the result
      const currentUrl = page.url();
      const expectedResult = await page.$eval('#expectedResult', el => el.textContent).catch(() => null);
      const actualResult = await page.$eval('#actualResult', el => el.textContent).catch(() => null);

      console.log('\n📊 Form Submission Results:');
      console.log(`  Current URL: ${currentUrl}`);
      if (expectedResult) {
        console.log(`  Expected: ${expectedResult}`);
      }
      if (actualResult) {
        console.log(`  Actual: ${actualResult}`);
      }

      // Take a screenshot after submitting
      await page.screenshot({
        path: 'scripts/form-submitted-correct.png',
        fullPage: true
      });
      console.log('\n📸 Post-submission screenshot: scripts/form-submitted-correct.png');

      console.log('\n✅ Form filled and submitted successfully!');
    } else {
      console.log('⚠️ Submit button not found, form filled but not submitted');
    }

    // Keep browser open for 3 seconds to see the result
    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('\n❌ Error occurred:', error.message);

    // Take error screenshot
    await page.screenshot({
      path: 'scripts/form-error-correct.png',
      fullPage: true
    });
    console.log('📸 Error screenshot saved: scripts/form-error-correct.png');

    // Log the error details
    console.error('Error details:', error);
  } finally {
    await browser.close();
    console.log('\n🏁 Browser closed');
  }
})();