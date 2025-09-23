# Troubleshooting Guide

## 🔴 CRITICAL: Browser Installation Issues

### "Navigation failed" or "Browser launch failed"

**This is the #1 issue - Playwright browsers are not installed!**

**Symptoms:**
- All UI tests fail immediately
- Error: "Navigation failed"
- Error: "browserType.launch: Executable doesn't exist"
- Error: "Could not launch browser"

**Solution:**
```bash
# Step 1: Install Playwright browsers (470MB)
cd /path/to/mcp-ui-probe
npx playwright install

# Step 2: Install system dependencies (requires sudo)
sudo npx playwright install-deps
# OR manually:
sudo apt-get install libgstreamer-plugins-bad1.0-0 libavif16
```

**Verify Installation:**
```bash
# Check browsers are installed
ls ~/.cache/ms-playwright/
# Should show: chromium-1187, firefox-1490, webkit-2203, ffmpeg-1011

# Test browser launch
npx playwright test --list
```

### Host system missing dependencies

**Symptoms:**
- Warning: "Host system is missing dependencies to run browsers"
- Browsers crash on launch
- Segmentation faults

**Solution:**
```bash
sudo npx playwright install-deps
```

## Common Issues and Solutions

### 1. Form Detection Problems

#### Issue: "No forms found on the page"

**Symptoms:**
- `analyze_ui` returns empty forms array
- Error: "No forms found on the page"
- Tests fail at the discovery phase

**Diagnostic Steps:**

```javascript
// Debug form detection
const analysis = await mcpClient.call('analyze_ui');
console.log('UI Analysis Results:');
console.log(`Forms: ${analysis.forms.length}`);
console.log(`Inputs: ${analysis.inputs.length}`);
console.log(`Buttons: ${analysis.buttons.length}`);

// Check for AJAX/SPA forms
if (analysis.forms.length === 0 && analysis.inputs.length > 0) {
  console.log('Detected standalone inputs - likely AJAX form');

  // Look for form-like containers
  const containers = analysis.roles.filter(el =>
    el.role.includes('form') ||
    el.attributes.includes('form')
  );

  console.log('Form containers found:', containers.length);
}
```

**Common Causes and Solutions:**

1. **AJAX/SPA Forms without `<form>` tags**
   ```javascript
   // Solution: Use manual field detection
   const customFormSchema = {
     name: 'ajax_form',
     selector: '.form-container',
     fields: [
       {
         name: 'email',
         type: 'email',
         selector: '[data-test="email-input"]',
         required: true
       },
       {
         name: 'password',
         type: 'password',
         selector: '[data-test="password-input"]',
         required: true
       }
     ],
     submit: {
       selector: '[data-test="submit-button"]',
       text: 'Sign In'
     }
   };

   const result = await mcpClient.call('fill_and_submit', {
     formSchema: customFormSchema
   });
   ```

2. **Forms loaded after page load**
   ```javascript
   // Solution: Wait for dynamic content
   await mcpClient.call('navigate', {
     url: 'https://app.example.com',
     waitUntil: 'networkidle'  // Wait for all network activity
   });

   // Or add explicit wait
   await new Promise(resolve => setTimeout(resolve, 3000));
   const analysis = await mcpClient.call('analyze_ui');
   ```

3. **Shadow DOM or iframe forms**
   ```javascript
   // Solution: Navigate directly to iframe content
   await mcpClient.call('navigate', {
     url: 'https://app.example.com/embedded-form'
   });
   ```

#### Issue: "Low confidence form inference"

**Symptoms:**
- `infer_form` returns confidence < 0.7
- Wrong form selected in multi-form pages
- Incorrect field type detection

**Diagnostic Steps:**

```javascript
const analysis = await mcpClient.call('analyze_ui');
const inference = await mcpClient.call('infer_form', { goal: 'signup' });

console.log(`Confidence: ${inference.confidence}`);
console.log('Available forms:');
analysis.forms.forEach((form, index) => {
  console.log(`Form ${index}: ${form.name}`);
  console.log(`  Fields: ${form.fields.length}`);
  console.log(`  Submit text: ${form.submit.text}`);
});
```

**Solutions:**

1. **Provide explicit hints**
   ```javascript
   const inference = await mcpClient.call('infer_form', {
     goal: 'signup',
     hints: {
       formSelector: '#registration-form',
       emailSelector: '[name="email"]',
       passwordSelector: '[name="password"]',
       submitSelector: 'button[type="submit"]'
     }
   });
   ```

2. **Use more specific goals**
   ```javascript
   // Instead of generic 'signup'
   const inference = await mcpClient.call('infer_form', {
     goal: 'create_new_account_with_email_verification'
   });
   ```

### 2. Selector Reliability Issues

#### Issue: "Element not found" errors

**Symptoms:**
- Error: "Element not found: #submit-button"
- Tests fail intermittently
- Selectors work in manual testing but fail in automation

**Diagnostic Steps:**

```javascript
// Test selector healing
const playwrightDriver = new PlaywrightDriver();
await playwrightDriver.initialize();
const page = await playwrightDriver.getPage();

// Try different selector strategies
const selectorStrategies = [
  '#submit-button',                    // ID
  'button[type="submit"]',             // Attribute
  'text=Submit',                       // Text content
  '[data-test="submit"]',              // Test attribute
  'role=button[name="Submit"]'         // Accessibility role
];

for (const selector of selectorStrategies) {
  try {
    const element = await page.locator(selector).first();
    const isVisible = await element.isVisible({ timeout: 2000 });
    console.log(`${selector}: ${isVisible ? 'FOUND' : 'NOT VISIBLE'}`);
  } catch (error) {
    console.log(`${selector}: NOT FOUND`);
  }
}
```

**Solutions:**

1. **Enable self-healing selectors**
   ```javascript
   // Automatic selector healing is built-in
   // But you can provide fallback selectors
   const robustFormSchema = {
     name: 'login',
     fields: [
       {
         name: 'email',
         type: 'email',
         selector: '#email',
         fallbackSelectors: [
           '[name="email"]',
           '[data-test="email"]',
           'input[type="email"]'
         ]
       }
     ]
   };
   ```

2. **Use data attributes for stability**
   ```html
   <!-- Recommend to developers -->
   <input type="email" name="email" data-test="email-input" />
   <button type="submit" data-test="submit-button">Sign In</button>
   ```

3. **Wait strategies for dynamic content**
   ```javascript
   // Use run_flow with dynamic wait
   const result = await mcpClient.call('run_flow', {
     goal: 'login',
     constraints: {
       waitForDynamicContent: true,
       maxWaitTime: 10000
     }
   });
   ```

### 3. Data Generation Issues

#### Issue: "Generated data rejected by validation"

**Symptoms:**
- Form submission fails with validation errors
- Password doesn't meet complexity requirements
- Email format rejected

**Diagnostic Steps:**

```javascript
// Analyze validation errors
const result = await mcpClient.call('fill_and_submit', {
  formSchema: inference.formSchema
});

const validationErrors = result.errors.filter(e => e.type === 'validation');
validationErrors.forEach(error => {
  console.log(`Field: ${error.selector}`);
  console.log(`Error: ${error.message}`);
  console.log(`Evidence: ${JSON.stringify(error.evidence)}`);
});
```

**Solutions:**

1. **Override problematic fields**
   ```javascript
   const result = await mcpClient.call('fill_and_submit', {
     formSchema: inference.formSchema,
     overrides: {
       email: 'test.user@company.com',
       password: 'ComplexP@ssw0rd123!',
       phone: '+1-555-123-4567',
       zipCode: '90210'
     }
   });
   ```

2. **Update field policy detection**
   ```javascript
   // Manually specify password policy
   const enhancedFormSchema = {
     ...inference.formSchema,
     fields: inference.formSchema.fields.map(field => {
       if (field.type === 'password') {
         return {
           ...field,
           policy: {
             min: 12,
             upper: 2,
             digit: 2,
             symbol: 2,
             excludeCommon: true
           }
         };
       }
       return field;
     })
   };
   ```

3. **Test with known good data first**
   ```javascript
   const knownGoodData = {
     email: 'valid.test@example.com',
     password: 'ValidPassword123!',
     firstName: 'Test',
     lastName: 'User',
     phone: '555-123-4567'
   };

   const baselineResult = await mcpClient.call('fill_and_submit', {
     formSchema: inference.formSchema,
     overrides: knownGoodData
   });

   if (baselineResult.result === 'passed') {
     console.log('Form accepts known good data');
   }
   ```

### 4. Performance Issues

#### Issue: "Tests running too slowly"

**Symptoms:**
- Test execution time > 30 seconds
- Browser hangs or becomes unresponsive
- Memory usage continuously increasing

**Diagnostic Steps:**

```javascript
// Monitor performance metrics
const startTime = Date.now();
const startMemory = process.memoryUsage();

const result = await mcpClient.call('run_flow', {
  goal: 'signup'
});

const endTime = Date.now();
const endMemory = process.memoryUsage();

console.log(`Execution time: ${endTime - startTime}ms`);
console.log(`Memory used: ${(endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024}MB`);
console.log(`Steps executed: ${result.metrics.steps}`);
```

**Solutions:**

1. **Optimize browser settings**
   ```javascript
   // Configure browser for performance
   const browserConfig = {
     headless: true,
     args: [
       '--no-sandbox',
       '--disable-setuid-sandbox',
       '--disable-dev-shm-usage',
       '--disable-web-security',
       '--disable-features=VizDisplayCompositor',
       '--disable-background-timer-throttling',
       '--disable-backgrounding-occluded-windows',
       '--disable-renderer-backgrounding'
     ]
   };
   ```

2. **Reduce wait times**
   ```javascript
   const fastResult = await mcpClient.call('run_flow', {
     goal: 'signup',
     constraints: {
       fastMode: true,           // Skip optional waits
       skipScreenshots: true,    // Disable screenshots
       reducedLogging: true      // Minimal logging
     }
   });
   ```

3. **Browser connection pooling**
   ```javascript
   // Reuse browser instances
   class BrowserPool {
     constructor(maxInstances = 3) {
       this.pool = [];
       this.maxInstances = maxInstances;
     }

     async getBrowser() {
       if (this.pool.length > 0) {
         return this.pool.pop();
       }

       if (this.activeInstances < this.maxInstances) {
         return await chromium.launch(browserConfig);
       }

       // Wait for available instance
       return await this.waitForAvailable();
     }
   }
   ```

### 5. Network and Connectivity Issues

#### Issue: "Navigation timeouts"

**Symptoms:**
- Error: "Navigation timeout of 30000ms exceeded"
- Tests fail on specific environments
- Intermittent connection issues

**Diagnostic Steps:**

```bash
# Test network connectivity
ping app.example.com
nslookup app.example.com
curl -I https://app.example.com

# Check for DNS issues
dig app.example.com
```

```javascript
// Test different timeout values
const timeoutTests = [5000, 15000, 30000, 60000];

for (const timeout of timeoutTests) {
  try {
    console.log(`Testing with ${timeout}ms timeout...`);

    const start = Date.now();
    await mcpClient.call('navigate', {
      url: 'https://app.example.com',
      timeout: timeout
    });

    console.log(`Success in ${Date.now() - start}ms`);
    break;
  } catch (error) {
    console.log(`Failed with ${timeout}ms timeout`);
  }
}
```

**Solutions:**

1. **Increase timeout values**
   ```javascript
   const result = await mcpClient.call('navigate', {
     url: 'https://slow-app.example.com',
     waitUntil: 'domcontentloaded',  // Less strict than 'load'
     timeout: 60000  // 60 second timeout
   });
   ```

2. **Use retry mechanisms**
   ```javascript
   async function navigateWithRetry(url, maxRetries = 3) {
     for (let attempt = 1; attempt <= maxRetries; attempt++) {
       try {
         await mcpClient.call('navigate', { url });
         return;
       } catch (error) {
         if (attempt === maxRetries) throw error;

         console.log(`Navigation attempt ${attempt} failed, retrying...`);
         await new Promise(resolve => setTimeout(resolve, 2000));
       }
     }
   }
   ```

3. **Configure proxy settings**
   ```javascript
   // For corporate networks
   const proxyConfig = {
     proxy: {
       server: 'http://proxy.company.com:8080',
       username: 'user',
       password: 'pass'
     }
   };
   ```

### 6. Environment-Specific Issues

#### Issue: "Tests pass locally but fail in CI/CD"

**Symptoms:**
- Local tests: ✅ Pass
- CI/CD tests: ❌ Fail
- Different error patterns in different environments

**Diagnostic Steps:**

```javascript
// Environment detection and debugging
const environment = {
  nodeVersion: process.version,
  platform: process.platform,
  architecture: process.arch,
  memory: process.memoryUsage(),
  env: process.env.NODE_ENV,
  ci: process.env.CI,
  display: process.env.DISPLAY,
  xvfb: !!process.env.XVFB
};

console.log('Environment info:', JSON.stringify(environment, null, 2));

// Test browser capabilities
const capabilities = await mcpClient.call('run_flow', {
  goal: 'test_browser_capabilities',
  url: 'data:text/html,<h1>Browser Test</h1>'
});
```

**Solutions:**

1. **Docker container consistency**
   ```dockerfile
   # Dockerfile for consistent environment
   FROM node:18-alpine

   # Install browser dependencies
   RUN apk add --no-cache \
     chromium \
     nss \
     freetype \
     freetype-dev \
     harfbuzz \
     ca-certificates \
     ttf-freefont

   # Set browser path
   ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   ENV CHROMIUM_PATH=/usr/bin/chromium-browser

   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production

   COPY . .
   CMD ["npm", "start"]
   ```

2. **CI/CD configuration**
   ```yaml
   # GitHub Actions
   name: UI Tests
   on: [push, pull_request]

   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3

         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '18'

         - name: Install dependencies
           run: |
             sudo apt-get update
             sudo apt-get install -y xvfb
             npm ci

         - name: Run UI tests
           run: xvfb-run --auto-servernum npm test
           env:
             NODE_ENV: test
             HEADLESS: true
   ```

3. **Cross-platform compatibility**
   ```javascript
   // Platform-specific configuration
   const config = {
     linux: {
       browserPath: '/usr/bin/chromium-browser',
       args: ['--no-sandbox', '--disable-setuid-sandbox']
     },
     darwin: {
       browserPath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
       args: []
     },
     win32: {
       browserPath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
       args: ['--disable-web-security']
     }
   };

   const platformConfig = config[process.platform] || config.linux;
   ```

### 7. Browser-Specific Issues

#### Issue: "Different behavior across browsers"

**Symptoms:**
- Tests pass in Chrome but fail in Firefox
- Element detection varies by browser
- Different performance characteristics

**Solutions:**

1. **Browser-specific configuration**
   ```javascript
   const browserConfigs = {
     chromium: {
       args: ['--no-sandbox', '--disable-setuid-sandbox']
     },
     firefox: {
       firefoxUserPrefs: {
         'dom.webnotifications.enabled': false,
         'dom.push.enabled': false
       }
     },
     webkit: {
       ignoreHTTPSErrors: true
     }
   };

   // Test across multiple browsers
   for (const [browser, config] of Object.entries(browserConfigs)) {
     console.log(`Testing with ${browser}...`);

     const result = await mcpClient.call('run_flow', {
       goal: 'signup',
       browser: browser,
       browserConfig: config
     });

     console.log(`${browser}: ${result.result}`);
   }
   ```

### 8. Debugging Tools and Techniques

#### Debug Mode Configuration

```javascript
// Enable comprehensive debugging
const debugConfig = {
  screenshots: true,
  videos: true,
  har: true,
  consoleOutput: true,
  networkLogs: true,
  performanceMetrics: true,
  stepByStep: true
};

const debugResult = await mcpClient.call('run_flow', {
  goal: 'signup',
  debug: debugConfig
});

// Analyze debug artifacts
console.log('Debug artifacts:');
debugResult.flow.forEach(step => {
  console.log(`Step: ${step.action} - ${step.outcome}`);
  if (step.artifacts) {
    console.log(`  Screenshot: ${step.artifacts.screenshot}`);
    console.log(`  Console: ${step.artifacts.console?.length || 0} messages`);
  }
});
```

#### Interactive Debugging

```javascript
// Pause execution for manual inspection
const interactiveResult = await mcpClient.call('run_flow', {
  goal: 'signup',
  debug: {
    pauseOnError: true,
    interactive: true,
    keepBrowserOpen: true
  }
});

// Manual browser inspection
if (interactiveResult.result === 'failed') {
  console.log('Test failed - browser remains open for inspection');
  console.log('Check: http://localhost:9222 for DevTools');

  // Wait for manual intervention
  await new Promise(resolve => {
    process.stdin.once('data', () => {
      console.log('Continuing...');
      resolve();
    });
  });
}
```

## Getting Help

### 1. Log Collection for Support

```bash
# Collect comprehensive logs
mkdir troubleshooting-logs
cp /var/log/mcp-ui-probe/*.log troubleshooting-logs/
docker logs mcp-ui-probe > troubleshooting-logs/container.log 2>&1
npm run debug > troubleshooting-logs/debug-output.log 2>&1

# System information
uname -a > troubleshooting-logs/system-info.txt
npm list > troubleshooting-logs/dependencies.txt
docker version > troubleshooting-logs/docker-info.txt

# Create support bundle
tar -czf support-bundle-$(date +%Y%m%d-%H%M%S).tar.gz troubleshooting-logs/
```

### 2. Minimal Reproduction Case

```javascript
// Create minimal test case for bug reports
const minimalReproduction = {
  url: 'https://problem-site.example.com',
  goal: 'specific_failing_action',
  expectedBehavior: 'Should complete signup successfully',
  actualBehavior: 'Fails with selector not found error',
  environment: {
    nodeVersion: process.version,
    platform: process.platform,
    browser: 'chromium',
    version: '1.0.0'
  },
  steps: [
    '1. Navigate to signup page',
    '2. Call infer_form with goal: signup',
    '3. Call fill_and_submit',
    '4. Observe error at step 3'
  ],
  logs: 'Attach relevant log excerpts'
};
```

This troubleshooting guide should help resolve most common issues encountered when implementing intelligent UI testing systems.