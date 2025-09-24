# MCP UI Probe API Reference

## Core MCP Tools

### navigate

Navigate to a URL and wait for page load.

**Parameters:**
- `url` (string, required): The URL to navigate to
- `waitUntil` (string, optional): Wait condition - 'load', 'domcontentloaded', 'networkidle'

**Returns:**
```json
{
  "ok": true,
  "currentUrl": "https://example.com/actual-url"
}
```

**Example:**
```javascript
await mcpClient.call('navigate', {
  url: 'https://app.example.com/signup',
  waitUntil: 'networkidle'
});
```

---

### analyze_ui

Analyze the current page UI structure and extract elements.

**Parameters:**
- `scope` (string, optional): 'viewport' or 'document' (default: 'document')

**Returns:**
```json
{
  "forms": [
    {
      "name": "signup",
      "selector": "#signup-form",
      "fields": [
        {
          "name": "email",
          "type": "email",
          "selector": "#email",
          "required": true,
          "placeholder": "Enter your email",
          "label": "Email Address"
        }
      ],
      "submit": {
        "selector": "button[type='submit']",
        "text": "Sign Up"
      }
    }
  ],
  "buttons": [
    {
      "type": "button",
      "selector": "#submit-btn",
      "text": "Submit",
      "attributes": {
        "type": "submit",
        "disabled": "false"
      },
      "role": "button",
      "name": "Submit form",
      "bounds": {
        "x": 100,
        "y": 200,
        "width": 120,
        "height": 40
      }
    }
  ],
  "inputs": [...],
  "roles": [...],
  "landmarks": [...]
}
```

**Example:**
```javascript
const analysis = await mcpClient.call('analyze_ui', {
  scope: 'viewport'
});

console.log(`Found ${analysis.forms.length} forms`);
```

---

### infer_form

Intelligently infer form structure and purpose from UI analysis.

**Parameters:**
- `goal` (string, optional): The intended user goal - 'signup', 'login', 'checkout', 'contact'
- `hints` (object, optional): Additional hints for form inference

**Hints Object:**
```json
{
  "emailSelector": "#email-input",
  "passwordSelector": "#pwd",
  "submitSelector": "button.submit",
  "preferredFieldOrder": ["email", "password", "confirmPassword"]
}
```

**Returns:**
```json
{
  "formSchema": {
    "name": "signup",
    "selector": "#signup-form",
    "fields": [
      {
        "name": "email",
        "type": "email",
        "selector": "#email",
        "required": true,
        "placeholder": "Enter your email",
        "label": "Email Address",
        "rules": ["required", "format:email"],
        "policy": null
      },
      {
        "name": "password",
        "type": "password",
        "selector": "#password",
        "required": true,
        "rules": ["required", "min:8", "policy:1upper,1digit,1symbol"],
        "policy": {
          "min": 8,
          "upper": 1,
          "digit": 1,
          "symbol": 1
        }
      }
    ],
    "submit": {
      "selector": "button[type='submit']",
      "text": "Create Account"
    }
  },
  "confidence": 0.87
}
```

**Example:**
```javascript
const inference = await mcpClient.call('infer_form', {
  goal: 'signup',
  hints: {
    emailSelector: '[data-test="email"]',
    passwordSelector: '[data-test="password"]'
  }
});

if (inference.confidence < 0.7) {
  console.warn('Low confidence inference');
}
```

---

### fill_and_submit

Fill form fields with generated or provided data and submit the form.

**Parameters:**
- `formSchema` (object, required): Form schema from `infer_form`
- `overrides` (object, optional): Override specific field values

**Override Examples:**
```json
{
  "email": "custom@example.com",
  "firstName": "Test",
  "lastName": "User",
  "acceptTerms": true,
  "newsletter": false
}
```

**Returns:**
```json
{
  "runId": "uuid-string",
  "target": {
    "url": "https://example.com/signup",
    "viewport": "1280x800",
    "userAgent": "Mozilla/5.0..."
  },
  "flow": [
    {
      "stepId": "uuid-string",
      "action": "fill",
      "selector": "#email",
      "inferredIntent": "Fill email field",
      "input": {
        "email": "test@example.com"
      },
      "outcome": "success",
      "latencyMs": 342,
      "timestamp": "2024-01-15T10:30:00Z"
    },
    {
      "stepId": "uuid-string",
      "action": "click",
      "selector": "button[type='submit']",
      "inferredIntent": "Submit form",
      "outcome": "success",
      "latencyMs": 156,
      "timestamp": "2024-01-15T10:30:01Z"
    }
  ],
  "findings": {
    "forms": [...],
    "accessibility": {
      "axeViolations": 0,
      "details": []
    }
  },
  "errors": [
    {
      "type": "validation",
      "selector": "#password",
      "message": "Password must contain a number",
      "code": "E_VALIDATION_RULE",
      "evidence": {
        "text": "Password must contain a number",
        "ariaLive": true,
        "screenshot": "/tmp/error-screenshot.png"
      },
      "timestamp": "2024-01-15T10:30:02Z"
    }
  ],
  "result": "passed_with_warnings",
  "metrics": {
    "totalTimeMs": 4211,
    "steps": 7,
    "networkErrors": 0,
    "consoleErrors": 1
  }
}
```

**Example:**
```javascript
const result = await mcpClient.call('fill_and_submit', {
  formSchema: inference.formSchema,
  overrides: {
    email: 'test.user@company.com',
    acceptTerms: true
  }
});

console.log(`Test result: ${result.result}`);
```

---

### run_flow

Execute complete user flow from goal description with automatic form discovery.

**Parameters:**
- `goal` (string, required): High-level description of the user goal
- `url` (string, optional): Starting URL (if different from current page)
- `constraints` (object, optional): Flow constraints and preferences

**Constraint Examples:**
```json
{
  "requireStrongPassword": true,
  "acceptTerms": true,
  "skipNewsletter": false,
  "paymentMethod": "credit_card",
  "locale": "en-US",
  "timeout": 30000
}
```

**Returns:** Same as `fill_and_submit`

**Example:**
```javascript
const flowResult = await mcpClient.call('run_flow', {
  goal: 'Sign up a new user with strong password requirements',
  url: 'https://app.example.com/signup',
  constraints: {
    requireStrongPassword: true,
    acceptTerms: true,
    skipNewsletter: true
  }
});
```

---

### click_button

Click a button or link on the page by its text content.

**Parameters:**
- `text` (string, optional): Button text to search for (exact or partial match)
- `selector` (string, optional): CSS selector for the button (used if text not provided)
- `waitForNavigation` (boolean, optional): Wait for navigation after click (default: true)

**Returns:**
```json
{
  "success": true,
  "data": {
    "clicked": true,
    "selector": "button:has-text(\"Submit Form\")",
    "currentUrl": "http://localhost:8083/test/success",
    "pageTitle": "Success - UI-Probe"
  }
}
```

**Example:**
```javascript
// Click by text
const result = await mcpClient.call('click_button', {
  text: 'Submit',
  waitForNavigation: true
});

// Click by selector
const result = await mcpClient.call('click_button', {
  selector: '#submit-btn',
  waitForNavigation: false
});

console.log(`Clicked: ${result.data.clicked}`);
console.log(`New URL: ${result.data.currentUrl}`);
```

---

### assert_selectors

Validate that specific selectors exist and meet criteria.

**Parameters:**
- `assertions` (array, required): Array of assertion objects

**Assertion Object:**
```json
{
  "selector": "#submit-button",
  "exists": true,
  "visible": true,
  "textMatches": "Submit|Send",
  "count": {
    "min": 1,
    "max": 1
  },
  "attributes": {
    "disabled": "false",
    "aria-label": "Submit form"
  }
}
```

**Returns:**
```json
{
  "pass": true,
  "failures": [
    {
      "selector": "#missing-element",
      "expected": "exists: true",
      "actual": "element not found",
      "message": "Element #missing-element was not found on the page"
    }
  ],
  "summary": {
    "total": 5,
    "passed": 4,
    "failed": 1
  }
}
```

**Example:**
```javascript
const validation = await mcpClient.call('assert_selectors', {
  assertions: [
    {
      selector: '[data-test="signup-form"]',
      exists: true,
      visible: true
    },
    {
      selector: '.error-message',
      exists: false
    },
    {
      selector: 'input[type="email"]',
      exists: true,
      count: { min: 1, max: 1 }
    }
  ]
});
```

---

### collect_errors

Collect and categorize errors from the current page.

**Parameters:**
- `types` (array, optional): Error types to collect - 'console', 'network', 'validation'

**Returns:**
```json
{
  "errors": [
    {
      "type": "console",
      "message": "Uncaught TypeError: Cannot read property 'value' of null",
      "code": "E_CONSOLE_ERROR",
      "timestamp": "2024-01-15T10:30:00Z",
      "evidence": {
        "stack": "Error stack trace...",
        "line": 42,
        "column": 15
      }
    },
    {
      "type": "network",
      "message": "Failed to fetch /api/users",
      "code": "E_NETWORK_ERROR",
      "timestamp": "2024-01-15T10:30:01Z",
      "evidence": {
        "url": "/api/users",
        "status": 500,
        "response": "Internal Server Error"
      }
    },
    {
      "type": "validation",
      "selector": "#email",
      "message": "Please enter a valid email address",
      "code": "E_VALIDATION_RULE",
      "timestamp": "2024-01-15T10:30:02Z",
      "evidence": {
        "text": "Please enter a valid email address",
        "ariaLive": true
      }
    }
  ],
  "summary": {
    "total": 3,
    "console": 1,
    "network": 1,
    "validation": 1
  }
}
```

**Example:**
```javascript
const errors = await mcpClient.call('collect_errors', {
  types: ['validation', 'console']
});

const validationErrors = errors.errors.filter(e => e.type === 'validation');
console.log(`Found ${validationErrors.length} validation errors`);
```

---

### export_report

Export test results in various formats.

**Parameters:**
- `runId` (string, required): Test run ID from previous execution
- `format` (string, required): Export format - 'json', 'junit', 'allure', 'html'
- `outputPath` (string, optional): Output file path

**Returns:**
```json
{
  "path": "/path/to/exported/report.xml",
  "format": "junit",
  "size": 2048,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Example:**
```javascript
const report = await mcpClient.call('export_report', {
  runId: testRun.runId,
  format: 'junit',
  outputPath: './test-results/ui-test.xml'
});

console.log(`Report exported to: ${report.path}`);
```

## Data Types

### FormField

```typescript
interface FormField {
  name: string;
  type: string;
  selector: string;
  required: boolean;
  placeholder?: string;
  label?: string;
  rules?: string[];
  policy?: {
    min?: number;
    max?: number;
    upper?: number;
    digit?: number;
    symbol?: number;
  };
}
```

### TestStep

```typescript
interface TestStep {
  stepId: string;
  action: 'fill' | 'click' | 'navigate' | 'assert' | 'wait';
  selector: string;
  inferredIntent: string;
  input?: Record<string, any>;
  outcome: 'success' | 'fail' | 'timeout';
  latencyMs: number;
  timestamp: string;
  artifacts?: {
    screenshot?: string;
    console?: string[];
    network?: any[];
  };
}
```

### TestError

```typescript
interface TestError {
  type: 'validation' | 'console' | 'network' | 'timeout';
  selector?: string;
  message: string;
  code: string;
  evidence?: {
    text?: string;
    ariaLive?: boolean;
    screenshot?: string;
    stack?: string;
    url?: string;
    status?: number;
    response?: string;
  };
  timestamp: string;
}
```

### UIElement

```typescript
interface UIElement {
  type: string;
  selector: string;
  text: string;
  attributes: Record<string, string>;
  role: string;
  name: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

## Error Codes

### Validation Errors (E_VALIDATION_*)
- `E_VALIDATION_RULE`: Form validation rule violation
- `E_VALIDATION_FORMAT`: Invalid data format
- `E_VALIDATION_REQUIRED`: Required field missing

### Console Errors (E_CONSOLE_*)
- `E_CONSOLE_ERROR`: JavaScript console error
- `E_CONSOLE_WARNING`: JavaScript console warning

### Network Errors (E_NETWORK_*)
- `E_NETWORK_ERROR`: HTTP request failure
- `E_NETWORK_TIMEOUT`: Request timeout
- `E_NETWORK_CORS`: CORS policy violation

### System Errors (E_SYSTEM_*)
- `E_SELECTOR_NOT_FOUND`: Element selector not found
- `E_NAVIGATION_FAILED`: Page navigation failure
- `E_TIMEOUT`: Operation timeout
- `E_FORM_INFERENCE_FAILED`: Form structure inference failure

## Configuration Options

### Browser Configuration

```json
{
  "browser": {
    "type": "chromium",
    "headless": true,
    "viewport": {
      "width": 1280,
      "height": 800
    },
    "userAgent": "custom-user-agent",
    "locale": "en-US",
    "timezone": "America/New_York"
  }
}
```

### Timeout Configuration

```json
{
  "timeouts": {
    "navigation": 30000,
    "element": 10000,
    "action": 5000,
    "form_submission": 15000
  }
}
```

### Data Generation Configuration

```json
{
  "dataGeneration": {
    "locale": "en-US",
    "emailDomain": "test.company.com",
    "phoneFormat": "US",
    "addressFormat": "US",
    "randomSeed": 12345
  }
}
```

### Reporting Configuration

```json
{
  "reporting": {
    "screenshots": true,
    "videos": false,
    "har": true,
    "consoleOutput": true,
    "performanceMetrics": true,
    "accessibilityScans": true
  }
}
```

## Usage Examples

### Basic Form Testing

```javascript
// Navigate and test signup flow
await mcpClient.call('navigate', { url: 'https://app.example.com/signup' });

const analysis = await mcpClient.call('analyze_ui');
const inference = await mcpClient.call('infer_form', { goal: 'signup' });

const result = await mcpClient.call('fill_and_submit', {
  formSchema: inference.formSchema,
  overrides: {
    email: 'test@company.com',
    acceptTerms: true
  }
});

console.log(`Result: ${result.result}`);
```

### Error Validation Testing

```javascript
// Test form validation by providing invalid data
const invalidDataResult = await mcpClient.call('fill_and_submit', {
  formSchema: inference.formSchema,
  overrides: {
    email: 'invalid-email',
    password: '123' // Too short
  }
});

const validationErrors = invalidDataResult.errors.filter(e => e.type === 'validation');
expect(validationErrors.length).toBeGreaterThan(0);
```

### Accessibility Testing

```javascript
// Test keyboard navigation
const a11yResult = await mcpClient.call('run_flow', {
  goal: 'Complete signup using only keyboard navigation',
  constraints: {
    keyboardOnly: true,
    screenReader: true
  }
});

// Validate ARIA labels
const selectorValidation = await mcpClient.call('assert_selectors', {
  assertions: [
    {
      selector: 'input[type="email"]',
      attributes: {
        'aria-label': /.+/
      }
    }
  ]
});
```

This API reference provides comprehensive documentation for integrating intelligent UI testing into development workflows and CI/CD pipelines.