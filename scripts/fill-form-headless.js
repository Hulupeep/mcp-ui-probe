import { chromium } from 'playwright';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

(async () => {
  // Respect the HEADLESS environment variable, default to true
  const isHeadless = process.env.HEADLESS !== 'false';

  console.log(`🤖 Running in ${isHeadless ? 'HEADLESS' : 'HEADED'} mode (HEADLESS env var: ${process.env.HEADLESS})`);

  const browser = await chromium.launch({
    headless: isHeadless,  // Use environment variable
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
    const selectExists = await page.$('select');
    if (selectExists) {
      const selectId = await selectExists.getAttribute('id');
      if (selectId) {
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

    // Take a screenshot before submitting
    await page.screenshot({
      path: 'scripts/form-filled-headless.png',
      fullPage: true
    });
    console.log('\n📸 Screenshot saved: scripts/form-filled-headless.png');

    // Find and click the submit button
    console.log('\n🎯 Looking for submit button...');
    const submitButton = await page.$('button[type="submit"]') ||
                        await page.$('button:has-text("Submit")') ||
                        await page.$('input[type="submit"]') ||
                        await page.$('#completeForm button');

    if (submitButton) {
      console.log('✓ Submit button found, clicking...');
      await submitButton.click();

      // Wait for response
      await page.waitForTimeout(2000);

      // Check the result
      const actualResult = await page.$eval('#actualResult', el => el.textContent).catch(() => null);
      if (actualResult) {
        console.log(`\n📊 Result: ${actualResult}`);
      }

      // Take a screenshot after submitting
      await page.screenshot({
        path: 'scripts/form-submitted-headless.png',
        fullPage: true
      });
      console.log('📸 Post-submission screenshot: scripts/form-submitted-headless.png');

      console.log('\n✅ Form filled and submitted successfully!');
    } else {
      console.log('⚠️ Submit button not found');
    }

  } catch (error) {
    console.error('\n❌ Error occurred:', error.message);
    await page.screenshot({
      path: 'scripts/form-error-headless.png',
      fullPage: true
    });
    console.log('📸 Error screenshot saved: scripts/form-error-headless.png');
  } finally {
    await browser.close();
    console.log('🏁 Browser closed');
  }
})();