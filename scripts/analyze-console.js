import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture all console messages
  const consoleMessages = [];
  const consoleErrors = [];
  const networkErrors = [];

  // Listen to console events
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();

    const messageInfo = {
      type: type,
      text: text,
      url: location.url,
      lineNumber: location.lineNumber,
      columnNumber: location.columnNumber
    };

    consoleMessages.push(messageInfo);

    if (type === 'error') {
      consoleErrors.push(messageInfo);
    }
  });

  // Listen to page errors (uncaught exceptions)
  page.on('pageerror', error => {
    consoleErrors.push({
      type: 'pageerror',
      text: error.message,
      stack: error.stack
    });
  });

  // Listen to request failures
  page.on('requestfailed', request => {
    networkErrors.push({
      url: request.url(),
      failure: request.failure().errorText,
      method: request.method()
    });
  });

  try {
    console.log('🌐 Opening http://localhost:8090/test/forms ...\n');

    // Navigate to the page
    const response = await page.goto('http://localhost:8090/test/forms', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log(`📊 Page Status: ${response.status()}`);
    console.log(`📄 Page URL: ${page.url()}\n`);

    // Wait a bit for any delayed console messages
    await page.waitForTimeout(2000);

    // Get page title and check if form exists
    const title = await page.title();
    const formExists = await page.$('#signupForm') !== null;

    console.log(`📌 Page Title: ${title}`);
    console.log(`📝 Form Found: ${formExists ? 'Yes' : 'No'}\n`);

    // Print all console messages
    console.log('=' .repeat(80));
    console.log('📋 ALL CONSOLE MESSAGES:');
    console.log('=' .repeat(80));

    if (consoleMessages.length === 0) {
      console.log('✅ No console messages detected');
    } else {
      consoleMessages.forEach((msg, index) => {
        const icon = msg.type === 'error' ? '❌' :
                    msg.type === 'warning' ? '⚠️' :
                    msg.type === 'log' ? '📝' : '💬';
        console.log(`\n${icon} Message ${index + 1} (${msg.type.toUpperCase()}):`);
        console.log(`   Text: ${msg.text}`);
        if (msg.url) {
          console.log(`   Location: ${msg.url}:${msg.lineNumber}:${msg.columnNumber}`);
        }
      });
    }

    // Print console errors specifically
    console.log('\n' + '=' .repeat(80));
    console.log('❌ CONSOLE ERRORS:');
    console.log('=' .repeat(80));

    if (consoleErrors.length === 0) {
      console.log('✅ No console errors detected');
    } else {
      consoleErrors.forEach((error, index) => {
        console.log(`\nError ${index + 1}:`);
        console.log(`   Message: ${error.text}`);
        if (error.url) {
          console.log(`   Location: ${error.url}:${error.lineNumber}`);
        }
        if (error.stack) {
          console.log(`   Stack: ${error.stack}`);
        }
      });
    }

    // Print network errors
    console.log('\n' + '=' .repeat(80));
    console.log('🔌 NETWORK ERRORS:');
    console.log('=' .repeat(80));

    if (networkErrors.length === 0) {
      console.log('✅ No network errors detected');
    } else {
      networkErrors.forEach((error, index) => {
        console.log(`\nNetwork Error ${index + 1}:`);
        console.log(`   URL: ${error.url}`);
        console.log(`   Method: ${error.method}`);
        console.log(`   Failure: ${error.failure}`);
      });
    }

    // Check for common issues
    console.log('\n' + '=' .repeat(80));
    console.log('🔍 ANALYSIS & RECOMMENDATIONS:');
    console.log('=' .repeat(80));

    const issues = [];
    const recommendations = [];

    // Check for React errors
    const hasReactErrors = consoleErrors.some(e =>
      e.text.includes('React') ||
      e.text.includes('useState') ||
      e.text.includes('useEffect')
    );

    if (hasReactErrors) {
      issues.push('React-related errors detected');
      recommendations.push('Check React hooks usage and component lifecycle');
    }

    // Check for missing dependencies
    const hasMissingDeps = consoleErrors.some(e =>
      e.text.includes('Cannot find module') ||
      e.text.includes('not defined') ||
      e.text.includes('is not a function')
    );

    if (hasMissingDeps) {
      issues.push('Missing dependencies or undefined functions');
      recommendations.push('Verify all required modules are imported correctly');
    }

    // Check for CORS issues
    const hasCORS = networkErrors.some(e =>
      e.failure.includes('CORS') ||
      e.failure.includes('blocked by CORS policy')
    );

    if (hasCORS) {
      issues.push('CORS policy blocking requests');
      recommendations.push('Configure proper CORS headers on the server');
    }

    // Check for syntax errors
    const hasSyntaxErrors = consoleErrors.some(e =>
      e.text.includes('SyntaxError') ||
      e.text.includes('Unexpected token')
    );

    if (hasSyntaxErrors) {
      issues.push('JavaScript syntax errors');
      recommendations.push('Review JavaScript code for syntax issues');
    }

    // Print findings
    if (issues.length > 0) {
      console.log('\n🔴 Issues Found:');
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });

      console.log('\n💡 Recommendations:');
      recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    } else {
      console.log('\n✅ No major issues detected!');
      console.log('   The page appears to be loading without critical errors.');
    }

    // Take a screenshot for reference
    await page.screenshot({ path: 'scripts/console-analysis.png', fullPage: true });
    console.log('\n📸 Screenshot saved to: scripts/console-analysis.png');

  } catch (error) {
    console.error('\n❌ Script execution error:', error.message);
  } finally {
    await browser.close();
    console.log('\n🏁 Browser closed');
  }
})();