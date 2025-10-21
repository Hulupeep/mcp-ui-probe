# Next Actions - Session Resume (2025-10-21c)

**Status**: Fix implemented, needs MCP server restart to test
**Critical Issue**: MCP server running OLD compiled code before our fix

---

## What We Just Completed

### ✅ Thin Slice Implementation (2.5 hours)

1. **Critical Fix**: Form filler now uses LLM-parsed values
   - **File**: `src/server/MCPServer.ts` (lines 1404-1441)
   - **Fix**: Created overrides map from `parsedGoal.value`
   - **Impact**: Should fill "green t-shirt" instead of "sample860"

2. **Documentation**: Added comprehensive architecture guides
   - **README.md**: Technical Architecture section (300+ lines)
   - **CLAUDE.md**: UI-Probe architecture for LLMs (218+ lines)
   - **Analysis docs**: 3 new files in `/docs`

3. **Committed**: All changes committed to Git
   - Commit: `1ace750` - "fix: Form filler now uses LLM-parsed values + comprehensive architecture docs"
   - **NOT PUSHED TO GITHUB YET**

---

## The Problem Right Now

### MCP Server is Running OLD Code ❌

**Evidence**:
```json
// We called: run_flow({ goal: "Search for green t-shirt" })
// OpenAI correctly parsed: "value": "green t-shirt" ✅
// But form filled with: "field-keywords": "sample860" ❌
```

**Why**: The MCP server process loaded the compiled code from `dist/` BEFORE our fix was built.

**Solution**: Restart the MCP server to load the new compiled code.

---

## Immediate Next Actions (Priority Order)

### Action 1: Restart MCP Server ⚡ CRITICAL
```bash
# Stop the current MCP server process
# (Check Claude Code MCP connection status)

# Rebuild the project
cd /home/xanacan/Dropbox/code/MCP-UI-Probe/mcp-ui-probe
npm run build

# Restart MCP server via Claude Code
# The server should pick up the new dist/ files
```

**How to verify**:
```bash
# Check that the build includes our fix
grep -A5 "Using LLM-parsed value" dist/server/MCPServer.js
# Should see the logging statement from our fix
```

### Action 2: Test the Fix on Amazon
```javascript
// Navigate to Amazon
mcp__ui-probe__navigate({ url: "https://www.amazon.com" })

// Test our fix - should use "green t-shirt" NOT random data
mcp__ui-probe__run_flow({ goal: "Search for green t-shirt" })

// Expected in response:
// "input": { "field-keywords": "green t-shirt" }  ✅
// NOT: "input": { "field-keywords": "sample860" }  ❌
```

### Action 3: Navigate to Search Results
```javascript
// If step 2 works, continue with the search results
// If step 2 fails, navigate directly:
mcp__ui-probe__navigate({ url: "https://www.amazon.com/s?k=green+t-shirt" })
```

### Action 4: Get First Product Price
```javascript
// Try clicking first product with natural language
mcp__ui-probe__run_flow({ goal: "Click the first product" })

// If that fails, use direct selector approach:
mcp__ui-probe__click_button({
  selector: "div[data-component-type='s-search-result'] h2 a",
  waitForNavigation: true
})

// Once on product page, extract price
// Look for selectors like:
// - .a-price .a-offscreen
// - #priceblock_ourprice
// - .a-price-whole
```

### Action 5: Report Results & Push to GitHub
```bash
# If test passes:
git push origin main

# Update completion report:
# docs/THIN_SLICE_COMPLETION.md
# Mark "Amazon Test" as PASSED ✅

# Update todos:
TodoWrite([
  {content: "Test Amazon search", status: "completed"},
  {content: "Push to GitHub", status: "completed"}
])
```

---

## Technical Context for Next Session

### Our Fix (MCPServer.ts:1404-1441)
```typescript
// ✨ FIX: Create overrides from LLM-parsed values
const overrides: Record<string, any> = {};

// If LLM parsed a specific value (like "green t-shirt"), use it
if (parsedGoal.value) {
  // Find the main text/search input field
  const mainField = inference.formSchema.fields.find(f =>
    f.type === 'text' ||
    f.type === 'search' ||
    f.name.toLowerCase().includes('search') ||
    f.name.toLowerCase().includes('query') ||
    f.name.toLowerCase().includes('keyword') ||
    f.name.toLowerCase().includes('q')
  );

  if (mainField) {
    overrides[mainField.name] = parsedGoal.value;
    logger.info('Using LLM-parsed value for field', {
      field: mainField.name,
      value: parsedGoal.value
    });
  }
}

// Pass overrides to flow engine
const testRun = await flowEngine.executeFlow(
  page,
  inference.formSchema,
  overrides  // ✨ Now using LLM values instead of random data
);
```

### How to Verify the Fix is Active
```bash
# Check the compiled output contains our fix
cat dist/server/MCPServer.js | grep -A2 "Using LLM-parsed value"

# Should output:
# logger.info('Using LLM-parsed value for field', {
#   field: mainField.name,
#   value: parsedGoal.value
# });
```

### Expected Log Output (When Working)
```
[DEBUG] Attempting LLM goal parsing (attempt 1/3)
[DEBUG] LLM goal parsing succeeded
[INFO] Using LLM-parsed value for field: field-keywords = "green t-shirt"
```

---

## Test Validation Checklist

### ✅ Success Criteria
- [ ] MCP server restarted with new code
- [ ] `run_flow({ goal: "Search for green t-shirt" })` succeeds
- [ ] Form fills with "green t-shirt" (NOT "sample860")
- [ ] Search executes on Amazon
- [ ] Navigate to product page
- [ ] Extract price from product page
- [ ] Return price to user

### ❌ Failure Scenarios

**Scenario 1: Still using random data**
- **Cause**: MCP server not restarted
- **Fix**: Stop and restart MCP server process
- **Verify**: Check dist/ files have new code

**Scenario 2: Can't find search field**
- **Cause**: Field name pattern not matching
- **Debug**: Check what field name Amazon uses
- **Fix**: Add more patterns to mainField.find()

**Scenario 3: Can't click product**
- **Cause**: Dynamic selectors on Amazon
- **Workaround**: Use direct URL navigation to product
- **Future**: Implement Task 1.2 (Dynamic selectors)

---

## Alternate Approach (If Natural Language Fails)

### Plan B: Direct Selector Approach
```javascript
// 1. Navigate to search results directly
navigate({ url: "https://www.amazon.com/s?k=green+t-shirt" })

// 2. Use Playwright-style selector
click_button({
  selector: "[data-component-type='s-search-result'] h2 a:first-of-type"
})

// 3. On product page, extract price
// Use analyze_ui to find price elements
analyze_ui({ scope: "viewport" })
// Look for price in response

// Or use direct selector:
// .a-price-whole for whole dollars
// .a-price-fraction for cents
```

---

## Files to Reference

### Implementation
- `src/server/MCPServer.ts` - The fix (lines 1404-1441)
- `src/flows/flowEngine.ts` - Uses overrides
- `src/utils/dataSynthesizer.ts` - Checks overrides first

### Documentation
- `README.md` - Technical Architecture section
- `CLAUDE.md` - UI-Probe architecture guide
- `docs/THIN_SLICE_COMPLETION.md` - What we just built
- `docs/execution-plan-gaps.md` - Future improvements

### Git
- **Last commit**: `1ace750`
- **Not pushed yet** - waiting for test validation
- **Branch**: `main`

---

## Expected Output (Success Case)

```bash
User: "Go find a green t-shirt on Amazon and get the price"