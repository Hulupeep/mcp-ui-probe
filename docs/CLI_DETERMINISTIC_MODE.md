# CLI Deterministic Mode - Complete Guide

## Overview

UI-Probe now supports **deterministic CLI mode** for running automated tests without requiring LLM/GPT inference. This mode is perfect for CI/CD pipelines where you need:

- Guaranteed, repeatable results
- No external API dependencies
- Fast execution with direct selectors
- Structured JSON output
- Proper exit codes for CI/CD integration

## Quick Start

```bash
# Run a scenario
npx mcp-ui-probe run --scenario scenarios/verifiable-clinical.yaml --base-url http://localhost:3100

# With custom timeout and retries
npx mcp-ui-probe run \
  --scenario scenarios/test.yaml \
  --timeout 15000 \
  --retries 3 \
  --capture-screenshot-on-error \
  --output-report /tmp/report.json
```

## Command Line Interface

### Usage

```bash
npx mcp-ui-probe run [options]
```

### Required Options

- `--scenario <path>` - Path to scenario YAML or JSON file

### Optional Options

- `--base-url <url>` - Override base URL from scenario
- `--persona <name>` - Specify persona (e.g., clinical, storm)
- `--timeout <ms>` - Default timeout in milliseconds (default: 30000)
- `--retries <number>` - Retries per step (default: 1)
- `--capture-screenshot-on-error` - Capture screenshots on failure
- `--disable-charts` - Set __AMP_DISABLE_CHARTS global
- `--headless [true|false]` - Run in headless mode (default: true)
- `--output-report <path>` - Save JSON report to file
- `--llm <provider>` - LLM provider: openai|anthropic|none (default: none)
- `--no-llm, --force-selectors` - Disable LLM, use only selectors
- `--help, -h` - Show help message

## Scenario Definition Format

### YAML Example

```yaml
name: verifiable-clinical
description: Test the clinical persona verifiable workflow
baseUrl: http://localhost:3100/verifiable
persona: clinical
timeout: 30000
retries: 2
captureScreenshotOnError: true

setup:
  - setGlobal:
      __AMP_VERIFIABLE_EXECUTE_PATH: '/api/verifiable/test-execute'
      __AMP_DISABLE_CHARTS: true

steps:
  # Click action by testId
  - click:
      testId: verifiable-launch-button

  # Wait for API response
  - waitForResponse:
      url: '/api/verifiable/test-execute'
      method: POST
      timeoutMs: 10000

  # Assert text content
  - assertText:
      testId: verifiable-evidence
      contains: 'Patient receives an inflammation-focused action plan'

  # Take screenshot
  - screenshot: /tmp/verifiable-clinical-final.png
```

### JSON Example

```json
{
  "name": "simple-login",
  "description": "Simple login form test",
  "baseUrl": "http://localhost:8081/login",
  "timeout": 15000,
  "retries": 1,
  "steps": [
    {
      "type": {
        "testId": "email-input",
        "text": "test@example.com"
      }
    },
    {
      "type": {
        "testId": "password-input",
        "text": "password123"
      }
    },
    {
      "click": {
        "testId": "login-button"
      }
    },
    {
      "waitForSelector": {
        "testId": "dashboard",
        "timeoutMs": 5000,
        "state": "visible"
      }
    },
    {
      "assertText": {
        "testId": "welcome-message",
        "contains": "Welcome"
      }
    }
  ]
}
```

## Supported Actions

### 1. Click Action

Click buttons, links, or interactive elements.

```yaml
- click:
    testId: my-button        # data-testid attribute
    # OR
    role: button             # ARIA role
    name: Submit             # Accessible name
    # OR
    selector: '#submit-btn'  # CSS selector
    # OR
    text: Click Me          # Text content
```

**Example:**
```yaml
- click:
    testId: verifiable-launch-button

- click:
    role: tab
    name: Storm Claim Analyst

- click:
    selector: 'button.primary'
```

### 2. Wait for Response

Wait for network API calls to complete.

```yaml
- waitForResponse:
    url: '/api/verifiable/test-execute'
    method: POST                # GET, POST, PUT, DELETE, PATCH
    timeoutMs: 10000            # Optional timeout
    status: 200                 # Optional expected status code
```

**Example:**
```yaml
- waitForResponse:
    url: '/api/verifiable/test-execute'
    method: POST
    timeoutMs: 10000

- waitForResponse:
    url: '/api/users'
    method: GET
    status: 200
```

### 3. Assert Text

Verify text content on the page.

```yaml
- assertText:
    testId: result-message
    contains: 'Success'      # Partial match
    # OR
    equals: 'Exact text'     # Exact match
    # OR
    matches: 'regex.*pattern'  # Regex match
```

**Example:**
```yaml
- assertText:
    testId: verifiable-evidence
    contains: 'Patient receives an inflammation-focused action plan'

- assertText:
    selector: '.error-message'
    equals: 'Invalid credentials'

- assertText:
    role: alert
    matches: 'Error: .*'
```

### 4. Type/Fill Input

Type text into input fields.

```yaml
- type:
    testId: email-input
    text: test@example.com
    delay: 100              # Optional delay between keystrokes (ms)
```

**Example:**
```yaml
- type:
    testId: email-input
    text: test@example.com

- type:
    selector: 'input[name="password"]'
    text: password123
```

### 5. Wait for Selector

Wait for elements to appear/disappear.

```yaml
- waitForSelector:
    testId: dashboard
    timeoutMs: 5000
    state: visible           # attached, detached, visible, hidden
```

**Example:**
```yaml
- waitForSelector:
    testId: loading-spinner
    state: hidden
    timeoutMs: 10000

- waitForSelector:
    selector: '.success-message'
    state: visible
```

### 6. Download

Trigger and capture file downloads.

```yaml
- download:
    role: button
    name: Download replay
    saveAs: /tmp/replay.json
```

**Example:**
```yaml
- download:
    testId: download-button
    saveAs: /tmp/report.pdf

- download:
    selector: 'a[href$=".csv"]'
    saveAs: /tmp/data.csv
```

### 7. Screenshot

Capture page screenshots.

```yaml
- screenshot: /tmp/page-screenshot.png
```

### 8. Wait

Simple delay.

```yaml
- wait: 2000  # milliseconds
```

## Selector Strategies

### Priority Order

UI-Probe tries selectors in this order for best reliability:

1. **testId** - `data-testid` attribute (most stable)
2. **role + name** - ARIA role and accessible name
3. **selector** - CSS selector
4. **text** - Text content (least stable)

### Recommended: Use testId

```html
<!-- Your HTML -->
<button data-testid="submit-button">Submit</button>
<input data-testid="email-input" type="email" />
```

```yaml
# Your scenario
- click:
    testId: submit-button

- type:
    testId: email-input
    text: test@example.com
```

### Alternative: ARIA Roles

```yaml
- click:
    role: button
    name: Submit

- click:
    role: tab
    name: Settings
```

### Fallback: CSS Selectors

```yaml
- click:
    selector: '#submit-btn'

- type:
    selector: 'input[name="email"]'
    text: test@example.com
```

## Setup Phase

The `setup` phase runs before steps:

```yaml
setup:
  # Set global JavaScript variables
  - setGlobal:
      __AMP_VERIFIABLE_EXECUTE_PATH: '/api/verifiable/test-execute'
      __AMP_DISABLE_CHARTS: true
      API_BASE_URL: 'http://localhost:3000'

  # Navigate to starting URL
  - navigate: http://localhost:3100/verifiable
    waitForLoad: true       # Wait for networkidle
```

## Output Format

### Success Output

```json
{
  "scenario": "verifiable-clinical",
  "status": "pass",
  "duration": 5432,
  "steps": [
    {
      "step": "click",
      "selector": "[data-testid=\"verifiable-launch-button\"]",
      "status": "pass",
      "duration": 234
    },
    {
      "step": "waitForResponse",
      "selector": "POST /api/verifiable/test-execute",
      "status": "pass",
      "duration": 1523
    },
    {
      "step": "assertText",
      "selector": "[data-testid=\"verifiable-evidence\"]",
      "status": "pass",
      "duration": 156
    }
  ]
}
```

### Failure Output

```json
{
  "scenario": "verifiable-clinical",
  "status": "fail",
  "duration": 3245,
  "steps": [
    {
      "step": "click",
      "selector": "[data-testid=\"verifiable-launch-button\"]",
      "status": "pass",
      "duration": 234
    },
    {
      "step": "waitForResponse",
      "selector": "POST /api/verifiable/test-execute",
      "status": "fail",
      "duration": 10000,
      "error": "Timed out after 10000ms"
    }
  ],
  "error": {
    "step": 2,
    "action": "waitForResponse",
    "reason": "Timed out after 10000ms",
    "screenshot": "data:image/png;base64,..."
  }
}
```

## Exit Codes

- **0** - Success (all steps passed)
- **1** - Failure (one or more steps failed or error occurred)

Perfect for CI/CD integration:

```bash
#!/bin/bash

# Run scenario
npx mcp-ui-probe run --scenario test.yaml --output-report report.json

# Check exit code
if [ $? -eq 0 ]; then
  echo "✅ Tests passed"
  exit 0
else
  echo "❌ Tests failed"
  cat report.json
  exit 1
fi
```

## CI/CD Integration

### GitHub Actions

```yaml
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
        run: npm install

      - name: Install Playwright
        run: npx playwright install chromium

      - name: Start app
        run: npm start &
        env:
          PORT: 3100

      - name: Wait for app
        run: npx wait-on http://localhost:3100

      - name: Run UI tests
        run: |
          npx mcp-ui-probe run \\
            --scenario scenarios/verifiable-clinical.yaml \\
            --base-url http://localhost:3100 \\
            --capture-screenshot-on-error \\
            --output-report test-results.json

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results.json
```

### GitLab CI

```yaml
ui-tests:
  image: node:18
  services:
    - name: playwright/playwright:v1.40.0
  script:
    - npm install
    - npx playwright install chromium
    - npm start &
    - npx wait-on http://localhost:3100
    - npx mcp-ui-probe run --scenario scenarios/test.yaml --output-report report.json
  artifacts:
    when: always
    paths:
      - report.json
      - '*.png'
```

### Jenkins

```groovy
pipeline {
    agent any

    stages {
        stage('Setup') {
            steps {
                sh 'npm install'
                sh 'npx playwright install chromium'
            }
        }

        stage('Start App') {
            steps {
                sh 'npm start &'
                sh 'npx wait-on http://localhost:3100'
            }
        }

        stage('Run Tests') {
            steps {
                sh '''
                    npx mcp-ui-probe run \\
                        --scenario scenarios/verifiable-clinical.yaml \\
                        --base-url http://localhost:3100 \\
                        --output-report test-results.json
                '''
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'test-results.json,*.png', allowEmptyArchive: true
        }
    }
}
```

## Example Scenarios

### Example 1: Verifiable Clinical Workflow

File: `scenarios/verifiable-clinical.yaml`

```yaml
name: verifiable-clinical
description: Test the clinical persona verifiable workflow
baseUrl: http://localhost:3100/verifiable
persona: clinical
timeout: 30000
retries: 2
captureScreenshotOnError: true

setup:
  - setGlobal:
      __AMP_VERIFIABLE_EXECUTE_PATH: '/api/verifiable/test-execute'
      __AMP_DISABLE_CHARTS: true

steps:
  - click:
      testId: verifiable-launch-button

  - waitForResponse:
      url: '/api/verifiable/test-execute'
      method: POST
      timeoutMs: 10000

  - assertText:
      testId: verifiable-evidence
      contains: 'Patient receives an inflammation-focused action plan'

  - assertText:
      testId: verifiable-proof-deck
      contains: 'Citation guardrail'

  - screenshot: /tmp/verifiable-clinical-final.png
```

### Example 2: Storm Claim Analyst

File: `scenarios/verifiable-storm.yaml`

```yaml
name: verifiable-storm
description: Test the storm persona verifiable workflow
baseUrl: http://localhost:3100/verifiable
persona: storm
timeout: 30000
retries: 2
captureScreenshotOnError: true

setup:
  - setGlobal:
      __AMP_VERIFIABLE_EXECUTE_PATH: '/api/verifiable/test-execute'
      __AMP_DISABLE_CHARTS: true

steps:
  - click:
      role: tab
      name: Storm Claim Analyst

  - click:
      testId: verifiable-launch-button

  - waitForResponse:
      url: '/api/verifiable/test-execute'
      method: POST
      timeoutMs: 10000

  - assertText:
      testId: verifiable-evidence
      contains: 'Roof replacement approved'

  - assertText:
      testId: verifiable-proof-deck
      contains: 'Citation guardrail'

  - download:
      role: button
      name: Download replay
      saveAs: /tmp/storm-replay.json

  - screenshot: /tmp/verifiable-storm-final.png
```

### Example 3: Simple Login

File: `scenarios/simple-login.yaml`

```yaml
name: simple-login
description: Simple login form test
baseUrl: http://localhost:8081/login
timeout: 15000
retries: 1

steps:
  - type:
      testId: email-input
      text: test@example.com

  - type:
      testId: password-input
      text: password123

  - click:
      testId: login-button

  - waitForSelector:
      testId: dashboard
      timeoutMs: 5000
      state: visible

  - assertText:
      testId: welcome-message
      contains: Welcome
```

## Troubleshooting

### Scenario Validation Errors

```bash
❌ Scenario validation failed:
  - Scenario name is required
  - Base URL is required
  - Step 3: No action specified
```

**Fix:** Ensure your scenario has required fields and each step has exactly one action.

### Element Not Found

```json
{
  "error": {
    "step": 2,
    "action": "click",
    "reason": "Element not found: [data-testid=\"submit-button\"]"
  }
}
```

**Fix Options:**
1. Verify the testId exists in your HTML
2. Increase timeout: `--timeout 45000`
3. Add wait before click:
   ```yaml
   - wait: 1000
   - click:
       testId: submit-button
   ```

### Timeout Errors

```json
{
  "error": {
    "step": 3,
    "action": "waitForResponse",
    "reason": "Timed out after 10000ms"
  }
}
```

**Fix:**
- Increase step timeout: `timeoutMs: 30000`
- Increase global timeout: `--timeout 60000`
- Check if API endpoint is correct
- Verify network isn't blocked

### Screenshots Not Captured

**Fix:** Ensure write permissions:
```bash
npx mcp-ui-probe run \\
  --scenario test.yaml \\
  --capture-screenshot-on-error
```

## Best Practices

### 1. Use Stable Selectors

✅ **Good:**
```yaml
- click:
    testId: submit-button
```

❌ **Bad:**
```yaml
- click:
    selector: 'body > div:nth-child(3) > button'
```

### 2. Add Meaningful Test IDs

```html
<!-- Add data-testid to your elements -->
<button data-testid="submit-form">Submit</button>
<input data-testid="email-input" type="email" />
<div data-testid="success-message">Success!</div>
```

### 3. Use Appropriate Timeouts

```yaml
# Fast operations
- click:
    testId: button
# Uses default timeout (30000ms)

# Slow API calls
- waitForResponse:
    url: '/api/heavy-operation'
    timeoutMs: 60000  # 60 seconds
```

### 4. Capture Screenshots on Failure

```yaml
captureScreenshotOnError: true
```

Or via CLI:
```bash
--capture-screenshot-on-error
```

### 5. Organize Scenarios

```
scenarios/
  ├── auth/
  │   ├── login.yaml
  │   └── signup.yaml
  ├── checkout/
  │   ├── add-to-cart.yaml
  │   └── complete-purchase.yaml
  └── verifiable/
      ├── clinical.yaml
      └── storm.yaml
```

### 6. Use Setup for Common Config

```yaml
setup:
  - setGlobal:
      __AMP_DISABLE_CHARTS: true
      API_BASE_URL: 'http://localhost:3000'
  - navigate: http://localhost:3000
```

## Differences from LLM Mode

| Feature | Deterministic CLI Mode | LLM Mode (MCP) |
|---------|------------------------|----------------|
| **Requires API Key** | ❌ No | ✅ Yes (OpenAI) |
| **Speed** | ⚡ Fast | 🐢 Slower (API calls) |
| **Cost** | 💰 Free | 💸 $0.01-0.10 per test |
| **Reliability** | ✅ 100% deterministic | ⚠️ May vary |
| **Selectors** | 🎯 Direct (testId, role) | 🤖 AI-inferred |
| **CI/CD Ready** | ✅ Yes | ⚠️ Requires API key |
| **Exit Codes** | ✅ 0/1 | ❌ No |
| **JSON Output** | ✅ Always | ⚠️ Varies |

## When to Use Each Mode

### Use Deterministic CLI Mode When:
- Running in CI/CD pipelines ✅
- Need guaranteed results ✅
- No external dependencies allowed ✅
- Cost is a concern ✅
- Speed is critical ✅

### Use LLM Mode When:
- Exploring new pages 🔍
- Don't have test IDs 🏷️
- Need intelligent inference 🤖
- Testing dynamic UIs 🔄
- Prototyping tests 🛠️

## Summary

Deterministic CLI mode provides:
- ✅ **No LLM required** - Works offline, no API costs
- ✅ **Fast execution** - Direct selector matching
- ✅ **Guaranteed results** - Deterministic, repeatable
- ✅ **CI/CD ready** - Proper exit codes and JSON output
- ✅ **Flexible selectors** - testId, role, CSS, text
- ✅ **Rich actions** - Click, type, wait, assert, download
- ✅ **Error handling** - Retries, screenshots, detailed errors

Perfect for production CI/CD test automation!
