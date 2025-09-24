# MCP UI Probe Test Response Structure Report

## 1. Introduction

This report provides a comprehensive overview of the JSON response structure returned by the MCP UI Probe after executing a test, particularly through the `run_flow` or `fill_and_submit` commands. The response is designed to offer a detailed, multi-layered account of the test execution, from a high-level summary down to individual actions and errors.

## 2. Top-Level Response Structure

The root of the JSON response object contains the following key fields:

| Key | Type | Description |
|---|---|---|
| `runId` | String | A unique identifier for the entire test execution. |
| `target` | Object | Contains information about the environment where the test was run. |
| `flow` | Array | An ordered list of all the individual steps performed during the test. |
| `findings` | Object | A collection of insights and data gathered from the page analysis. |
| `errors` | Array | A list of all errors that occurred during the test execution. |
| `result` | String | The final, high-level outcome of the test. |
| `metrics` | Object | A summary of performance and execution metrics for the test run. |

---

## 3. Detailed Field Descriptions

### 3.1. `runId`
A UUID string that uniquely identifies the test run. This is useful for tracking and referencing specific test executions in logs or reporting systems.

**Example:** `"runId": "a1b2c3d4-e5f6-7890-1234-567890abcdef"`

### 3.2. `target`
An object describing the test environment.

- **`url`** (String): The URL of the page where the test was executed.
- **`viewport`** (String): The dimensions of the browser viewport (e.g., "1280x800").
- **`userAgent`** (String): The User-Agent string of the browser used for the test.

### 3.3. `flow`
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

### 3.4. `findings`
An object containing data and analysis gathered about the page.

- **`forms`** (Array): A list of form elements discovered on the page, including their fields and structure.
- **`accessibility`** (Object): A summary of accessibility audit results, often from tools like Axe. It includes violation counts and details.

### 3.5. `errors`
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

### 3.6. `result`
A string that provides the final, overall status of the test. Possible values are:
- **`passed`**: The test completed successfully with no errors.
- **`passed_with_warnings`**: The test completed, but non-critical issues (like console warnings) were detected.
- **`failed`**: The test did not complete as expected due to one or more errors.

### 3.7. `metrics`
An object summarizing key metrics from the test run.

- **`totalTimeMs`** (Number): The total time for the entire test, in milliseconds.
- **`steps`** (Number): The total number of steps executed in the `flow`.
- **`networkErrors`** (Number): The total count of errors of type `'network'`.
- **`consoleErrors`** (Number): The total count of errors of type `'console'`.

---

## 4. Full JSON Response Example

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

## 5. Conclusion

The MCP UI Probe's test response is a rich, structured JSON object that provides a comprehensive record of a test run. It is designed for both human and machine readability, enabling detailed analysis of test outcomes, performance, and errors. The structure facilitates easy integration into CI/CD pipelines, custom dashboards, and automated reporting systems.
