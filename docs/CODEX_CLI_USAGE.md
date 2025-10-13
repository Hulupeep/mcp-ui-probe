# OpenAI Codex - Deterministic CLI Usage Guide

## Summary for Codex Team

Based on your feedback about MCP timeout issues and brittleness with LLM-based heuristics, we've implemented a **completely deterministic CLI mode** that bypasses the LLM entirely and uses direct selectors. This is production-ready for CI/CD.

---

## The Problem You Encountered

You observed:
```bash
# What you tried (MCP server approach):
node dist/index.js  # MCP server with LLM
node -r dotenv/config test-runner.cjs  # MCP transport with run_flow

# Results:
- ✅ LLM recognized: "✅ LLM available (OPENAI)"
- ❌ Most steps timeout (MCP error -32001)
- ❌ Only simple navigation passes
- ❌ run_flow/button handling is brittle
- ❌ Verifiable playground with deterministic selectors stalls
```

**Root cause:** The MCP server + `run_flow` approach uses LLM inference for selector resolution, which is:
- Slow (60s timeouts)
- Non-deterministic
- Requires API calls
- Still brittle despite LLM assistance

---

## The Solution: Deterministic CLI Mode

We've implemented a **NEW** CLI runner that:
- ✅ **No LLM required** - Uses direct selectors only
- ✅ **Deterministic** - Same input = same output every time
- ✅ **Fast** - No API calls, direct Playwright actions
- ✅ **CI/CD ready** - Exit codes, JSON output, retries
- ✅ **Stable** - testId-based selectors with fallbacks

---

## Quick Start

### 1. Build the Project (if not already done)
```bash
cd MCP-UI-Probe/mcp-ui-probe
npm run build
```

### 2. Use the NEW CLI Runner (Not MCP Server)

**Correct approach** for deterministic execution:
```bash
# Run a deterministic scenario
node dist/cli.js run --scenario scenarios/verifiable-clinical.yaml

# Or using npx
npx mcp-ui-probe run --scenario scenarios/verifiable-clinical.yaml
```

**Wrong approach** (what you tried):
```bash
# ❌ Don't use this for deterministic execution
node dist/index.js  # This starts MCP server (LLM-based)
node -r dotenv/config test-runner.cjs  # This uses MCP transport (slow)
```

---

## Example Scenarios Provided

We've created 3 example scenarios in `scenarios/` directory:

### 1. Clinical Verifiable Workflow
**File:** `scenarios/verifiable-clinical.yaml`
```yaml
name: verifiable-clinical
baseUrl: http://localhost:3100/verifiable
persona: clinical
timeout: 30000
retries: 2

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

**Run it:**
```bash
node dist/cli.js run \
  --scenario scenarios/verifiable-clinical.yaml \
  --base-url http://localhost:3100
```

### 2. Storm Verifiable Workflow
**File:** `scenarios/verifiable-storm.yaml`
```yaml
name: verifiable-storm
baseUrl: http://localhost:3100/verifiable
persona: storm
timeout: 30000
retries: 2

steps:
  - click:
      role: tab
      name: Storm Claim Analyst

  - click:
      testId: verifiable-launch-button

  - waitForResponse:
      url: '/api/verifiable/test-execute'
      method: POST

  - assertText:
      testId: verifiable-evidence
      contains: 'Roof replacement approved'

  - download:
      role: button
      name: Download replay
      saveAs: /tmp/storm-replay.json
```

**Run it:**
```bash
node dist/cli.js run \
  --scenario scenarios/verifiable-storm.yaml \
  --headless false  # See it run
```

### 3. Simple Login (Generic Example)
**File:** `scenarios/simple-login.yaml`
```yaml
name: simple-login
baseUrl: http://localhost:8081/login
timeout: 15000

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
      state: visible

  - assertText:
      testId: welcome-message
      contains: Welcome
```

---

## Complete CLI Options

```bash
node dist/cli.js run [options]

Required:
  --scenario <path>              Path to scenario YAML/JSON file

Optional:
  --base-url <url>               Override scenario base URL
  --persona <name>               Specify persona (clinical, storm)
  --timeout <ms>                 Default timeout (default: 30000)
  --retries <number>             Retries per step (default: 1)
  --capture-screenshot-on-error  Screenshot on failure
  --disable-charts               Set __AMP_DISABLE_CHARTS global
  --headless [true|false]        Headless mode (default: true)
  --output-report <path>         Save JSON report to file
  --llm <provider>               LLM provider: none (default: none)
  --no-llm, --force-selectors    Force direct selectors (recommended)
```

---

## Selector Strategy (Key Difference)

The deterministic CLI uses a **priority system** for finding elements:

```
1. testId (highest priority)  → [data-testid="element-id"]
2. role + name                → button[aria-label="Submit"]
3. CSS selector               → #submit-button
4. Text content (fallback)    → text="Submit"
```

**For your verifiable playground:**
```yaml
# ✅ Best - use testId
- click:
    testId: verifiable-launch-button

# ✅ Good - use role + name
- click:
    role: button
    name: Launch Analysis

# ⚠️ Acceptable - CSS selector
- click:
    selector: "#verifiable-launch-button"

# ❌ Avoid - text content (brittle)
- click:
    text: Launch
```

---

## CI/CD Integration

### Exit Codes
```bash
0 - Success (all steps passed)
1 - Failure (one or more steps failed)
```

### JSON Output
All output is JSON for easy parsing:

**Success:**
```json
{
  "scenario": "verifiable-clinical",
  "status": "pass",
  "duration": 3542,
  "steps": [
    {
      "step": 1,
      "action": "click",
      "status": "success",
      "duration": 234,
      "selector": "[data-testid=\"verifiable-launch-button\"]"
    }
  ]
}
```

**Failure:**
```json
{
  "scenario": "verifiable-clinical",
  "status": "fail",
  "duration": 1247,
  "steps": [...],
  "error": {
    "step": 2,
    "action": "waitForResponse",
    "reason": "Timeout waiting for response to /api/verifiable/test-execute",
    "screenshot": "base64..."
  }
}
```

### GitHub Actions Example
```yaml
name: Verifiable Workflow Tests

on: [push, pull_request]

jobs:
  test-verifiable:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd MCP-UI-Probe/mcp-ui-probe
          npm ci
          npm run build

      - name: Start test server
        run: |
          cd MCP-UI-Probe/mcp-ui-probe
          node dist/test-server/server.js &
          sleep 5

      - name: Run clinical scenario
        run: |
          cd MCP-UI-Probe/mcp-ui-probe
          node dist/cli.js run \
            --scenario scenarios/verifiable-clinical.yaml \
            --base-url http://localhost:8081 \
            --capture-screenshot-on-error \
            --output-report clinical-results.json

      - name: Run storm scenario
        run: |
          cd MCP-UI-Probe/mcp-ui-probe
          node dist/cli.js run \
            --scenario scenarios/verifiable-storm.yaml \
            --base-url http://localhost:8081 \
            --capture-screenshot-on-error \
            --output-report storm-results.json

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: |
            MCP-UI-Probe/mcp-ui-probe/*.json
            MCP-UI-Probe/mcp-ui-probe/screenshots/
```

---

## Environment Setup

### No OpenAI API Key Required
```bash
# ✅ Deterministic CLI works WITHOUT any API key
cd MCP-UI-Probe/mcp-ui-probe
node dist/cli.js run --scenario scenarios/verifiable-clinical.yaml

# No need for:
# - OPENAI_API_KEY
# - .env file
# - LLM configuration
```

### Optional: Enable LLM Fallback
If you want LLM as a fallback (not recommended for CI):
```bash
# Set API key in .env
echo "OPENAI_API_KEY=your-key-here" >> .env

# Run with LLM enabled
node dist/cli.js run \
  --scenario scenarios/verifiable-clinical.yaml \
  --llm openai
```

**Note:** Even with `--llm openai`, the CLI prioritizes direct selectors first.

---

## Comparison: MCP vs Deterministic CLI

| Feature | MCP Server (What You Tried) | Deterministic CLI (NEW) |
|---------|----------------------------|------------------------|
| **Command** | `node dist/index.js` + MCP transport | `node dist/cli.js run --scenario` |
| **LLM Required** | Yes (for inference) | No |
| **Speed** | Slow (60s timeouts) | Fast (direct actions) |
| **Deterministic** | No (LLM varies) | Yes (same every time) |
| **Exit Codes** | No | Yes (0/1) |
| **JSON Output** | No | Yes |
| **Retries** | Limited | Configurable per step |
| **CI/CD Ready** | No | Yes |
| **Selector Strategy** | LLM inference | testId → role → CSS |

---

## Troubleshooting

### Issue: "Scenario validation failed"
```bash
# Check YAML syntax
node dist/cli.js run --scenario scenarios/test.yaml

# Validation errors will show:
❌ Scenario validation failed:
  - Base URL is required
  - Step 3: No action specified
```

### Issue: Element not found
```yaml
# Use the selector priority correctly:
# 1. Try testId first
- click:
    testId: my-button

# 2. If no testId, use role + name
- click:
    role: button
    name: Submit

# 3. Last resort, CSS selector
- click:
    selector: "#submit-btn"
```

### Issue: Timeout waiting for response
```yaml
# Increase timeout for slow APIs
- waitForResponse:
    url: '/api/slow-endpoint'
    method: POST
    timeoutMs: 30000  # 30 seconds
```

### Issue: Assertion fails
```yaml
# Use partial match with 'contains'
- assertText:
    testId: result
    contains: 'Success'  # Matches "Operation Success!"

# Or exact match
- assertText:
    testId: result
    exact: 'Operation Success!'
```

---

## Creating Your Own Scenarios

### Step-by-Step Guide

1. **Create YAML file** (e.g., `scenarios/my-test.yaml`)
```yaml
name: my-test
description: My custom test scenario
baseUrl: http://localhost:8081
timeout: 30000
retries: 2
captureScreenshotOnError: true

steps:
  # Your steps here
```

2. **Add setup if needed**
```yaml
setup:
  - setGlobal:
      __MY_VAR: 'value'

  - navigate:
      url: /start-page
      waitForLoad: true
```

3. **Define your test steps**
```yaml
steps:
  - click:
      testId: start-button

  - type:
      testId: input-field
      text: Hello World

  - waitForSelector:
      testId: result
      state: visible

  - assertText:
      testId: result
      contains: Success
```

4. **Run it**
```bash
node dist/cli.js run \
  --scenario scenarios/my-test.yaml \
  --headless false  # Watch it run
```

---

## Available Actions

### 1. click
Click an element.
```yaml
- click:
    testId: button-id          # Preferred
    # OR
    role: button
    name: Submit
    # OR
    selector: "#submit-btn"
    # OR
    text: Submit
```

### 2. type
Type text into an input field.
```yaml
- type:
    testId: email-input
    text: user@example.com
    delay: 100  # Optional: ms between keystrokes
```

### 3. waitForSelector
Wait for an element to appear.
```yaml
- waitForSelector:
    testId: dashboard
    timeoutMs: 5000
    state: visible  # visible|hidden|attached|detached
```

### 4. waitForResponse
Wait for a network response.
```yaml
- waitForResponse:
    url: '/api/users'
    method: POST  # GET|POST|PUT|DELETE|PATCH
    timeoutMs: 10000
```

### 5. assertText
Assert text content of an element.
```yaml
- assertText:
    testId: message
    contains: 'Success'  # Partial match
    # OR
    exact: 'Operation completed successfully'  # Exact match
```

### 6. download
Download a file.
```yaml
- download:
    testId: download-btn
    saveAs: /tmp/report.pdf
    # OR
    role: button
    name: Download Report
    saveAs: /tmp/report.pdf
```

### 7. screenshot
Take a screenshot.
```yaml
- screenshot: /tmp/page-state.png  # Absolute path
```

### 8. wait
Wait for a fixed duration.
```yaml
- wait: 2000  # Wait 2 seconds
```

---

## Key Recommendations for Codex Team

### ✅ DO:
1. **Use testId attributes** in your verifiable playground components
2. **Use this deterministic CLI** for CI/CD, not the MCP server
3. **Set appropriate timeouts** for your API calls (verifiable-execute can be slow)
4. **Enable screenshots on error** for debugging (`--capture-screenshot-on-error`)
5. **Save reports** for test tracking (`--output-report results.json`)
6. **Use YAML format** for readability and comments

### ❌ DON'T:
1. **Don't use MCP server** for deterministic testing (it's for interactive use)
2. **Don't rely on LLM** for CI/CD (use `--no-llm` or omit `--llm`)
3. **Don't use text-based selectors** as primary strategy (brittle)
4. **Don't run in headed mode** in CI (`--headless true` is default)
5. **Don't skip retries** - set `retries: 2` or more for flaky APIs

---

## Summary

**What changed from your initial attempt:**

| Your Approach | New Approach |
|--------------|--------------|
| `node dist/index.js` | `node dist/cli.js run --scenario` |
| MCP transport | Direct CLI |
| LLM inference | Direct selectors |
| `run_flow` with goal | YAML scenario with steps |
| Non-deterministic | Deterministic |
| Timeouts & brittleness | Fast & reliable |
| No CI integration | CI-ready (exit codes, JSON) |

**Next steps:**
1. Build the project: `npm run build`
2. Run example: `node dist/cli.js run --scenario scenarios/verifiable-clinical.yaml`
3. Create your scenarios in `scenarios/` directory
4. Integrate into your CI/CD pipeline
5. No OpenAI API key needed (unless you want LLM fallback)

**Questions?** See `docs/CLI_DETERMINISTIC_MODE.md` for complete reference.

---

## Testing Right Now

To verify everything works immediately:

```bash
# 1. Start your verifiable playground
node dist/test-server/server.js &  # Port 8081
# (Or use your actual app on localhost:3100)

# 2. Run clinical scenario
node dist/cli.js run \
  --scenario scenarios/verifiable-clinical.yaml \
  --base-url http://localhost:8081 \
  --headless false

# Expected output:
# {
#   "scenario": "verifiable-clinical",
#   "status": "pass",
#   "duration": 3542,
#   "steps": [...]
# }
# Exit code: 0

# 3. Run storm scenario
node dist/cli.js run \
  --scenario scenarios/verifiable-storm.yaml \
  --base-url http://localhost:8081 \
  --capture-screenshot-on-error

# 4. Check exit code
echo $?  # Should be 0 for success, 1 for failure
```

This is production-ready for your CI/CD pipeline. No more MCP timeouts or LLM brittleness.
