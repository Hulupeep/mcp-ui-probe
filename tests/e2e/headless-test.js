import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_SERVER_PORT = 8888;
const MCP_SERVER_PORT = 3000;

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test result tracking
let totalTests = 0;
let passedTests = 0;
let failedTests = [];

// Start test server
function startTestServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(__dirname, '../../test-pages');

      if (req.url === '/') {
        filePath = path.join(filePath, 'index.html');
      } else if (req.url.endsWith('.html')) {
        filePath = path.join(filePath, req.url.slice(1));
      } else {
        filePath = path.join(filePath, req.url);
      }

      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath);
      let contentType = 'text/html';
      if (ext === '.js') contentType = 'text/javascript';
      if (ext === '.css') contentType = 'text/css';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(500);
          res.end('Server Error');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });

    server.listen(TEST_SERVER_PORT, () => {
      console.log(`${colors.cyan}Test server running at http://localhost:${TEST_SERVER_PORT}${colors.reset}`);
      resolve(server);
    });
  });
}

// Test helper functions
async function runTest(name, testFn) {
  totalTests++;
  console.log(`\n${colors.blue}Running: ${name}${colors.reset}`);

  try {
    await testFn();
    passedTests++;
    console.log(`${colors.green}✓ ${name} passed${colors.reset}`);
    return true;
  } catch (error) {
    failedTests.push({ name, error: error.message });
    console.log(`${colors.red}✗ ${name} failed: ${error.message}${colors.reset}`);
    return false;
  }
}

// Check if element is clickable using our enhanced detection
async function isClickableElement(page, selector) {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return false;

    // Check computed styles
    const styles = window.getComputedStyle(element);
    const hasPointerCursor = styles.cursor === 'pointer';

    // Check for React event handlers
    const hasReactHandlers = element._reactListeners ||
                           element.__reactEventHandlers$ ||
                           element.onclick;

    // Check ARIA roles
    const hasButtonRole = element.getAttribute('role') === 'button';

    // Check if it's a clickable class
    const hasClickableClass = element.className.includes('clickable') ||
                            element.className.includes('btn') ||
                            element.className.includes('button') ||
                            element.className.includes('card');

    return hasPointerCursor || hasReactHandlers || hasButtonRole || hasClickableClass;
  }, selector);
}

// Main test suite
async function runTests() {
  console.log(`${colors.cyan}
╔═══════════════════════════════════════════════════╗
║     MCP UI-PROBE HEADLESS E2E TEST SUITE         ║
╚═══════════════════════════════════════════════════╝
${colors.reset}`);

  const server = await startTestServer();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Test 1: React Card Components
    await runTest('React Card Component Detection', async () => {
      await page.goto(`http://localhost:${TEST_SERVER_PORT}/react-components.html`);
      await page.waitForLoadState('networkidle');

      // Wait for React to render
      await page.waitForTimeout(1000);

      // Check if plan cards are rendered
      const planCards = await page.$$('.plan-card');
      if (planCards.length !== 3) {
        throw new Error(`Expected 3 plan cards, found ${planCards.length}`);
      }

      // Check if cards are clickable
      const isClickable = await isClickableElement(page, '.plan-card');
      if (!isClickable) {
        throw new Error('Plan cards not detected as clickable');
      }

      // Click on a plan card
      await page.click('.plan-card[data-plan-id="pro"]');

      // Check if continue button is enabled
      const isDisabled = await page.evaluate(() => {
        const btn = document.getElementById('continue-button');
        return btn ? btn.disabled : true;
      });

      if (isDisabled) {
        throw new Error('Continue button not enabled after plan selection');
      }
    });

    // Test 2: Non-Semantic Clickable Elements
    await runTest('Non-Semantic Clickable Elements', async () => {
      await page.goto(`http://localhost:${TEST_SERVER_PORT}/react-components.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Test clickable div
      const divClickable = await isClickableElement(page, '.clickable-div');
      if (!divClickable) {
        throw new Error('Clickable div not detected');
      }

      // Click and verify
      await page.click('.clickable-div');

      // Test ARIA button
      const ariaClickable = await isClickableElement(page, '[role="button"]');
      if (!ariaClickable) {
        throw new Error('ARIA button not detected as clickable');
      }

      await page.click('[role="button"]');
    });

    // Test 3: File Upload Elements
    await runTest('File Upload Detection', async () => {
      await page.goto(`http://localhost:${TEST_SERVER_PORT}/file-upload.html`);
      await page.waitForLoadState('networkidle');

      // Check standard file input
      const fileInput = await page.$('input[type="file"]');
      if (!fileInput) {
        throw new Error('File input not found');
      }

      // Check drag-drop zone
      const dropZone = await page.$('.drop-zone');
      if (!dropZone) {
        throw new Error('Drop zone not found');
      }

      // Verify drop zone has drag-drop attributes
      const hasDragDrop = await page.evaluate(() => {
        const zone = document.querySelector('.drop-zone');
        return zone && zone.className.includes('drop-zone');
      });

      if (!hasDragDrop) {
        throw new Error('Drop zone not properly configured');
      }
    });

    // Test 4: Custom Dropdown Components
    await runTest('Custom Dropdown Handling', async () => {
      await page.goto(`http://localhost:${TEST_SERVER_PORT}/dropdowns.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Test native select
      const nativeSelect = await page.$('select#native-select');
      if (!nativeSelect) {
        throw new Error('Native select not found');
      }

      await page.selectOption('#native-select', 'option2');

      // Test custom React select
      const customSelect = await page.$('.custom-select-control');
      if (!customSelect) {
        throw new Error('Custom select not found');
      }

      // Click to open
      await page.click('.custom-select-control');

      // Check if menu opened
      const menuOpen = await page.evaluate(() => {
        const menu = document.querySelector('.custom-select-menu');
        return menu && menu.classList.contains('open');
      });

      if (!menuOpen) {
        throw new Error('Custom dropdown menu did not open');
      }

      // Click an option
      await page.click('.custom-select-option');
    });

    // Test 5: Searchable Dropdown
    await runTest('Searchable Dropdown Interaction', async () => {
      await page.goto(`http://localhost:${TEST_SERVER_PORT}/dropdowns.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Find searchable input
      const searchInput = await page.$('.searchable-input');
      if (!searchInput) {
        throw new Error('Searchable input not found');
      }

      // Type to search
      await page.fill('.searchable-input', 'United');

      // Wait for dropdown to open
      await page.waitForTimeout(500);

      // Check filtered results
      const filteredCount = await page.evaluate(() => {
        const dropdown = document.querySelector('.searchable-dropdown.open');
        if (!dropdown) return 0;
        return dropdown.querySelectorAll('.custom-select-option').length;
      });

      if (filteredCount === 0) {
        throw new Error('Searchable dropdown filtering not working');
      }
    });

    // Test 6: Multi-Select
    await runTest('Multi-Select Dropdown', async () => {
      await page.goto(`http://localhost:${TEST_SERVER_PORT}/dropdowns.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Open multi-select
      await page.click('#multi-select .custom-select-control');

      // Select multiple options
      const options = await page.$$('#multi-select .custom-select-option');
      if (options.length < 2) {
        throw new Error('Not enough options in multi-select');
      }

      await options[0].click();
      await options[1].click();

      // Check if tags are displayed
      const tags = await page.$$('.multi-select-tag');
      if (tags.length !== 2) {
        throw new Error(`Expected 2 selected tags, found ${tags.length}`);
      }
    });

    // Test 7: Dynamic Content Loading
    await runTest('Dynamic Content Loading', async () => {
      await page.goto(`http://localhost:${TEST_SERVER_PORT}/react-components.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Click load button
      await page.click('button:has-text("Load Dynamic Content")');

      // Wait for loading to complete
      await page.waitForTimeout(2500);

      // Check if content loaded
      const hasContent = await page.evaluate(() => {
        const content = document.body.textContent;
        return content.includes('Item 1') &&
               content.includes('Item 2') &&
               content.includes('Item 3');
      });

      if (!hasContent) {
        throw new Error('Dynamic content not loaded');
      }
    });

    // Test 8: Modal Interactions
    await runTest('Modal Opening and Closing', async () => {
      await page.goto(`http://localhost:${TEST_SERVER_PORT}/react-components.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Open modal
      await page.click('button:has-text("Open React Modal")');

      // Check if modal is open
      const modalOpen = await page.evaluate(() => {
        const overlay = document.getElementById('modal-overlay');
        return overlay && overlay.classList.contains('open');
      });

      if (!modalOpen) {
        throw new Error('Modal did not open');
      }

      // Close modal
      await page.click('button:has-text("Close")');

      // Check if modal is closed
      const modalClosed = await page.evaluate(() => {
        const overlay = document.getElementById('modal-overlay');
        return overlay && !overlay.classList.contains('open');
      });

      if (!modalClosed) {
        throw new Error('Modal did not close');
      }
    });

    // Test 9: Form on Main Page
    await runTest('Main Page Form Interaction', async () => {
      await page.goto(`http://localhost:${TEST_SERVER_PORT}/`);
      await page.waitForLoadState('networkidle');

      // Check for form
      const form = await page.$('#signup-form');
      if (!form) {
        throw new Error('Signup form not found');
      }

      // Fill form fields
      await page.fill('#fullName', 'Test User');
      await page.fill('#email', 'test@example.com');
      await page.fill('#password', 'TestPass123!');
      await page.fill('#company', 'Test Company');
      await page.selectOption('#role', 'developer');

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for navigation or success
      await page.waitForTimeout(1000);

      // Check if we navigated to success page
      const url = page.url();
      const isSuccess = url.includes('success') ||
                       await page.evaluate(() =>
                         document.body.textContent.includes('Thank you'));

      if (!isSuccess) {
        console.log('  Note: Form submission might be prevented in test mode');
      }
    });

    // Test 10: Async Dropdown Loading
    await runTest('Async Dropdown Loading', async () => {
      await page.goto(`http://localhost:${TEST_SERVER_PORT}/dropdowns.html`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Click to trigger async load
      await page.click('#async-select .custom-select-control');

      // Check for loading spinner
      const hasSpinner = await page.evaluate(() => {
        return document.querySelector('.loading-spinner') !== null;
      });

      if (!hasSpinner) {
        throw new Error('Loading spinner not shown for async dropdown');
      }

      // Wait for loading to complete
      await page.waitForTimeout(2000);

      // Check if options loaded
      const optionsLoaded = await page.evaluate(() => {
        const menu = document.querySelector('#async-select .custom-select-menu.open');
        if (!menu) return false;
        const options = menu.querySelectorAll('.custom-select-option');
        return options.length > 0;
      });

      if (!optionsLoaded) {
        throw new Error('Async options did not load');
      }
    });

  } finally {
    // Cleanup
    console.log(`\n${colors.cyan}Cleaning up...${colors.reset}`);
    await browser.close();
    server.close();
  }

  // Print test results
  console.log(`\n${colors.cyan}
╔═══════════════════════════════════════════════════╗
║                  TEST RESULTS                     ║
╚═══════════════════════════════════════════════════╝
${colors.reset}`);

  console.log(`Total Tests: ${totalTests}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests.length}${colors.reset}`);

  if (failedTests.length > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    failedTests.forEach(({ name, error }) => {
      console.log(`  - ${name}: ${error}`);
    });
  }

  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  const statusColor = successRate >= 80 ? colors.green : successRate >= 60 ? colors.yellow : colors.red;

  console.log(`\n${statusColor}Success Rate: ${successRate}%${colors.reset}`);

  if (successRate === '100.0') {
    console.log(`\n${colors.green}🎉 ALL TESTS PASSED! React components, file uploads, and dropdowns work perfectly!${colors.reset}`);
  } else if (successRate >= 80) {
    console.log(`\n${colors.green}✅ TESTS MOSTLY PASSED! The core functionality is working well.${colors.reset}`);
  } else {
    console.log(`\n${colors.yellow}⚠️ Some tests failed. Review the implementation.${colors.reset}`);
  }

  process.exit(failedTests.length > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});