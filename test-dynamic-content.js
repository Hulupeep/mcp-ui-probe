import { chromium } from 'playwright';

async function testDynamicContent() {
  console.log('Starting dynamic content test with visible browser...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300 // Slow down actions so you can see them
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the dynamic content page
    await page.goto('http://localhost:8083/test/dynamic');
    console.log('Navigated to dynamic content page');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if there's a search/filter input
    const searchInput = await page.$('input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i], #search, #filter');
    if (searchInput) {
      console.log('Found search input, typing search term...');
      await searchInput.fill('');
      await searchInput.type('test item', { delay: 100 });
      await page.waitForTimeout(1000);
    }

    // Check for any text inputs for dynamic content
    const inputs = await page.$$('input[type="text"], input[type="email"], input[type="number"]');
    console.log(`Found ${inputs.length} input fields`);

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const placeholder = await input.getAttribute('placeholder');
      const id = await input.getAttribute('id');
      const name = await input.getAttribute('name');

      console.log(`Filling input ${i + 1}: ${id || name || placeholder || 'unnamed'}`);

      // Clear and fill with appropriate test data
      await input.fill('');

      // Determine what to fill based on field attributes
      let fillValue = `Dynamic Test ${i + 1}`;
      if (placeholder?.toLowerCase().includes('email') || name?.toLowerCase().includes('email')) {
        fillValue = `test${i + 1}@example.com`;
      } else if (placeholder?.toLowerCase().includes('number') || name?.toLowerCase().includes('number')) {
        fillValue = `${100 + i}`;
      } else if (placeholder?.toLowerCase().includes('name') || name?.toLowerCase().includes('name')) {
        fillValue = `Test User ${i + 1}`;
      }

      await input.type(fillValue, { delay: 50 });
      await page.waitForTimeout(500);
    }

    // Check for select dropdowns
    const selects = await page.$$('select');
    console.log(`Found ${selects.length} select dropdowns`);

    for (let i = 0; i < selects.length; i++) {
      const select = selects[i];
      const options = await select.$$eval('option', opts => opts.map(opt => opt.value));
      if (options.length > 1) {
        console.log(`Selecting option in dropdown ${i + 1}`);
        await select.selectOption({ index: 1 });
        await page.waitForTimeout(500);
      }
    }

    // Check for checkboxes
    const checkboxes = await page.$$('input[type="checkbox"]:not(:checked)');
    console.log(`Found ${checkboxes.length} unchecked checkboxes`);

    for (let i = 0; i < Math.min(checkboxes.length, 3); i++) {
      console.log(`Checking checkbox ${i + 1}`);
      await checkboxes[i].check();
      await page.waitForTimeout(300);
    }

    // Check for radio buttons
    const radioGroups = await page.$$eval('input[type="radio"]', radios => {
      const groups = {};
      radios.forEach(radio => {
        const name = radio.name;
        if (name && !groups[name]) {
          groups[name] = radio.id || radio.value;
        }
      });
      return Object.values(groups);
    });

    for (const radioId of radioGroups) {
      const radio = await page.$(`input[type="radio"][id="${radioId}"], input[type="radio"][value="${radioId}"]`);
      if (radio) {
        console.log(`Selecting radio button: ${radioId}`);
        await radio.check();
        await page.waitForTimeout(300);
      }
    }

    // Check for buttons that might load dynamic content
    const buttons = await page.$$('button:not([type="submit"]), a.button, .btn');
    console.log(`Found ${buttons.length} buttons`);

    // Click first few non-submit buttons to trigger dynamic content
    for (let i = 0; i < Math.min(buttons.length, 2); i++) {
      const buttonText = await buttons[i].textContent();
      if (buttonText && !buttonText.toLowerCase().includes('delete') && !buttonText.toLowerCase().includes('remove')) {
        console.log(`Clicking button: ${buttonText.trim()}`);
        await buttons[i].click();
        await page.waitForTimeout(1000);

        // Check if modal or popup appeared
        const modal = await page.$('.modal, [role="dialog"], .popup');
        if (modal) {
          console.log('Modal/popup appeared, closing it...');
          const closeBtn = await page.$('.modal .close, [aria-label="Close"], .modal button:has-text("Close")');
          if (closeBtn) {
            await closeBtn.click();
            await page.waitForTimeout(500);
          }
        }
      }
    }

    // Check for any textareas
    const textareas = await page.$$('textarea');
    console.log(`Found ${textareas.length} textareas`);

    for (let i = 0; i < textareas.length; i++) {
      console.log(`Filling textarea ${i + 1}`);
      await textareas[i].fill('');
      await textareas[i].type('This is dynamic test content that demonstrates interaction with multi-line text fields. The content updates as you type!', { delay: 20 });
      await page.waitForTimeout(500);
    }

    // Look for submit button if there's a form
    const submitButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Save")');
    if (submitButton) {
      console.log('Found submit button, clicking it...');
      await submitButton.click();
      await page.waitForTimeout(2000);
    }

    console.log('Dynamic content interaction complete!');

  } catch (error) {
    console.error('Error during dynamic content test:', error);

    // Take screenshot on error
    await page.screenshot({ path: 'error-screenshot.png' });
    console.log('Screenshot saved as error-screenshot.png');
  }

  // Keep browser open for viewing
  console.log('Keeping browser open for 5 seconds...');
  await page.waitForTimeout(5000);

  await browser.close();
  console.log('Test complete!');
}

testDynamicContent().catch(console.error);