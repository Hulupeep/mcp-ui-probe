# MCP UI Probe Response Structure Documentation

## 1. Introduction

MCP UI Probe provides two distinct types of responses:

1. **Simple Tool Responses** - Returned by individual tool commands like `navigate`, `analyze_ui`, `click_button`, etc.
2. **Complex Test Execution Responses** - Returned by comprehensive test commands like `run_flow` and `fill_and_submit`

This document covers both response types to help developers understand the deterministic JSON structures returned by all MCP UI Probe tools.

---

## 2. Simple Tool Responses

### 2.1 Basic Structure

All simple tool commands return a consistent structure:

```json
{
  "success": boolean,
  "data": object,     // Tool-specific response data
  "error": string     // Present only when success=false
}
```

### 2.2 Tool-Specific Response Examples

#### navigate
Navigates to a URL and waits for page load.

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "http://localhost:8083/test",
    "currentUrl": "http://localhost:8083/test"  // May differ if redirected
  }
}
```

#### analyze_ui
Analyzes the current page UI structure.

**Response:**
```json
{
  "success": true,
  "data": {
    "forms": [
      {
        "name": "signup",
        "selector": "#signup-form",
        "fields": [
          {
            "name": "email",
            "type": "email",
            "selector": "#email",
            "required": true
          }
        ]
      }
    ],
    "buttons": [
      {
        "type": "button",
        "selector": "#submit-btn",
        "text": "Submit"
      }
    ],
    "inputs": [...],
    "roles": [...],
    "landmarks": [...]
  }
}
```

#### click_button
Clicks a button or link on the page.

**Response:**
```json
{
  "success": true,
  "data": {
    "clicked": true,
    "selector": "button:has-text(\"Submit\")",
    "currentUrl": "http://localhost:8083/test/success",
    "pageTitle": "Success - UI-Probe"
  }
}
```

#### infer_form
Infers form structure and purpose.

**Response:**
```json
{
  "success": true,
  "data": {
    "formSchema": {
      "name": "signup",
      "selector": "#signup-form",
      "fields": [...],
      "submit": {
        "selector": "button[type='submit']",
        "text": "Sign Up"
      }
    },
    "confidence": 0.87
  }
}
```

#### assert_selectors
Validates element presence and properties.

**Response:**
```json
{
  "success": true,
  "data": {
    "pass": true,
    "failures": [],
    "summary": {
      "total": 5,
      "passed": 5,
      "failed": 0
    }
  }
}
```

#### collect_errors
Collects errors from the current page.

**Response:**
```json
{
  "success": true,
  "data": {
    "errors": [
      {
        "type": "validation",
        "message": "Email is required",
        "selector": "#email",
        "code": "E_VALIDATION_REQUIRED"
      }
    ],
    "summary": {
      "total": 1,
      "console": 0,
      "network": 0,
      "validation": 1
    }
  }
}
```

#### verify_page
Verifies page content and checks for errors.

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "title": "Sign Up - UI-Probe",
    "url": "http://localhost:8083/signup",
    "checks": {
      "expectedContent": true,
      "unexpectedContent": false,
      "titleMatch": true,
      "urlMatch": true
    }
  }
}
```

### 2.3 Error Response Structure

When any tool encounters an error:

```json
{
  "success": false,
  "error": "Element not found: No button with text 'Submit' found on page"
}
```

Common error scenarios:
- Element not found
- Navigation timeout
- Network failure
- Invalid selector
- Page not loaded

---

## 3. Complex Test Execution Responses

The following section describes the comprehensive response structure returned by `run_flow` and `fill_and_submit` commands.

### 3.1 Top-Level Structure

Complex test execution responses from `run_flow` and `fill_and_submit` contain:

| Key | Type | Description |
|---|---|---|
| `runId` | String | A unique identifier for the entire test execution. |
| `target` | Object | Contains information about the environment where the test was run. |
| `flow` | Array | An ordered list of all the individual steps performed during the test. |
| `findings` | Object | A collection of insights and data gathered from the page analysis. |
| `errors` | Array | A list of all errors that occurred during the test execution. |
| `result` | String | The final, high-level outcome of the test. |
| `metrics` | Object | A summary of performance and execution metrics for the test run. |

### 3.2 Detailed Field Descriptions

#### 3.2.1 `runId`
A UUID string that uniquely identifies the test run. This is useful for tracking and referencing specific test executions in logs or reporting systems.

**Example:** `"runId": "a1b2c3d4-e5f6-7890-1234-567890abcdef"`

#### 3.2.2 `target`
An object describing the test environment.

- **`url`** (String): The URL of the page where the test was executed.
- **`viewport`** (String): The dimensions of the browser viewport (e.g., "1280x800").
- **`userAgent`** (String): The User-Agent string of the browser used for the test.

#### 3.2.3 `flow`
This is an array of `TestStep` objects, which together form a chronological narrative of the test. Each object represents a single action taken by the probe.

#### `TestStep` Object Structure
- **`stepId`** (String): A unique identifier for the individual step.
- **`action`** (String): The type of action performed. Can be `'fill'`, `'click'`, `'navigate'`, `'assert'`, or `'wait'`.
- **`selector`** (String): The CSS selector of the HTML element that was the target of the action.
- **`inferredIntent`** (String): A natural language description of the tool's goal for this step (e.g., "Fill email field").
- **`input`** (Object, optional): The data that was used in the action, such as the text typed into a field.
- **`outcome`** (String): The result of this specific step (`'success'`, `'fail'`, or `'timeout'`).
- **`latencyMs`** (Number): The time taken to complete the step, in milliseconds.
- **`timestamp`** (String): An ISO 8601 timestamp of when the step was executed.
- **`artifacts`** (Object, optional): A collection of supplementary materials captured during the step, such as paths to screenshots (`screenshot`) or logs (`console`, `network`).

#### 3.2.4 `findings`
An object containing data and analysis gathered about the page.

- **`forms`** (Array): A list of form elements discovered on the page, including their fields and structure.
- **`accessibility`** (Object): A summary of accessibility audit results, often from tools like Axe. It includes violation counts and details.

#### 3.2.5 `errors`
A crucial array of `TestError` objects. If this array is empty, no errors were officially logged.

#### `TestError` Object Structure
- **`type`** (String): The category of the error. Common types include `'validation'`, `'console'`, `'network'`, and `'timeout'`.
- **`selector`** (String, optional): The CSS selector of the element associated with the error, if applicable.
- **`message`** (String): A human-readable description of the error.
- **`code`** (String): A specific error code for programmatic identification (e.g., `E_VALIDATION_RULE`).
- **`evidence`** (Object, optional): A collection of data that supports the error claim. This can include:
    - `text`: The visible error message text on the page.
    - `screenshot`: A path to a screenshot taken when the error occurred.
    - `stack`: A JavaScript error stack trace.
    - `url`, `status`: Details for network errors.
- **`timestamp`** (String): An ISO 8601 timestamp of when the error was detected.

#### 3.2.6 `result`
A string that provides the final, overall status of the test. Possible values are:
- **`passed`**: The test completed successfully with no errors.
- **`passed_with_warnings`**: The test completed, but non-critical issues (like console warnings) were detected.
- **`failed`**: The test did not complete as expected due to one or more errors.

#### 3.2.7 `metrics`
An object summarizing key metrics from the test run.

- **`totalTimeMs`** (Number): The total time for the entire test, in milliseconds.
- **`steps`** (Number): The total number of steps executed in the `flow`.
- **`networkErrors`** (Number): The total count of errors of type `'network'`.
- **`consoleErrors`** (Number): The total count of errors of type `'console'`.

---

### 3.3 Full JSON Response Example

The following is a complete example illustrating the structure described above.

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
      "stepId": "uuid-string-step1",
      "action": "fill",
      "selector": "#email",
      "inferredIntent": "Fill email field",
      "input": {
        "email": "test@example.com"
      },
      "outcome": "success",
      "latencyMs": 342,
      "timestamp": "2025-09-24T10:30:00Z"
    },
    {
      "stepId": "uuid-string-step2",
      "action": "click",
      "selector": "button[type='submit']",
      "inferredIntent": "Submit form",
      "outcome": "success",
      "latencyMs": 156,
      "timestamp": "2025-09-24T10:30:01Z"
    }
  ],
  "findings": {
    "forms": [],
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
      "timestamp": "2025-09-24T10:30:02Z"
    }
  ],
  "result": "passed_with_warnings",
  "metrics": {
    "totalTimeMs": 4211,
    "steps": 2,
    "networkErrors": 0,
    "consoleErrors": 1
  }
}
```

## 4. Using Response Types Effectively

### 4.1 Choosing the Right Tool

**Use Simple Tools When:**
- You need granular control over individual actions
- Building custom test flows with conditional logic
- Debugging specific UI interactions
- Need immediate feedback for each step

**Use Complex Test Commands When:**
- Running complete end-to-end tests
- Need comprehensive metrics and reporting
- Want automatic error collection and analysis
- Require detailed test execution artifacts

### 4.2 Conditional Logic Example

With simple tools, you can implement conditional flows:

```javascript
// Navigate to page
const navResult = await mcpClient.call('navigate', { url: 'http://localhost:8083/test' });

if (navResult.success) {
  // Analyze the page
  const analysis = await mcpClient.call('analyze_ui');

  // Check if specific form exists
  const hasSignupForm = analysis.data.forms.some(f => f.name === 'signup');

  if (hasSignupForm) {
    // Infer and fill the form
    const inference = await mcpClient.call('infer_form', { goal: 'signup' });

    if (inference.data.confidence > 0.7) {
      const fillResult = await mcpClient.call('fill_and_submit', {
        formSchema: inference.data.formSchema
      });

      // Check the comprehensive result
      if (fillResult.result === 'passed') {
        console.log('✅ Test passed successfully');
      }
    }
  }
}
```

## 5. Conclusion

MCP UI Probe provides deterministic JSON responses across all tools, enabling:

1. **Predictable Automation** - Consistent response structures allow reliable conditional logic
2. **No Code Generation** - Direct tool calls without writing Playwright scripts
3. **Flexible Testing** - Choose between simple tools for control or complex commands for comprehensive testing
4. **Easy Integration** - JSON responses integrate seamlessly with CI/CD pipelines and test frameworks

The dual response structure design balances simplicity for individual operations with comprehensive data for complete test executions.
