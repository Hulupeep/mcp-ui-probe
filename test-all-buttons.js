import { chromium } from 'playwright';

async function testAllButtons() {
  console.log('Starting comprehensive button test with visible browser...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // Slow down actions so you can see them
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Test 1: Dynamic Content Page
    console.log('=== TESTING DYNAMIC CONTENT PAGE ===\n');
    await page.goto('http://localhost:8083/test/dynamic');
    console.log('Navigated to dynamic content page');
    await page.waitForLoadState('networkidle');

    // Get all buttons on dynamic page
    let buttons = await page.$$('button, input[type="button"], input[type="submit"], a.button, .btn');
    console.log(`Found ${buttons.length} buttons on dynamic page\n`);

    for (let i = 0; i < buttons.length; i++) {
      try {
        // Re-query buttons in case DOM changed
        buttons = await page.$$('button, input[type="button"], input[type="submit"], a.button, .btn');
        if (i >= buttons.length) break;

        const button = buttons[i];
        const buttonText = await button.textContent();
        const buttonType = await button.getAttribute('type');
        const buttonClass = await button.getAttribute('class');
        const isDisabled = await button.isDisabled();

        if (isDisabled) {
          console.log(`Button ${i + 1}: "${buttonText?.trim() || 'No text'}" - DISABLED, skipping`);
          continue;
        }

        console.log(`Button ${i + 1}: Clicking "${buttonText?.trim() || 'No text'}" (type: ${buttonType || 'button'})`);

        // Take screenshot before click
        await page.screenshot({ path: `button-test-${i + 1}-before.png` });

        // Click the button
        await button.click();
        await page.waitForTimeout(1000);

        // Check for any alerts/dialogs
        page.on('dialog', async dialog => {
          console.log(`  - Alert appeared: "${dialog.message()}"`);
          await dialog.accept();
        });

        // Check if page navigated
        const currentUrl = page.url();
        if (currentUrl !== 'http://localhost:8083/test/dynamic') {
          console.log(`  - Navigation detected to: ${currentUrl}`);
          await page.goBack();
          await page.waitForLoadState('networkidle');
        }

        // Check for modal/popup
        const modal = await page.$('.modal:visible, [role="dialog"]:visible, .popup:visible, .overlay:visible');
        if (modal) {
          console.log('  - Modal/popup appeared');

          // Try to close modal
          const closeBtn = await page.$('.modal .close, [aria-label="Close"], button:has-text("Close"), button:has-text("X"), .modal-close');
          if (closeBtn) {
            console.log('  - Closing modal');
            await closeBtn.click();
            await page.waitForTimeout(500);
          } else {
            // Press Escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }
        }

        // Check for DOM changes
        const newContent = await page.$('.new-content, .dynamic-content, [data-dynamic="true"]');
        if (newContent) {
          console.log('  - Dynamic content loaded');
        }

        console.log('');
        await page.waitForTimeout(500);

      } catch (error) {
        console.log(`  - Error clicking button ${i + 1}: ${error.message}\n`);
      }
    }

    // Test 2: Main Test Page
    console.log('\n=== TESTING MAIN TEST PAGE ===\n');
    await page.goto('http://localhost:8083/test');
    console.log('Navigated to main test page');
    await page.waitForLoadState('networkidle');

    // Fill form first to enable submit button
    await page.fill('#fullName', 'Test User');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'TestPass123!');
    await page.selectOption('#role', { index: 1 });

    // Get all buttons on main page
    buttons = await page.$$('button, input[type="button"], input[type="submit"], a.button, .btn');
    console.log(`Found ${buttons.length} buttons on main page\n`);

    for (let i = 0; i < buttons.length; i++) {
      try {
        const button = buttons[i];
        const buttonText = await button.textContent();
        const buttonType = await button.getAttribute('type');
        const isDisabled = await button.isDisabled();

        if (isDisabled) {
          console.log(`Button ${i + 1}: "${buttonText?.trim() || 'No text'}" - DISABLED, skipping`);
          continue;
        }

        console.log(`Button ${i + 1}: Clicking "${buttonText?.trim() || 'No text'}" (type: ${buttonType || 'button'})`);

        await button.click();
        await page.waitForTimeout(1500);

        // Check for success message
        const successMsg = await page.$('.success, .alert-success, [role="alert"]');
        if (successMsg) {
          const msgText = await successMsg.textContent();
          console.log(`  - Success message: "${msgText?.trim()}"`);
        }

        // Check if form was cleared
        const nameValue = await page.inputValue('#fullName');
        if (!nameValue) {
          console.log('  - Form was cleared/reset');
          // Refill for next test
          await page.fill('#fullName', 'Test User');
          await page.fill('#email', 'test@example.com');
          await page.fill('#password', 'TestPass123!');
          await page.selectOption('#role', { index: 1 });
        }

        console.log('');
        await page.waitForTimeout(500);

      } catch (error) {
        console.log(`  - Error clicking button ${i + 1}: ${error.message}\n`);
      }
    }

    // Test 3: Navigation buttons/links
    console.log('\n=== TESTING NAVIGATION ===\n');

    // Check for navigation links
    const navLinks = await page.$$('nav a, header a, .navigation a, a[href*="test"]');
    console.log(`Found ${navLinks.length} navigation links\n`);

    for (let i = 0; i < navLinks.length; i++) {
      try {
        const link = navLinks[i];
        const linkText = await link.textContent();
        const href = await link.getAttribute('href');

        console.log(`Link ${i + 1}: "${linkText?.trim()}" -> ${href}`);

        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          await link.click();
          await page.waitForLoadState('networkidle');

          const newUrl = page.url();
          console.log(`  - Navigated to: ${newUrl}`);

          await page.waitForTimeout(1000);
        }

        console.log('');

      } catch (error) {
        console.log(`  - Error clicking link ${i + 1}: ${error.message}\n`);
      }
    }

    console.log('\n=== BUTTON TEST COMPLETE ===\n');
    console.log('Summary:');
    console.log('- Tested all buttons on dynamic content page');
    console.log('- Tested all buttons on main test page');
    console.log('- Tested all navigation links');
    console.log('\nCheck the console output above for detailed results.');

  } catch (error) {
    console.error('Error during button test:', error);
    await page.screenshot({ path: 'error-screenshot.png' });
    console.log('Screenshot saved as error-screenshot.png');
  }

  // Keep browser open for viewing
  console.log('\nKeeping browser open for 10 seconds...');
  await page.waitForTimeout(10000);

  await browser.close();
  console.log('Test complete!');
}

testAllButtons().catch(console.error);