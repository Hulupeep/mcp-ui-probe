# MCP UI-Probe Issues and Recommendations
**Date**: 2025-09-29
**Project**: HubDuck Test Harness Validation
**Testing Context**: Attempting to use mcp-ui-probe for automated CSV upload testing

---

## Executive Summary

MCP UI-Probe failed to perform basic operations during test harness validation. All attempted operations returned generic "Element interaction failed" or "Error collection failed" errors without meaningful debugging information. Playwright was used as a successful fallback.

**Status**: ❌ **MCP UI-Probe Not Functional for This Use Case**

---

## Issues Encountered

### 1. Navigation Failures

#### Issue Description
**Tool**: `mcp__ui-probe__navigate`
**URLs Tested**:
- `http://localhost:3001`
- `http://localhost:3001/testing`

**Error Returned**:
```json
{
  "success": false,
  "error": "Element interaction failed"
}
```

#### Expected Behavior
- Navigate to the specified URL
- Wait for page load (domcontentloaded or networkidle)
- Return success status with page information

#### Actual Behavior
- Generic error message
- No stack trace
- No indication of what failed (network, timeout, browser launch, etc.)
- No helpful debugging information

#### Impact
🔴 **Critical** - Cannot perform any testing without navigation

---

### 2. Error Collection Failures

#### Issue Description
**Tool**: `mcp__ui-probe__collect_errors`
**Types Requested**: `["console", "network", "validation"]`

**Error Returned**:
```json
{
  "success": false,
  "error": "Error collection failed"
}
```

#### Expected Behavior
- Capture console.error messages
- Capture console.warn messages
- Capture network errors (4xx, 5xx responses)
- Capture validation errors
- Return structured error data

#### Actual Behavior
- Generic error message
- Cannot collect any error information
- No indication if browser is running
- No error details or context

#### Impact
🔴 **Critical** - Primary purpose is error detection, but tool cannot collect errors

---

### 3. UI Analysis Failures

#### Issue Description
**Tool**: `mcp__ui-probe__analyze_ui`
**Scope**: `viewport`

**Error Returned**:
```json
{
  "success": false,
  "error": "Element interaction failed"
}
```

#### Expected Behavior
- Analyze UI elements visible in viewport
- Return element hierarchy
- Identify interactive elements
- Provide accessibility information

#### Actual Behavior
- Generic error message
- No UI analysis data
- Cannot proceed with automated testing

#### Impact
🟡 **Major** - Cannot understand page structure for automated interactions

---

### 4. Complete Test Sequence Failure

#### Test Flow Attempted
```javascript
1. mcp__ui-probe__navigate → ❌ Failed
2. mcp__ui-probe__collect_errors → ❌ Failed
3. mcp__ui-probe__analyze_ui → ❌ Failed
```

**Result**: Unable to perform any ui-probe operations

---

## Root Cause Analysis

### Possible Causes

#### 1. Browser/Playwright Initialization Issues
**Hypothesis**: UI-Probe may not be properly initializing its browser instance

**Evidence**:
- All operations fail immediately
- No timeout errors (would indicate browser launched but page didn't load)
- Generic error messages suggest early failure in the tool chain

**Recommendation**: Check browser installation and Playwright dependencies

---

#### 2. Server Connection Issues
**Hypothesis**: UI-Probe may be unable to reach localhost servers

**Evidence**:
- Servers were confirmed running (curl tests passed)
- Frontend accessible via direct browser
- Playwright tests succeeded on same URLs

**Recommendation**: Check if ui-probe has localhost/networking restrictions

---

#### 3. MCP Server Communication Issues
**Hypothesis**: Communication between Claude Code and ui-probe MCP server may be broken

**Evidence**:
- Tool calls return immediately with generic errors
- No detailed error messages
- No stack traces or debugging output

**Recommendation**: Verify MCP server is running and responding correctly

---

#### 4. Missing Dependencies or Configuration
**Hypothesis**: UI-Probe may be missing required system dependencies

**Evidence**:
- Running on Linux 6.14.0-29-generic
- Playwright works fine on same system
- May need specific browser binaries

**Recommendation**: Verify all dependencies installed

---

#### 5. Authentication/Permission Issues
**Hypothesis**: Test page requires authentication that ui-probe cannot handle

**Evidence**:
- Page shows "Loading... Checking your authentication status..."
- UI-Probe may not have session/token management
- Playwright test navigates to `?org=test0925c` parameter

**Counter-Evidence**:
- Even root URL fails to navigate
- Error occurs before page load could complete

**Recommendation**: Add session/authentication handling to ui-probe

---

## Comparison with Playwright

### What Worked with Playwright ✅

```typescript
// Playwright Success
await page.goto('http://localhost:3001/testing?org=test0925c', {
  waitUntil: 'networkidle'
});
// ✅ Success - page loads

// Console error capture
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  }
});
// ✅ Success - captured 0 errors

// File upload
await fileInput.setInputFiles(csvPath);
// ✅ Success - file uploaded

// Screenshot
await page.screenshot({ path: '/tmp/csv-upload-result.png' });
// ✅ Success - 70KB PNG captured
```

### What Failed with UI-Probe ❌

```javascript
// UI-Probe Failures
mcp__ui-probe__navigate(url: "http://localhost:3001/testing")
// ❌ "Element interaction failed"

mcp__ui-probe__collect_errors(types: ["console", "network", "validation"])
// ❌ "Error collection failed"

mcp__ui-probe__analyze_ui(scope: "viewport")
// ❌ "Element interaction failed"
```

### Key Differences

| Feature | Playwright | UI-Probe | Winner |
|---------|-----------|----------|--------|
| Navigation | ✅ Works | ❌ Fails | Playwright |
| Error Collection | ✅ Complete | ❌ Fails | Playwright |
| Screenshot | ✅ Works | ❓ Untested | Playwright |
| File Upload | ✅ Works | ❓ Untested | Playwright |
| Error Messages | ✅ Detailed | ❌ Generic | Playwright |
| Debugging Info | ✅ Rich | ❌ None | Playwright |
| Reliability | ✅ 100% | ❌ 0% | Playwright |

---

## Error Message Quality Issues

### Current Error Messages (Insufficient)

```json
// Navigation failure
{
  "success": false,
  "error": "Element interaction failed"
}

// Error collection failure
{
  "success": false,
  "error": "Error collection failed"
}
```

### Recommended Error Message Format

```json
{
  "success": false,
  "error": {
    "code": "NAVIGATION_FAILED",
    "message": "Failed to navigate to http://localhost:3001",
    "details": {
      "reason": "Browser failed to launch",
      "browserType": "chromium",
      "timeout": 30000,
      "systemError": "spawn /usr/bin/chromium ENOENT"
    },
    "timestamp": "2025-09-29T22:39:00.000Z",
    "suggestions": [
      "Install Chromium: apt-get install chromium-browser",
      "Check DISPLAY environment variable",
      "Try headless mode: --headless=true"
    ]
  },
  "stack": "Error: Browser launch failed\n  at BrowserLauncher.launch..."
}
```

---

## Recommendations for Fixing UI-Probe

### 🔴 Critical Priorities

#### 1. Improve Error Messages
**Current**: Generic "Element interaction failed"
**Needed**: Specific error codes, detailed messages, stack traces, suggestions

**Implementation**:
```typescript
try {
  await page.goto(url);
} catch (error) {
  return {
    success: false,
    error: {
      code: 'NAVIGATION_FAILED',
      message: error.message,
      details: {
        url: url,
        browserState: browser?.isConnected(),
        timeout: options.timeout,
        waitUntil: options.waitUntil
      },
      stack: error.stack,
      suggestions: getSuggestions(error)
    }
  };
}
```

#### 2. Add Verbose Debug Mode
**Feature**: `--debug` or `--verbose` flag to output detailed logs

**Output Example**:
```
[ui-probe] Starting browser launch...
[ui-probe] Browser: chromium
[ui-probe] Headless: true
[ui-probe] Browser launched successfully
[ui-probe] Navigating to: http://localhost:3001/testing
[ui-probe] Waiting for: networkidle
[ui-probe] Page loaded in 2.3s
[ui-probe] Current URL: http://localhost:3001/testing?org=test0925c
[ui-probe] Ready state: complete
```

#### 3. Add Health Check Tool
**New Tool**: `mcp__ui-probe__health_check`

**Purpose**: Diagnose ui-probe setup issues

**Returns**:
```json
{
  "browserInstalled": true,
  "browserVersion": "120.0.6099.71",
  "playwrightVersion": "1.40.0",
  "canLaunchBrowser": true,
  "canAccessLocalhost": true,
  "displayAvailable": true,
  "systemInfo": {
    "platform": "linux",
    "arch": "x64",
    "nodeVersion": "v22.19.0"
  }
}
```

---

### 🟡 High Priority Improvements

#### 4. Browser Launch Diagnostics
**Add**: Automatic detection and resolution of common browser launch issues

**Common Issues**:
- Missing Chromium binary
- No DISPLAY variable (headless mode needed)
- Missing dependencies (libgbm, libnss3, etc.)
- Permission issues

**Auto-Resolution**:
```typescript
async function launchBrowserWithFallback() {
  try {
    return await browser.launch({ headless: false });
  } catch (error) {
    if (error.message.includes('DISPLAY')) {
      console.log('No display detected, falling back to headless mode');
      return await browser.launch({ headless: true });
    }
    throw error;
  }
}
```

#### 5. Session Management
**Feature**: Handle authentication and session state

**Capabilities**:
- Set cookies before navigation
- Store localStorage/sessionStorage
- Handle auth redirects
- Support OAuth flows

**API Example**:
```typescript
mcp__ui-probe__navigate({
  url: "http://localhost:3001/testing",
  auth: {
    type: "query_param",
    params: { org: "test0925c" }
  }
})

// Or
mcp__ui-probe__set_session({
  cookies: [{ name: "token", value: "..." }],
  localStorage: { "userRole": "teacher" }
})
```

#### 6. Better Wait Strategies
**Feature**: More intelligent page load detection

**Current**: Simple waitUntil parameter
**Needed**: Multiple wait strategies

**Examples**:
```typescript
// Wait for specific element
waitFor: { selector: '[data-testid="batches-tab"]' }

// Wait for network idle + specific element
waitFor: {
  networkIdle: true,
  selector: '.batch-list',
  timeout: 10000
}

// Wait for JavaScript evaluation
waitFor: {
  evaluate: 'window.dataLoaded === true'
}
```

---

### 🟢 Nice-to-Have Enhancements

#### 7. Screenshot on Failure
**Feature**: Automatically capture screenshot when operations fail

**Benefits**:
- Visual debugging
- Understand what UI state caused failure
- Easier bug reports

**Implementation**:
```typescript
try {
  await page.click(selector);
} catch (error) {
  const screenshot = await page.screenshot();
  return {
    success: false,
    error: error.message,
    screenshot: screenshot.toString('base64'),
    screenshotPath: '/tmp/ui-probe-failure.png'
  };
}
```

#### 8. Interactive Mode
**Feature**: Launch browser visibly and keep it open for debugging

**Usage**:
```bash
npx mcp-ui-probe interactive http://localhost:3001/testing
```

**Features**:
- Browser stays open
- Console shows all page events
- Can manually test interactions
- Generate code snippets from manual actions

#### 9. Recording and Playback
**Feature**: Record interactions for regression testing

**Example**:
```typescript
// Record
mcp__ui-probe__record_journey({
  name: "CSV Upload Test",
  description: "Upload sample emails CSV"
})

// Later replay
mcp__ui-probe__replay_journey({
  journeyId: "csv-upload-test"
})
```

---

## Testing Recommendations

### Short Term: Use Playwright

For the HubDuck project, continue using Playwright for:
- ✅ Reliable E2E testing
- ✅ CSV upload validation
- ✅ Console error detection
- ✅ Screenshot capture
- ✅ CI/CD integration

**Reason**: Playwright works reliably now, ui-probe needs fixes

### Medium Term: Fix UI-Probe Core Issues

Priority order:
1. Fix browser launch (critical)
2. Improve error messages (critical)
3. Add health check tool (critical)
4. Add session management (high)
5. Add verbose logging (high)

### Long Term: Evaluate Use Cases

**UI-Probe Best For**:
- Quick manual testing
- One-off verifications
- Simple page checks
- MCP integration workflows

**Playwright Best For**:
- Comprehensive E2E testing
- CI/CD pipelines
- Complex user flows
- Regression testing

---

## Environment Diagnostics

### System Information
```
OS: Linux 6.14.0-29-generic
Node.js: v22.19.0
Browser: Chromium (via Playwright)
Display: X11 available
```

### Working Tools
- ✅ Playwright
- ✅ Chromium browser
- ✅ curl (network connectivity)
- ✅ Backend server (port 8000)
- ✅ Frontend server (port 3001)

### Not Working
- ❌ MCP UI-Probe navigation
- ❌ MCP UI-Probe error collection
- ❌ MCP UI-Probe UI analysis

---

## Example: What Good Error Messages Look Like

### Playwright Error (Helpful)
```
TimeoutError: page.goto: Timeout 30000ms exceeded.
=========================== logs ===========================
navigating to "http://localhost:3001/testing", waiting until "networkidle"
============================================================
  at Object.goto (/path/to/test.spec.ts:40:20)

Suggestions:
- Check if the server is running
- Increase timeout with { timeout: 60000 }
- Use waitUntil: 'domcontentloaded' for faster loading
```

### UI-Probe Error (Unhelpful)
```json
{
  "success": false,
  "error": "Element interaction failed"
}
```

**Recommendation**: Make UI-Probe errors as helpful as Playwright's

---

## Debugging Checklist for UI-Probe Developers

- [ ] Can MCP server start successfully?
- [ ] Can MCP server receive commands?
- [ ] Can Playwright be imported?
- [ ] Can browser be launched?
- [ ] Can browser launch in headless mode?
- [ ] Can browser access localhost?
- [ ] Can browser access external URLs?
- [ ] Does error handling wrap every async operation?
- [ ] Are error messages descriptive?
- [ ] Are errors logged to console/file?
- [ ] Is there a verbose/debug mode?
- [ ] Is there a health check tool?

---

## Minimal Reproduction Case

### Code to Test UI-Probe

```typescript
// test-ui-probe.ts
import { MCPClient } from 'mcp-client';

async function testUIProbe() {
  const client = new MCPClient();

  console.log('Test 1: Health Check');
  const health = await client.call('mcp__ui-probe__health_check');
  console.log(JSON.stringify(health, null, 2));

  console.log('\nTest 2: Navigate to Simple Page');
  const nav = await client.call('mcp__ui-probe__navigate', {
    url: 'https://example.com',
    waitUntil: 'domcontentloaded'
  });
  console.log(JSON.stringify(nav, null, 2));

  console.log('\nTest 3: Navigate to Localhost');
  const local = await client.call('mcp__ui-probe__navigate', {
    url: 'http://localhost:3001',
    waitUntil: 'networkidle'
  });
  console.log(JSON.stringify(local, null, 2));
}

testUIProbe();
```

**Expected**: Detailed output for each test
**Actual**: Generic errors

---

## Impact Assessment

### Current Impact on HubDuck Project
- 🟢 **Low Impact** - Playwright provides all needed functionality
- 🟡 **Medium Inefficiency** - Would be nice to have MCP-integrated testing
- 🔴 **No Blocker** - Can proceed with Playwright

### Broader Impact on MCP Ecosystem
- 🔴 **High** - UI-Probe is advertised as a key MCP capability
- 🔴 **High** - Generic error messages make debugging impossible
- 🟡 **Medium** - Reduces trust in other MCP tools
- 🟡 **Medium** - Forces users to maintain separate testing infrastructure

---

## Action Items

### For UI-Probe Maintainers
1. [ ] Fix browser launch on Linux
2. [ ] Add comprehensive error messages with error codes
3. [ ] Add `health_check` tool
4. [ ] Add `--verbose` debug mode
5. [ ] Add session/auth management
6. [ ] Write troubleshooting documentation
7. [ ] Add integration tests for all tools
8. [ ] Test on Linux, macOS, Windows
9. [ ] Add screenshot-on-failure capability
10. [ ] Improve MCP error propagation

### For HubDuck Project
1. [x] Use Playwright for E2E testing (working)
2. [x] Document ui-probe issues (this document)
3. [ ] Re-evaluate ui-probe after fixes released
4. [ ] Consider contributing fixes to ui-probe project
5. [ ] Keep Playwright tests as primary testing method

---

## Related Resources

- Playwright Documentation: https://playwright.dev
- MCP UI-Probe Repository: (add link when known)
- Test Results Report: `docs/test-results-2025-09-29.md`
- Working Test File: `hubduck-frontend/tests/test-harness.spec.ts`

---

## Conclusion

MCP UI-Probe is **currently not usable** for the HubDuck test harness validation due to:
1. Complete failure to perform basic operations
2. Unhelpful error messages
3. No debugging capabilities
4. No clear path to resolution

**Recommendation**: Continue using Playwright for reliable, production-grade testing. Revisit ui-probe after critical fixes are implemented.

**Status**: ❌ **Not Ready for Production Use**

---

*This document will be updated as ui-probe issues are addressed and new versions are tested.*