import { chromium } from 'playwright';

async function testFormFill() {
  console.log('Starting form fill test with visible browser...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // Slow down actions so you can see them
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the test page
    await page.goto('http://localhost:8083/test');
    console.log('Navigated to test page');

    // Wait for the form to be visible
    await page.waitForSelector('#signupForm', { state: 'visible' });
    console.log('Form is visible');

    // Clear and fill the Full Name field
    await page.fill('#fullName', '');
    await page.type('#fullName', 'Michael Johnson', { delay: 100 });
    console.log('Filled Full Name');

    // Clear and fill the Email field
    await page.fill('#email', '');
    await page.type('#email', 'michael.johnson@example.com', { delay: 100 });
    console.log('Filled Email');

    // Clear and fill the Password field
    await page.fill('#password', '');
    await page.type('#password', 'SuperSecurePass123!', { delay: 100 });
    console.log('Filled Password');

    // Clear and fill the Company field
    await page.fill('#company', '');
    await page.type('#company', 'Tech Solutions Corp', { delay: 100 });
    console.log('Filled Company');

    // Select a role from the dropdown
    await page.selectOption('#role', { index: 1 }); // Select first option after default
    console.log('Selected Role');

    // Wait a bit so you can see the filled form
    await page.waitForTimeout(2000);

    // Click the submit button
    await page.click('button[type="submit"]');
    console.log('Clicked submit button');

    // Wait for response
    await page.waitForTimeout(3000);

    console.log('Form submission complete!');

  } catch (error) {
    console.error('Error during form fill:', error);
  }

  // Keep browser open for viewing
  console.log('Keeping browser open for 5 seconds...');
  await page.waitForTimeout(5000);

  await browser.close();
  console.log('Test complete!');
}

testFormFill().catch(console.error);