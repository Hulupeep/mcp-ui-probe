# MCP Timeout Fixes and Troubleshooting Guide

## Overview

This document addresses the MCP error -32001 (Request timed out) issues that were occurring with UI-Probe operations like `click_button`, `analyze_ui`, and `run_flow`.

## Root Causes Identified

### 1. **OpenAI API Calls Without Timeout**
- OpenAI SDK calls had no timeout handling
- If the API was slow or unresponsive, requests would hang indefinitely
- This caused the MCP server to timeout waiting for responses

### 2. **No Retry Logic**
- Single failed LLM call would immediately fail the entire operation
- Transient network issues or API hiccups caused complete failures
- No exponential backoff or retry mechanism

### 3. **Fallback Mode Misconfiguration**
- `UI_PROBE_FALLBACK_MODE=false` required LLM for all operations
- If LLM failed, entire flow would fail
- No graceful degradation

## Fixes Implemented

### 1. **Timeout Handling for OpenAI API Calls** ✅

Added 60-second timeout to all OpenAI API calls with Promise.race():

```typescript
const timeoutMs = this.config.requestTimeout || 60000;
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => {
    reject(new Error(`OpenAI API call timed out after ${timeoutMs}ms`));
  }, timeoutMs);
});

const completion = await Promise.race([
  this.openai.chat.completions.create({...}),
  timeoutPromise
]);
```

**Location**: `src/llm/llmStrategy.ts:250-261`

### 2. **Retry Logic with Exponential Backoff** ✅

Added retry mechanism with up to 2 retries and exponential backoff:

```typescript
const maxRetries = this.config.maxRetries || 2;
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    // Attempt LLM call
    const response = await this.callLLM(prompt, 'parseGoal');
    return response;
  } catch (error) {
    if (attempt < maxRetries) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
// Fall back to regex parser after all retries
```

**Location**: `src/llm/llmStrategy.ts:96-141`

### 3. **Configurable Timeout Settings** ✅

Added new environment variables for timeout configuration:

```bash
# LLM Request Timeout (in milliseconds) - defaults to 60000 (60 seconds)
LLM_REQUEST_TIMEOUT=60000

# LLM Retry Attempts - defaults to 2 retries
LLM_MAX_RETRIES=2
```

**Location**: `.env.example:45-49`

### 4. **Enhanced Logging** ✅

Added comprehensive debug logging for timeout diagnostics:

```typescript
logger.debug(`Attempting LLM goal parsing (attempt ${attempt + 1}/${maxRetries + 1})`, { goal });
logger.warn(`LLM parsing attempt ${attempt + 1} failed`, {
  error: error.message,
  willRetry: attempt < maxRetries
});
```

**Location**: `src/llm/llmStrategy.ts:108, 120-125`

## Configuration Guide

### Step 1: Update Your .env File

Copy the latest `.env.example` to create or update your `.env`:

```bash
cp .env.example .env
```

### Step 2: Configure OpenAI API Key

Ensure your OpenAI API key is set:

```bash
export OPENAI_API_KEY=sk-your-actual-key-here
```

Or add to `.env`:

```bash
OPENAI_API_KEY=sk-your-actual-key-here
```

### Step 3: Set Appropriate Timeouts

For most users, the defaults work well:

```bash
# Default settings (recommended)
UI_PROBE_FALLBACK_MODE=false
LLM_REQUEST_TIMEOUT=60000  # 60 seconds
LLM_MAX_RETRIES=2          # 2 retries with exponential backoff
```

For slower networks or high-latency scenarios:

```bash
# Extended timeouts for slow networks
LLM_REQUEST_TIMEOUT=120000  # 120 seconds
LLM_MAX_RETRIES=3           # 3 retries
```

For faster feedback during development:

```bash
# Faster feedback (may fail more often)
LLM_REQUEST_TIMEOUT=30000   # 30 seconds
LLM_MAX_RETRIES=1           # 1 retry only
```

### Step 4: Enable Debug Logging (Optional)

To troubleshoot timeout issues:

```bash
LOG_LEVEL=debug
```

This will show:
- Each LLM call attempt with timing
- Retry attempts and backoff delays
- Timeout warnings and fallback triggers
- API response details

## Server Startup

### Canonical MCP Server Command

The correct way to start the MCP server:

```bash
npx mcp-ui-probe start
```

**DO NOT** set `UI_PROBE_FALLBACK_MODE=true` unless you want to disable all LLM features.

### For Claude Desktop Integration

Add to your Claude desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "ui-probe": {
      "command": "npx",
      "args": ["mcp-ui-probe", "start"],
      "env": {
        "OPENAI_API_KEY": "sk-your-key-here"
      }
    }
  }
}
```

### Separate Playground Server

For testing with the bundled playground:

```bash
npx mcp-ui-probe test-server --port 8081
```

This starts a separate test server that doesn't interfere with the MCP server.

## Troubleshooting Common Issues

### Issue 1: "MCP error -32001: Request timed out"

**Symptoms**:
- Operations timeout even with valid OpenAI key
- `click_button`, `analyze_ui`, `run_flow` all fail
- Follow-on errors like "Could not find login form"

**Solution**:
1. ✅ **Applied in this fix**: Timeout handling and retry logic
2. Verify your OpenAI API key is valid:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```
3. Check your network connection
4. Increase timeout if on slow network:
   ```bash
   LLM_REQUEST_TIMEOUT=120000
   ```

### Issue 2: "OpenAI API call timed out after 60000ms"

**Symptoms**:
- Explicit timeout error in logs
- Operations fail after exactly 60 seconds

**Solution**:
1. Check OpenAI API status: https://status.openai.com/
2. Verify API key hasn't expired
3. Check for firewall/proxy blocking OpenAI API
4. Try increasing timeout:
   ```bash
   LLM_REQUEST_TIMEOUT=90000  # 90 seconds
   ```

### Issue 3: Operations Still Failing After Retries

**Symptoms**:
- All retry attempts exhausted
- Falls back to regex parser
- Limited functionality

**Solution**:
1. Enable debug logging:
   ```bash
   LOG_LEVEL=debug npx mcp-ui-probe start
   ```
2. Check the logs for specific error messages
3. Verify environment variables are loaded:
   ```bash
   node -r dotenv/config dist/index.js
   ```
4. Try fallback mode temporarily to isolate the issue:
   ```bash
   UI_PROBE_FALLBACK_MODE=true npx mcp-ui-probe start
   ```

### Issue 4: "Cannot find module" or Import Errors

**Symptoms**:
- Server fails to start
- Module resolution errors

**Solution**:
1. Rebuild the project:
   ```bash
   npm run build
   ```
2. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

## Diagnostic Commands

### Check Server Health

```bash
# Test the health_check tool
echo '{"tool": "health_check", "params": {"verbose": true}}' | npx mcp-ui-probe start
```

### View Detailed Logs

```bash
LOG_LEVEL=debug npx mcp-ui-probe start 2>&1 | tee ui-probe.log
```

### Test OpenAI Connection

```bash
node -e "
const { OpenAI } = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
client.chat.completions.create({
  model: 'gpt-4-turbo-preview',
  messages: [{role: 'user', content: 'Hi'}],
  max_tokens: 10
}).then(r => console.log('✅ OpenAI connection OK'))
  .catch(e => console.error('❌ OpenAI connection failed:', e.message));
"
```

## Performance Impact

The timeout and retry fixes have minimal performance impact:

- **Successful operations**: No additional overhead (cached responses)
- **Failed operations**:
  - First retry after 1 second
  - Second retry after 2 seconds
  - Maximum additional delay: ~3 seconds before fallback

- **Timeout overhead**: None unless API actually hangs (rare)

## API Cost Implications

With retry logic:
- **Failed requests**: No additional cost (OpenAI doesn't charge for timeouts)
- **Successful retries**: Only charged once for the successful attempt
- **Cost monitoring**: Still enforced via `UI_PROBE_COST_LIMITS` and `UI_PROBE_MAX_COST`

## Monitoring Timeout Behavior

Enable debug logging to monitor timeout behavior:

```bash
LOG_LEVEL=debug npx mcp-ui-probe start
```

Look for these log messages:
- `Attempting LLM goal parsing (attempt X/Y)` - Shows retry attempts
- `LLM parsing attempt X failed` - Shows failures and retry decisions
- `LLM goal parsing succeeded` - Confirms success after retries
- `All LLM parsing attempts failed, falling back to regex parser` - Final fallback

## Best Practices

1. **Always set OPENAI_API_KEY** in your environment or `.env` file
2. **Keep UI_PROBE_FALLBACK_MODE=false** to use LLM features
3. **Use default timeouts** unless you have specific network constraints
4. **Enable debug logging** when troubleshooting
5. **Monitor OpenAI API status** if experiencing widespread timeouts
6. **Check network connectivity** before assuming configuration issues

## Technical Details

### Timeout Implementation

The timeout is implemented using `Promise.race()`:
- Creates two promises: API call and timeout
- Whichever resolves/rejects first wins
- Ensures operations never hang indefinitely

### Retry Strategy

Exponential backoff with cap:
- Attempt 1: Immediate
- Attempt 2: Wait 1 second
- Attempt 3: Wait 2 seconds
- Maximum wait: 5 seconds (capped)

This prevents overwhelming the API while giving transient issues time to resolve.

### Fallback Behavior

If all LLM attempts fail:
1. Log warning with error details
2. Fall back to regex-based goal parser
3. Continue operation with reduced intelligence
4. Still functional for basic operations

## Support

If you continue to experience timeout issues after applying these fixes:

1. Check https://status.openai.com/ for API outages
2. Enable debug logging and capture logs
3. Verify your `.env` configuration
4. Test OpenAI API connection directly (see Diagnostic Commands)
5. Open an issue with full logs and environment details

## Summary of Changes

| Component | Change | Location | Status |
|-----------|--------|----------|--------|
| LLM API Calls | Added 60s timeout | `llmStrategy.ts:250-261` | ✅ |
| Goal Parsing | Added retry with backoff | `llmStrategy.ts:96-141` | ✅ |
| Configuration | Added timeout env vars | `.env.example:45-49` | ✅ |
| Logging | Enhanced debug messages | `llmStrategy.ts:108,120` | ✅ |
| Error Handling | Graceful fallback | `llmStrategy.ts:137-141` | ✅ |

## Next Steps

1. **Rebuild** the project: `npm run build`
2. **Update** your `.env` file with new variables
3. **Restart** the MCP server: `npx mcp-ui-probe start`
4. **Test** operations that were previously timing out
5. **Monitor** logs for any remaining issues

The timeout issues should now be resolved. Operations will retry on failure and fall back gracefully if the API is unavailable.
