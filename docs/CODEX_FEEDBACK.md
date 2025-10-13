# Feedback for OpenAI Codex Team

## Your Observations & Our Solution

### What You Reported
You tried using UI-Probe via MCP server and encountered:

```bash
# Your approach:
node dist/index.js  # MCP server with LLM
node -r dotenv/config test-runner.cjs  # MCP transport

# Your observations:
❌ Most steps timeout (MCP error -32001)
❌ Only simple navigation passes
❌ run_flow/button handling is brittle
❌ "Current UI-Probe heuristics stall before they actually click"
❌ Verifiable playground with deterministic selectors stalls
```

### Root Cause
The MCP server + `run_flow` approach relies on:
- LLM inference for selector resolution (slow, 60s timeout)
- Non-deterministic heuristics
- Complex async coordination between MCP transport and Playwright
- Not designed for CI/CD automation

### Our Solution
We built a **completely new deterministic CLI mode** that:
- ✅ Bypasses LLM entirely (no API key needed)
- ✅ Uses direct selectors (testId → role → CSS)
- ✅ Fast execution (no inference delays)
- ✅ Deterministic (same input = same output)
- ✅ CI/CD ready (exit codes, JSON output, retries)

---

## How to Use the Deterministic CLI

### Quick Test (Right Now)

```bash
# Build the project
cd MCP-UI-Probe/mcp-ui-probe
npm run build

# Run deterministic scenario (NO LLM, NO API KEY)
node dist/cli.js run --scenario scenarios/verifiable-clinical.yaml

# Check exit code
echo $?  # 0 = success, 1 = failure
```

### Your Verifiable Workflows

We created scenarios for both personas:

**1. Clinical Persona**
```bash
node dist/cli.js run \
  --scenario scenarios/verifiable-clinical.yaml \
  --base-url http://localhost:3100 \
  --capture-screenshot-on-error \
  --output-report clinical-results.json
```

Scenario file: `scenarios/verifiable-clinical.yaml`
```yaml
name: verifiable-clinical
baseUrl: http://localhost:3100/verifiable
persona: clinical

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

  - screenshot: /tmp/clinical-final.png
```

**2. Storm Persona**
```bash
node dist/cli.js run \
  --scenario scenarios/verifiable-storm.yaml \
  --base-url http://localhost:3100
```

Scenario file: `scenarios/verifiable-storm.yaml`
```yaml
name: verifiable-storm
baseUrl: http://localhost:3100/verifiable
persona: storm

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

---

## Key Differences: MCP vs Deterministic CLI

| Aspect | MCP Server (You Tried) | Deterministic CLI (NEW) |
|--------|----------------------|----------------------|
| **Command** | `node dist/index.js` | `node dist/cli.js run --scenario` |
| **Purpose** | Interactive LLM-based exploration | Automated CI/CD testing |
| **LLM Required** | Yes | No |
| **API Key** | Required | Not required |
| **Speed** | Slow (60s timeouts) | Fast (direct actions) |
| **Determinism** | No (LLM varies) | Yes (repeatable) |
| **Exit Codes** | No | Yes (0=pass, 1=fail) |
| **JSON Output** | No | Yes (structured) |
| **Retries** | Limited | Per-step configurable |
| **CI/CD Ready** | No | Yes |
| **Brittleness** | High (LLM heuristics) | Low (direct selectors) |

---

## Selector Strategy

The CLI uses a priority system to find elements:

```
Priority 1: testId → [data-testid="element"]  (most stable)
Priority 2: role+name → button[aria-label="Submit"]
Priority 3: CSS selector → #submit-btn
Priority 4: text content → text="Submit"  (fallback)
```

**For your verifiable playground:**
```yaml
# ✅ BEST - Use testId (you already have these)
- click:
    testId: verifiable-launch-button

# ✅ GOOD - Use role + name
- click:
    role: button
    name: Launch Analysis

# ⚠️ OK - CSS selector
- click:
    selector: "#launch-btn"

# ❌ AVOID - Text matching (brittle)
- click:
    text: Launch
```

---

## Available Actions

The CLI supports 8 deterministic actions:

1. **click** - Click an element
2. **type** - Type text into input
3. **waitForSelector** - Wait for element to appear
4. **waitForResponse** - Wait for API call
5. **assertText** - Assert text content
6. **download** - Download a file
7. **screenshot** - Capture screenshot
8. **wait** - Fixed delay

Full documentation: `docs/CLI_DETERMINISTIC_MODE.md`

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Verifiable Workflow Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install & Build
        run: |
          cd MCP-UI-Probe/mcp-ui-probe
          npm ci
          npm run build

      - name: Test Clinical Workflow
        run: |
          cd MCP-UI-Probe/mcp-ui-probe
          node dist/cli.js run \
            --scenario scenarios/verifiable-clinical.yaml \
            --base-url http://localhost:3100 \
            --capture-screenshot-on-error \
            --output-report clinical-results.json

      - name: Test Storm Workflow
        run: |
          cd MCP-UI-Probe/mcp-ui-probe
          node dist/cli.js run \
            --scenario scenarios/verifiable-storm.yaml \
            --base-url http://localhost:3100 \
            --capture-screenshot-on-error \
            --output-report storm-results.json

      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: MCP-UI-Probe/mcp-ui-probe/*.json
```

### Exit Code Usage
```bash
# Run test
node dist/cli.js run --scenario test.yaml

# Check result
if [ $? -eq 0 ]; then
  echo "✅ Test passed"
else
  echo "❌ Test failed"
  exit 1
fi
```

---

## Environment Setup

### No Configuration Required

```bash
# Works out of the box - NO API KEY NEEDED
node dist/cli.js run --scenario scenarios/verifiable-clinical.yaml
```

### Optional: If you want LLM fallback

```bash
# Only if you want LLM as backup (not recommended for CI)
echo "OPENAI_API_KEY=your-key" >> .env

node dist/cli.js run \
  --scenario scenarios/test.yaml \
  --llm openai  # Still uses direct selectors first
```

**Note:** Even with `--llm openai`, direct selectors are tried first. LLM is only used as fallback.

---

## Creating Custom Scenarios

### Basic Template

```yaml
name: my-test
description: Custom test scenario
baseUrl: http://localhost:3100
timeout: 30000
retries: 2
captureScreenshotOnError: true

setup:
  - setGlobal:
      __MY_CONFIG: 'value'

steps:
  - click:
      testId: start-button

  - waitForResponse:
      url: '/api/endpoint'
      method: POST

  - assertText:
      testId: result
      contains: 'Success'

  - screenshot: /tmp/final-state.png
```

---

## Troubleshooting

### "Scenario validation failed"
```bash
# Check your YAML syntax
node dist/cli.js run --scenario test.yaml

# Errors will be specific:
❌ Scenario validation failed:
  - Base URL is required
  - Step 2: No action specified
```

### Timeout waiting for response
```yaml
# Increase timeout for slow APIs
- waitForResponse:
    url: '/api/slow-endpoint'
    timeoutMs: 30000  # 30 seconds instead of default
```

### Element not found
```yaml
# Check selector priority
# 1. Try testId first
- click:
    testId: my-button  # Best

# 2. Try role + name
- click:
    role: button
    name: Submit  # Good

# 3. CSS selector as fallback
- click:
    selector: "#submit-btn"  # OK
```

---

## What This Solves

Based on your reported issues:

| Issue You Reported | How CLI Solves It |
|-------------------|------------------|
| "Most steps timeout (MCP -32001)" | No MCP transport, direct Playwright |
| "Only simple navigation passes" | All actions work (click, type, assert, etc.) |
| "run_flow/button handling is brittle" | Direct testId-based selectors |
| "LLM heuristics stall" | No LLM, direct selector matching |
| "Not ready for CI" | Exit codes, JSON, retries, deterministic |

---

## Next Steps

1. **Test immediately:**
   ```bash
   cd MCP-UI-Probe/mcp-ui-probe
   npm run build
   node dist/cli.js run --scenario scenarios/verifiable-clinical.yaml
   ```

2. **Review provided scenarios:**
   - `scenarios/verifiable-clinical.yaml`
   - `scenarios/verifiable-storm.yaml`
   - `scenarios/simple-login.yaml`

3. **Create your scenarios:**
   - Copy one of the examples
   - Modify for your use case
   - Test with `--headless false` to watch

4. **Integrate into CI/CD:**
   - Use exit codes for pass/fail
   - Parse JSON output for details
   - Save screenshots on failures

5. **Read documentation:**
   - Quick Start: `QUICK_START_CODEX.md`
   - Complete Guide: `docs/CODEX_CLI_USAGE.md`
   - Full Reference: `docs/CLI_DETERMINISTIC_MODE.md`

---

## Summary

**The deterministic CLI is a completely different approach from the MCP server.**

**Don't use:**
```bash
❌ node dist/index.js  # MCP server
❌ node -r dotenv/config test-runner.cjs  # MCP transport
```

**Use instead:**
```bash
✅ node dist/cli.js run --scenario <file>  # Deterministic CLI
```

**Key benefits:**
- No LLM, no API key, no timeouts
- Fast, deterministic, CI-ready
- Exit codes, JSON output, retries
- Works with your testId selectors
- Addresses all issues you reported

**Production ready for CI/CD automation.**

---

## Support & Documentation

- **Quick Start:** `QUICK_START_CODEX.md`
- **Complete Usage:** `docs/CODEX_CLI_USAGE.md`
- **Full Reference:** `docs/CLI_DETERMINISTIC_MODE.md`
- **Example Scenarios:** `scenarios/*.yaml`

Questions? The documentation is comprehensive and includes:
- All CLI options
- All 8 action types with examples
- CI/CD integration patterns
- Troubleshooting guide
- Custom scenario templates

Test it now - it addresses every issue you reported. 🚀
