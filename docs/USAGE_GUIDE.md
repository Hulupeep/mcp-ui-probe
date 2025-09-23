# MCP UI Probe Usage Guide

## Quick Start

### Installation

**IMPORTANT**: This package is NOT on npm yet. You must clone from GitHub.

```bash
# Clone the repository
git clone https://github.com/Hulupeep/mcp-ui-probe.git
cd mcp-ui-probe

# Install and build
npm install
npm run build

# CRITICAL: Install Playwright browsers (470MB) - REQUIRED!
npx playwright install

# Install system dependencies (requires sudo)
sudo npx playwright install-deps

# Add to Claude Code
claude mcp add --scope project ui-probe node /path/to/mcp-ui-probe/dist/index.js
```

⚠️ **WARNING**: Without `npx playwright install`, ALL tests will fail with "Navigation failed" errors!

### Basic Usage

```javascript
// Connect to the MCP server
const mcpClient = new MCPClient();
await mcpClient.connect('ui-probe');

// Navigate and analyze a page
await mcpClient.call('navigate', { url: 'https://app.example.com/signup' });
const analysis = await mcpClient.call('analyze_ui');
console.log(`Found ${analysis.forms.length} forms`);
```

## Core Workflows

### 1. Page Navigation

```javascript
// Basic navigation
await mcpClient.call('navigate', {
  url: 'https://example.com/login'
});

// Navigation with custom wait conditions
await mcpClient.call('navigate', {
  url: 'https://example.com/dashboard',
  waitUntil: 'networkidle'  // load, domcontentloaded, networkidle
});
```

### 2. UI Analysis

```javascript
// Analyze current page
const uiAnalysis = await mcpClient.call('analyze_ui', {
  scope: 'viewport'  // 'viewport' or 'document'
});

console.log('UI Elements Found:');
console.log(`- Forms: ${uiAnalysis.forms.length}`);
console.log(`- Buttons: ${uiAnalysis.buttons.length}`);
console.log(`- Inputs: ${uiAnalysis.inputs.length}`);
console.log(`- Landmarks: ${uiAnalysis.landmarks.length}`);
```

### 3. Form Inference

```javascript
// Infer form structure with context
const formInference = await mcpClient.call('infer_form', {
  goal: 'signup',  // 'signup', 'login', 'checkout', 'contact'
  hints: {
    preferredFieldOrder: ['email', 'password', 'confirmPassword']
  }
});

console.log(`Form confidence: ${formInference.confidence}`);
console.log(`Fields detected: ${formInference.formSchema.fields.length}`);
```

### 4. Fill and Submit Forms

```javascript
// Fill form with generated data
const testRun = await mcpClient.call('fill_and_submit', {
  formSchema: formInference.formSchema,
  overrides: {
    email: 'custom@example.com',
    acceptTerms: true
  }
});

console.log(`Test result: ${testRun.result}`);
console.log(`Errors found: ${testRun.errors.length}`);
```

### 5. Complete Flow Execution

```javascript
// Run entire flow from goal description
const flowResult = await mcpClient.call('run_flow', {
  goal: 'Sign up a new user with strong password',
  url: 'https://app.example.com/signup',
  constraints: {
    requireStrongPassword: true,
    acceptTerms: true,
    skipNewsletter: false
  }
});

// Analyze results
if (flowResult.result === 'failed') {
  console.log('Flow failed with errors:');
  flowResult.errors.forEach(error => {
    console.log(`- ${error.type}: ${error.message}`);
  });
}
```

## Advanced Features

### Custom Data Generation

```javascript
// Override default data generation
const customData = {
  email: 'test.user+{{timestamp}}@company.com',
  firstName: 'Test',
  lastName: 'User',
  password: 'CustomP@ss123!',
  company: 'Acme Corporation'
};

const result = await mcpClient.call('fill_and_submit', {
  formSchema: formInference.formSchema,
  overrides: customData
});
```

### Selector Validation

```javascript
// Validate specific selectors exist
const validation = await mcpClient.call('assert_selectors', {
  assertions: [
    {
      selector: '[data-test="signup-form"]',
      exists: true,
      textMatches: /sign up|create account/i
    },
    {
      selector: '.error-message',
      exists: false
    },
    {
      selector: '[role="button"]',
      exists: true,
      count: { min: 1, max: 3 }
    }
  ]
});

console.log(`Assertions passed: ${validation.pass}`);
```

### Error Collection

```javascript
// Collect specific error types
const errors = await mcpClient.call('collect_errors', {
  types: ['console', 'network', 'validation']
});

// Filter and analyze errors
const validationErrors = errors.errors.filter(e => e.type === 'validation');
const networkErrors = errors.errors.filter(e => e.type === 'network');

console.log(`Validation errors: ${validationErrors.length}`);
console.log(`Network errors: ${networkErrors.length}`);
```

## Integration Patterns

### CI/CD Pipeline Integration

```yaml
# GitHub Actions example
name: UI Testing
on: [push, pull_request]

jobs:
  ui-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install MCP UI Probe
        run: npm install -g mcp-ui-probe

      - name: Run UI Tests
        run: |
          node scripts/ui-tests.js
        env:
          BASE_URL: ${{ secrets.BASE_URL }}
```

### Test Script Example

```javascript
// scripts/ui-tests.js
import { MCPClient } from '@modelcontextprotocol/sdk';

async function runSignupFlow() {
  const client = new MCPClient();
  await client.connect('ui-probe');

  try {
    // Test signup flow
    const result = await client.call('run_flow', {
      goal: 'Complete user registration',
      url: process.env.BASE_URL + '/signup'
    });

    if (result.result === 'failed') {
      console.error('Signup flow failed:', result.errors);
      process.exit(1);
    }

    console.log('Signup flow passed successfully');

    // Export detailed report
    await client.call('export_report', {
      runId: result.runId,
      format: 'junit',
      outputPath: './test-results/signup-flow.xml'
    });

  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}

runSignupFlow();
```

### Jest Integration

```javascript
// __tests__/ui-flows.test.js
import { MCPClient } from '@modelcontextprotocol/sdk';

describe('User Flows', () => {
  let mcpClient;

  beforeAll(async () => {
    mcpClient = new MCPClient();
    await mcpClient.connect('ui-probe');
  });

  afterAll(async () => {
    await mcpClient.disconnect();
  });

  beforeEach(async () => {
    // Navigate to base URL before each test
    await mcpClient.call('navigate', {
      url: process.env.BASE_URL
    });
  });

  test('User can sign up successfully', async () => {
    const result = await mcpClient.call('run_flow', {
      goal: 'signup',
      url: process.env.BASE_URL + '/signup'
    });

    expect(result.result).toBe('passed');
    expect(result.errors.length).toBe(0);
  });

  test('Login validation works correctly', async () => {
    const result = await mcpClient.call('run_flow', {
      goal: 'login with invalid credentials',
      url: process.env.BASE_URL + '/login',
      constraints: {
        useInvalidCredentials: true
      }
    });

    expect(result.result).toBe('passed_with_warnings');
    expect(result.errors.some(e => e.type === 'validation')).toBe(true);
  });
});
```

## Best Practices

### 1. Form Goal Specification

Be specific about your testing goals:

```javascript
// Good: Specific and actionable
const result = await mcpClient.call('run_flow', {
  goal: 'Complete checkout with credit card payment',
  constraints: {
    paymentMethod: 'credit_card',
    requireBillingAddress: true,
    validateCVV: true
  }
});

// Avoid: Too vague
const result = await mcpClient.call('run_flow', {
  goal: 'buy something'
});
```

### 2. Error Handling

Always handle and analyze errors appropriately:

```javascript
const result = await mcpClient.call('run_flow', { goal: 'signup' });

switch (result.result) {
  case 'passed':
    console.log('✅ Flow completed successfully');
    break;

  case 'passed_with_warnings':
    console.log('⚠️  Flow completed with warnings');
    result.errors.forEach(error => {
      if (error.type === 'console') {
        console.warn(`Console warning: ${error.message}`);
      }
    });
    break;

  case 'failed':
    console.error('❌ Flow failed');
    const criticalErrors = result.errors.filter(e =>
      e.type === 'validation' || e.type === 'timeout'
    );
    criticalErrors.forEach(error => {
      console.error(`${error.type}: ${error.message} at ${error.selector}`);
    });
    break;
}
```

### 3. Data Override Strategies

Use data overrides strategically:

```javascript
// Test specific scenarios
const testScenarios = [
  // International user
  {
    email: 'test@company.co.uk',
    phone: '+44 20 7946 0958',
    country: 'United Kingdom'
  },
  // Edge case data
  {
    email: 'test+tag@domain-with-hyphens.com',
    firstName: 'María José',
    lastName: "O'Connor-Smith"
  },
  // Boundary testing
  {
    password: 'A1!' + 'b'.repeat(250), // Test max length
    age: 13 // Test minimum age validation
  }
];

for (const scenario of testScenarios) {
  const result = await mcpClient.call('fill_and_submit', {
    formSchema: formInference.formSchema,
    overrides: scenario
  });

  console.log(`Scenario ${JSON.stringify(scenario)}: ${result.result}`);
}
```

### 4. Performance Monitoring

Track performance metrics:

```javascript
const startTime = Date.now();

const result = await mcpClient.call('run_flow', {
  goal: 'complete checkout',
  url: 'https://shop.example.com'
});

const totalTime = Date.now() - startTime;
const flowTime = result.metrics.totalTimeMs;

console.log(`Total test time: ${totalTime}ms`);
console.log(`Flow execution time: ${flowTime}ms`);
console.log(`Overhead: ${totalTime - flowTime}ms`);

// Alert on performance degradation
if (flowTime > 10000) {
  console.warn('⚠️  Flow taking longer than expected');
}
```

## Troubleshooting Common Issues

### Form Not Detected

```javascript
// Debug form detection
const analysis = await mcpClient.call('analyze_ui');

if (analysis.forms.length === 0) {
  console.log('No forms found. Available elements:');
  console.log(`Buttons: ${analysis.buttons.length}`);
  console.log(`Inputs: ${analysis.inputs.length}`);

  // Look for form-like structures
  const inputs = analysis.inputs.filter(input =>
    ['email', 'password', 'text'].includes(input.type)
  );

  if (inputs.length > 0) {
    console.log('Found standalone inputs - may be an AJAX form');
  }
}
```

### Low Confidence Inference

```javascript
const inference = await mcpClient.call('infer_form', {
  goal: 'signup',
  hints: {
    emailSelector: '[name="email"]',
    passwordSelector: '[name="password"]',
    submitSelector: 'button[type="submit"]'
  }
});

if (inference.confidence < 0.7) {
  console.warn('Low confidence inference. Consider providing hints:');
  console.log('Available forms:');

  const analysis = await mcpClient.call('analyze_ui');
  analysis.forms.forEach((form, index) => {
    console.log(`Form ${index}: ${form.name} (${form.fields.length} fields)`);
  });
}
```

## Environment Configuration

### Environment Variables

```bash
# Browser configuration
UI_PROBE_HEADLESS=true          # Run in headless mode
UI_PROBE_BROWSER=chromium       # chromium, firefox, webkit
UI_PROBE_VIEWPORT=1280x800      # Viewport size
UI_PROBE_TIMEOUT=30000          # Default timeout in ms

# Data generation
UI_PROBE_EMAIL_DOMAIN=test.com  # Default email domain
UI_PROBE_LOCALE=en-US           # Locale for data generation

# Screenshots and artifacts
UI_PROBE_SCREENSHOTS=true       # Enable screenshots
UI_PROBE_ARTIFACTS_DIR=./artifacts  # Artifacts directory

# Logging
UI_PROBE_LOG_LEVEL=info         # error, warn, info, debug
UI_PROBE_LOG_FORMAT=json        # json, simple
```

### Configuration File

```json
// .mcpui.json
{
  "browser": {
    "headless": true,
    "slowMo": 0,
    "args": ["--no-sandbox", "--disable-setuid-sandbox"]
  },
  "timeouts": {
    "navigation": 30000,
    "element": 10000,
    "action": 5000
  },
  "dataGeneration": {
    "emailDomain": "test.company.com",
    "locale": "en-US",
    "randomSeed": null
  },
  "reporting": {
    "screenshots": true,
    "videos": false,
    "har": false,
    "consoleOutput": true
  }
}
```

This comprehensive usage guide should help teams quickly adopt intelligent UI testing and integrate it into their development workflows effectively.