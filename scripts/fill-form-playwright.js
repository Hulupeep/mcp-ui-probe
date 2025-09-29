import { chromium } from 'playwright';

(async () => {
  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🚀 Navigating to forms page...');
    await page.goto('http://localhost:8090/test/forms', { waitUntil: 'domcontentloaded' });

    console.log('📝 Filling out the form...');

    // Fill in the Full Name field
    await page.fill('#fullName', 'John Smith');
    console.log('  ✓ Filled Full Name: John Smith');

    // Fill in the Email field
    await page.fill('#email', 'john.smith@example.com');
    console.log('  ✓ Filled Email: john.smith@example.com');

    // Fill in the Password field
    await page.fill('#password', 'SecurePassword123!');
    console.log('  ✓ Filled Password: ********');

    // Fill in the Company field (optional)
    await page.fill('#company', 'Acme Corporation');
    console.log('  ✓ Filled Company: Acme Corporation');

    // Select role from dropdown
    await page.selectOption('#role', { index: 1 }); // Select first non-default option
    const selectedRole = await page.$eval('#role', el => el.options[el.selectedIndex].text);
    console.log(`  ✓ Selected Role: ${selectedRole}`);

    // Check the terms checkbox if it exists
    const termsCheckbox = await page.$('#terms');
    if (termsCheckbox) {
      await page.check('#terms');
      console.log('  ✓ Accepted Terms and Conditions');
    }

    // Take a screenshot before submitting
    await page.screenshot({ path: 'scripts/form-filled.png', fullPage: true });
    console.log('📸 Screenshot saved: scripts/form-filled.png');

    // Submit the form
    console.log('🎯 Submitting the form...');
    await page.click('button[type="submit"]');

    // Wait for navigation or success message
    await page.waitForTimeout(2000); // Wait 2 seconds to see result

    // Check for success message or new page
    const currentUrl = page.url();
    const pageContent = await page.content();

    if (currentUrl !== 'http://localhost:8090/test/forms') {
      console.log(`✅ Form submitted successfully! Redirected to: ${currentUrl}`);
    } else if (pageContent.includes('success') || pageContent.includes('Success')) {
      console.log('✅ Form submitted successfully! Success message displayed.');
    } else {
      console.log('✅ Form submitted! Current URL:', currentUrl);
    }

    // Take a screenshot after submitting
    await page.screenshot({ path: 'scripts/form-submitted.png', fullPage: true });
    console.log('📸 Screenshot saved: scripts/form-submitted.png');

  } catch (error) {
    console.error('❌ Error occurred:', error.message);
    // Take error screenshot
    await page.screenshot({ path: 'scripts/form-error.png', fullPage: true });
    console.log('📸 Error screenshot saved: scripts/form-error.png');
  } finally {
    await browser.close();
    console.log('🏁 Browser closed');
  }
})();