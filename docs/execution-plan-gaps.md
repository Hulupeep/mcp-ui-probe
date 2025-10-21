# Execution Plan: Making UI-Probe Work on Real-World Sites

**Date**: 2025-10-21
**Status**: Planning Phase
**Priority**: HIGH - Core functionality gaps identified in Amazon test

---

## Executive Summary

Based on real-world testing with Amazon, UI-Probe has **working OpenAI integration** but critical **execution gaps**. This plan addresses 8 priority issues to make UI-Probe production-ready.

**Test Results**:
- ✅ OpenAI API calls working
- ✅ Natural language parsing working
- ❌ Form filling using random data instead of parsed values
- ❌ Element clicking failing on dynamic sites
- ❌ No bulk operation support

---

## Priority 1: CRITICAL BUGS (Days 1-2)

### Task 1.1: Fix Form Filler to Use LLM-Parsed Values

**Problem**: Form filler ignores LLM-parsed goal and uses random data
```json
// LLM correctly parsed:
{"action": "fill", "value": "blue t-shirt"}

// But form filler used:
{"field-keywords": "sample384"}  // ❌ WRONG
```

**Root Cause**: `src/flows/flowEngine.ts` - form filler doesn't receive parsed goal values

**Files to Modify**:
- `src/server/MCPServer.ts:1270-1524` (handleRunFlow)
- `src/flows/flowEngine.ts` (executeFlow)
- `src/infer/form.ts` (inferForm)

**Implementation**:

```typescript
// src/server/MCPServer.ts:1370-1407
private async handleRunFlow(params: RunFlowParams): Promise<MCPToolResult> {
  const parsedGoal = await this.llmStrategy.parseGoal(params.goal);

  // ✨ NEW: Pass parsed goal values to form inference
  const inference = await formInferenceEngine.inferForm(analysis, {
    goal: params.goal,
    parsedGoal: parsedGoal  // ✨ ADD THIS
  });

  // ✨ NEW: Use parsedGoal.value for form data
  const overrides: any = {};
  if (parsedGoal.value) {
    // Find the search/main input field and set its value
    const mainField = inference.formSchema.fields.find(f =>
      f.type === 'text' || f.name.includes('search') || f.name.includes('keyword')
    );
    if (mainField) {
      overrides[mainField.name] = parsedGoal.value;  // ✨ Use LLM value
    }
  }

  // Execute flow with LLM-parsed values
  const testRun = await flowEngine.executeFlow(
    page,
    inference.formSchema,
    overrides  // ✨ Pass LLM values
  );
}
```

**Expected Result**:
```bash
# Before:
fill("#twotabsearchtextbox", "sample384")

# After:
fill("#twotabsearchtextbox", "blue t-shirt")  # ✅ Uses LLM value
```

**Testing**:
```bash
# Test command
run_flow({ goal: "Search for blue t-shirt" })

# Should fill search box with "blue t-shirt", not random data
```

**Estimated Time**: 4 hours
**Impact**: HIGH - Fixes core functionality

---

### Task 1.2: Improve Selector Generation for Dynamic Sites

**Problem**: Static selectors fail on Amazon's dynamic class names
```typescript
// Current approach:
selector: "div[data-component-type='s-search-result'] h2 a"  // ❌ Too specific

// Amazon reality:
<div class="s-result-item s-asin sg-col-0-of-12 sg-col-16-of-20...">  // Dynamic classes
```

**Root Cause**: Selectors are too brittle for dynamic content

**Files to Modify**:
- `src/server/MCPServer.ts:1181-1268` (findClickableElementWithAI)
- Create new: `src/selectors/dynamicSelectorGenerator.ts`

**Implementation**:

```typescript
// NEW FILE: src/selectors/dynamicSelectorGenerator.ts
export class DynamicSelectorGenerator {
  /**
   * Generate resilient selectors that work on dynamic sites
   */
  async generateResilientSelector(
    page: Page,
    searchCriteria: {
      text?: string;
      role?: string;
      type?: 'link' | 'button' | 'input';
      position?: 'first' | 'last' | number;
    }
  ): Promise<string[]> {
    const selectors: string[] = [];

    // Strategy 1: Semantic HTML
    if (searchCriteria.type === 'link') {
      selectors.push('a[href]');
    }

    // Strategy 2: ARIA attributes (stable across redesigns)
    if (searchCriteria.role) {
      selectors.push(`[role="${searchCriteria.role}"]`);
    }

    // Strategy 3: Text content (most resilient)
    if (searchCriteria.text) {
      selectors.push(`text=${searchCriteria.text}`);  // Playwright text selector
    }

    // Strategy 4: Data attributes (more stable than classes)
    selectors.push('[data-component-type]');
    selectors.push('[data-asin]');
    selectors.push('[data-testid]');

    // Strategy 5: Position-based (when structure is stable)
    if (searchCriteria.position === 'first') {
      selectors.push('>> nth=0');
    }

    return selectors;
  }

  /**
   * Try selectors in order until one works
   */
  async findWithFallback(
    page: Page,
    selectors: string[]
  ): Promise<ElementHandle | null> {
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          return element;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }
}
```

**Update handleClickButton**:
```typescript
// src/server/MCPServer.ts:909-1103
private async handleClickButton(params: any): Promise<MCPToolResult> {
  const page = await this.driver.getPage();
  const generator = new DynamicSelectorGenerator();

  // ✨ Generate resilient selectors
  const selectors = await generator.generateResilientSelector(page, {
    text: params.text,
    type: 'button'
  });

  // ✨ Try each selector with fallback
  const element = await generator.findWithFallback(page, selectors);

  if (element) {
    await element.click();
    return { success: true, data: { clicked: true } };
  }

  // Fallback to AI-powered finding...
}
```

**Expected Result**:
```bash
# Amazon product link search:
1. Try: a[data-component-type="s-search-result"]
2. Try: a[href*="/dp/"]
3. Try: h2 a (simpler)
4. Try: text=Blue (text-based)
✅ One succeeds
```

**Testing**:
```bash
# Test on Amazon, eBay, dynamic React sites
click_button({ text: "First product" })
# Should find and click product despite dynamic classes
```

**Estimated Time**: 6 hours
**Impact**: HIGH - Enables real-world site compatibility

---

## Priority 2: CORE FEATURES (Days 3-4)

### Task 2.1: Implement Bulk Operations Support

**Problem**: Can't handle "click all", "select every", etc.

**Reference**: See `docs/analysis-bulk-operations.md` for detailed design

**Files to Create/Modify**:
- `src/types/index.ts` - Add quantifier fields to ParsedGoal
- `src/llm/llmStrategy.ts:322-358` - Update prompt for quantifiers
- `src/server/MCPServer.ts` - Add handleBulkClick method

**Implementation Steps**:

**Step 1: Update ParsedGoal Interface**
```typescript
// src/types/index.ts
export interface ParsedGoal {
  action: string;
  target?: string;
  targetType?: string;

  // ✨ NEW: Bulk operation support
  quantifier?: 'all' | 'every' | 'each' | 'first' | 'last' | 'nth';
  quantity?: number;  // For "click 3 buttons"
  filter?: string;    // For "all red buttons"
}
```

**Step 2: Update LLM Prompt**
```typescript
// src/llm/llmStrategy.ts:322-358
private buildGoalParsingPrompt(goal: string): string {
  return `Parse this UI testing goal into structured actions:
"${goal}"

CRITICAL: Detect quantifiers:
- "all buttons" -> {"action": "click", "targetType": "button", "quantifier": "all"}
- "every checkbox" -> {"action": "click", "targetType": "checkbox", "quantifier": "all"}
- "first link" -> {"action": "click", "targetType": "link", "quantifier": "first"}
- "click 3 buttons" -> {"action": "click", "targetType": "button", "quantifier": "nth", "quantity": 3}
- "last item" -> {"action": "click", "targetType": "element", "quantifier": "last"}

Examples:
"Click all the buttons" -> {
  "action": "click",
  "targetType": "button",
  "quantifier": "all"
}

"Select the first 3 checkboxes" -> {
  "action": "click",
  "targetType": "checkbox",
  "quantifier": "nth",
  "quantity": 3
}
`;
}
```

**Step 3: Implement handleBulkClick**
```typescript
// src/server/MCPServer.ts - NEW METHOD
private async handleBulkClick(params: {
  targetType: string;
  quantifier: 'all' | 'first' | 'last' | 'nth';
  quantity?: number;
  filter?: string;
}): Promise<MCPToolResult> {
  const page = await this.driver.getPage();

  // Build selector based on targetType
  let selector = 'button';
  if (params.targetType === 'link') selector = 'a';
  if (params.targetType === 'checkbox') selector = 'input[type="checkbox"]';

  // Get all matching elements
  const allElements = await page.locator(selector).all();

  // Apply quantifier
  let elementsToClick: any[] = [];
  switch (params.quantifier) {
    case 'all':
      elementsToClick = allElements;
      break;
    case 'first':
      elementsToClick = [allElements[0]];
      break;
    case 'last':
      elementsToClick = [allElements[allElements.length - 1]];
      break;
    case 'nth':
      elementsToClick = allElements.slice(0, params.quantity || 1);
      break;
  }

  // Safety limit
  if (elementsToClick.length > 100) {
    throw new Error(`Safety limit: refusing to click ${elementsToClick.length} elements. Max: 100`);
  }

  // Click each element
  const results = [];
  for (const element of elementsToClick) {
    try {
      await element.click();
      const text = await element.textContent();
      results.push({ success: true, text });
      await page.waitForTimeout(100);  // Small delay between clicks
    } catch (error) {
      results.push({ success: false, error: error.message });
    }
  }

  return {
    success: results.every(r => r.success),
    data: {
      totalClicked: results.filter(r => r.success).length,
      totalAttempted: results.length,
      results
    }
  };
}
```

**Step 4: Route to Bulk Handler**
```typescript
// src/server/MCPServer.ts:1270 (handleRunFlow)
private async handleRunFlow(params: RunFlowParams): Promise<MCPToolResult> {
  const parsedGoal = await this.llmStrategy.parseGoal(params.goal);

  // ✨ NEW: Check for bulk operations
  if (parsedGoal.quantifier === 'all' || parsedGoal.quantifier === 'every') {
    return this.handleBulkClick({
      targetType: parsedGoal.targetType!,
      quantifier: parsedGoal.quantifier,
      quantity: parsedGoal.quantity,
      filter: parsedGoal.filter
    });
  }

  // Continue with existing single-action handling...
}
```

**Expected Result**:
```bash
# Before:
run_flow({ goal: "Click all the buttons" })
# ❌ FAILS: "Button not found: buttons"

# After:
run_flow({ goal: "Click all the buttons" })
# ✅ SUCCESS: {totalClicked: 15, totalAttempted: 15}
```

**Testing**:
```bash
# Test cases
run_flow({ goal: "Click all buttons" })
run_flow({ goal: "Select every checkbox" })
run_flow({ goal: "Click the first 3 links" })
run_flow({ goal: "Click the last button" })
```

**Estimated Time**: 8 hours
**Impact**: HIGH - Unlocks major use case

---

### Task 2.2: Add OpenAI-Powered Element Finding

**Problem**: `findClickableElementWithAI()` uses heuristics, not actual AI

**Files to Modify**:
- `src/server/MCPServer.ts:1181-1268` (rename and refactor)
- Create new: `src/llm/elementFinder.ts`

**Implementation**:

```typescript
// NEW FILE: src/llm/elementFinder.ts
import { LLMStrategy } from './llmStrategy.js';
import { Page } from 'playwright';

export class AIElementFinder {
  constructor(private llmStrategy: LLMStrategy) {}

  /**
   * Use OpenAI to find element on page
   */
  async findElement(
    page: Page,
    description: string
  ): Promise<{ selector: string; confidence: number } | null> {
    // Get page snapshot with simplified structure
    const snapshot = await this.getSimplifiedSnapshot(page);

    // Ask OpenAI to find the element
    const prompt = `
You are an expert at finding HTML elements. Find the best CSS selector for: "${description}"

Page structure:
${JSON.stringify(snapshot, null, 2)}

Analyze the page and return the MOST RELIABLE selector.

Return JSON:
{
  "selector": "css selector here",
  "reasoning": "why this selector",
  "confidence": 0.0-1.0,
  "alternatives": ["backup1", "backup2"]
}
`;

    try {
      const response = await this.llmStrategy.complete(prompt);
      const parsed = JSON.parse(response);

      // Validate selector works
      const element = await page.$(parsed.selector);
      if (element && await element.isVisible()) {
        return {
          selector: parsed.selector,
          confidence: parsed.confidence
        };
      }

      // Try alternatives
      for (const alt of parsed.alternatives || []) {
        const elem = await page.$(alt);
        if (elem && await elem.isVisible()) {
          return { selector: alt, confidence: parsed.confidence * 0.8 };
        }
      }
    } catch (error) {
      console.error('AI element finding failed:', error);
      return null;
    }

    return null;
  }

  private async getSimplifiedSnapshot(page: Page): Promise<any> {
    // Get page structure in simplified format for LLM
    return await page.evaluate(() => {
      const getElementInfo = (el: Element) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        classes: Array.from(el.classList).slice(0, 3),
        text: el.textContent?.trim().substring(0, 50),
        role: el.getAttribute('role') || undefined,
        type: el.getAttribute('type') || undefined
      });

      const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'))
        .slice(0, 20)
        .map(getElementInfo);

      const links = Array.from(document.querySelectorAll('a[href]'))
        .slice(0, 20)
        .map(getElementInfo);

      const inputs = Array.from(document.querySelectorAll('input, select, textarea'))
        .slice(0, 20)
        .map(getElementInfo);

      return { buttons, links, inputs };
    });
  }
}
```

**Update MCPServer**:
```typescript
// src/server/MCPServer.ts:973-989
private async handleClickButton(params: any): Promise<MCPToolResult> {
  // ... existing selector attempts ...

  // ✨ NEW: Try REAL AI-powered finding
  if (!buttonClicked && params.text) {
    try {
      const aiFinder = new AIElementFinder(this.llmStrategy);
      const result = await aiFinder.findElement(page, params.text);

      if (result && result.confidence > 0.7) {
        const element = page.locator(result.selector);
        await element.click();
        buttonClicked = true;
        clickMethod = 'openai-ai';  // ✅ Actually used OpenAI
      }
    } catch (error) {
      logger.warn('OpenAI element finding failed', { error });
    }
  }

  // Rename old method
  if (!buttonClicked) {
    const selector = await this.findClickableElementWithHeuristics(page, params.text);
    // ✨ RENAMED from findClickableElementWithAI
  }
}
```

**Expected Result**:
```bash
# Amazon product search:
OpenAI analyzes page structure
→ Returns: {"selector": "a[href*='/dp/']:visible", "confidence": 0.9}
→ ✅ Clicks first product
```

**Estimated Time**: 6 hours
**Impact**: MEDIUM - Improves reliability on complex sites

---

## Priority 3: RELIABILITY & DEBUGGING (Days 5-6)

### Task 3.1: Add Retry Logic with Exponential Backoff

**Problem**: Single failures cause total workflow failure

**Files to Modify**:
- Create new: `src/utils/retry.ts`
- `src/server/MCPServer.ts` - Add to click, fill, navigate

**Implementation**:

```typescript
// NEW FILE: src/utils/retry.ts
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export class RetryStrategy {
  private static DEFAULT_CONFIG: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: [
      'timeout',
      'not clickable',
      'detached from frame',
      'element is not visible'
    ]
  };

  static async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const cfg = { ...this.DEFAULT_CONFIG, ...config };
    let lastError: Error;
    let delay = cfg.initialDelayMs;

    for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        const isRetryable = cfg.retryableErrors.some(errMsg =>
          error.message?.toLowerCase().includes(errMsg.toLowerCase())
        );

        if (!isRetryable || attempt === cfg.maxAttempts) {
          throw error;
        }

        // Wait before retry
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Exponential backoff
        delay = Math.min(delay * cfg.backoffMultiplier, cfg.maxDelayMs);
      }
    }

    throw lastError!;
  }
}
```

**Apply to handleClickButton**:
```typescript
// src/server/MCPServer.ts:909
private async handleClickButton(params: any): Promise<MCPToolResult> {
  return RetryStrategy.withRetry(async () => {
    const page = await this.driver.getPage();

    // ... existing click logic ...

    if (!buttonClicked) {
      throw new MCPUIError(`Button not found: ${params.text}`);
    }

    return { success: true, data: { clicked: true } };
  }, {
    maxAttempts: 3,
    initialDelayMs: 500
  });
}
```

**Expected Result**:
```bash
# Flaky element:
Attempt 1: Element not clickable (covered by overlay)
Wait 500ms...
Attempt 2: Element not clickable
Wait 1000ms...
Attempt 3: ✅ Success (overlay dismissed)
```

**Estimated Time**: 4 hours
**Impact**: MEDIUM - Improves reliability

---

### Task 3.2: Implement Page Context Awareness

**Problem**: Same action means different things on different pages

**Files to Create**:
- `src/context/pageContextDetector.ts`

**Implementation**:

```typescript
// NEW FILE: src/context/pageContextDetector.ts
export interface PageContext {
  pageType: 'search_results' | 'product_detail' | 'checkout' | 'login' | 'home' | 'unknown';
  domain: string;
  indicators: string[];
  confidence: number;
}

export class PageContextDetector {
  async detectContext(page: Page): Promise<PageContext> {
    const url = page.url();
    const title = await page.title();
    const content = await page.content();

    // Amazon-specific patterns
    if (url.includes('amazon.com')) {
      if (url.includes('/s?') || url.includes('/s/')) {
        return {
          pageType: 'search_results',
          domain: 'amazon',
          indicators: ['search results', 'multiple products', 'filters'],
          confidence: 0.95
        };
      }
      if (url.includes('/dp/') || url.includes('/gp/product/')) {
        return {
          pageType: 'product_detail',
          domain: 'amazon',
          indicators: ['single product', 'add to cart button', 'product description'],
          confidence: 0.95
        };
      }
    }

    // Generic patterns
    if (content.includes('search results') || content.includes('items found')) {
      return {
        pageType: 'search_results',
        domain: 'generic',
        indicators: ['search results text'],
        confidence: 0.7
      };
    }

    return {
      pageType: 'unknown',
      domain: 'generic',
      indicators: [],
      confidence: 0
    };
  }

  /**
   * Get context-specific selectors
   */
  getContextSelectors(context: PageContext, elementType: 'product_link' | 'price' | 'add_to_cart'): string[] {
    if (context.domain === 'amazon') {
      if (context.pageType === 'search_results') {
        if (elementType === 'product_link') {
          return [
            'h2 a.a-link-normal',
            'a.a-link-normal.s-no-outline',
            '[data-component-type="s-search-result"] h2 a'
          ];
        }
        if (elementType === 'price') {
          return [
            '.a-price .a-offscreen',
            '.a-price-whole',
            'span.a-price'
          ];
        }
      }
      if (context.pageType === 'product_detail') {
        if (elementType === 'price') {
          return [
            '#priceblock_ourprice',
            '#priceblock_dealprice',
            '.a-price .a-offscreen'
          ];
        }
      }
    }

    return [];
  }
}
```

**Use in handleRunFlow**:
```typescript
// src/server/MCPServer.ts:1270
private async handleRunFlow(params: RunFlowParams): Promise<MCPToolResult> {
  const page = await this.driver.getPage();

  // ✨ Detect page context
  const contextDetector = new PageContextDetector();
  const context = await contextDetector.detectContext(page);

  console.log('Page context:', context.pageType, context.confidence);

  // ✨ Use context-aware selectors
  if (parsedGoal.action === 'click' && context.pageType === 'search_results') {
    const selectors = contextDetector.getContextSelectors(context, 'product_link');
    // Try context-specific selectors first...
  }
}
```

**Expected Result**:
```bash
# On Amazon search results:
Context detected: search_results (confidence: 0.95)
Using selectors: ["h2 a.a-link-normal", ...]
✅ Successfully clicks product

# On Amazon product page:
Context detected: product_detail (confidence: 0.95)
Using selectors: ["#priceblock_ourprice", ...]
✅ Successfully finds price
```

**Estimated Time**: 6 hours
**Impact**: HIGH - Enables context-aware actions

---

### Task 3.3: Add Screenshot Debugging on Failures

**Problem**: Hard to debug why actions fail

**Files to Modify**:
- `src/server/MCPServer.ts` - Add to error handlers
- Create new: `src/debugging/screenshotCapture.ts`

**Implementation**:

```typescript
// NEW FILE: src/debugging/screenshotCapture.ts
import fs from 'fs';
import path from 'path';

export class ScreenshotCapture {
  private screenshotDir = './debug-screenshots';

  constructor() {
    // Ensure directory exists
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  async captureFailure(
    page: Page,
    operation: string,
    error: Error
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${operation}-${timestamp}.png`;
    const filepath = path.join(this.screenshotDir, filename);

    try {
      // Capture full page screenshot
      await page.screenshot({
        path: filepath,
        fullPage: true
      });

      // Also capture element highlights if selector provided
      const selector = this.extractSelectorFromError(error);
      if (selector) {
        const element = await page.$(selector);
        if (element) {
          await element.screenshot({
            path: filepath.replace('.png', '-element.png')
          });
        }
      }

      console.log(`📸 Debug screenshot saved: ${filepath}`);
      return filepath;
    } catch (screenshotError) {
      console.error('Failed to capture screenshot:', screenshotError);
      return '';
    }
  }

  private extractSelectorFromError(error: Error): string | null {
    const match = error.message.match(/selector[:\s]+["']([^"']+)["']/i);
    return match ? match[1] : null;
  }
}
```

**Apply to error handlers**:
```typescript
// src/server/MCPServer.ts:1096-1103
private async handleClickButton(params: any): Promise<MCPToolResult> {
  try {
    // ... existing click logic ...

    if (!buttonClicked) {
      throw new MCPUIError(`Button not found: ${params.text || params.selector}`);
    }
  } catch (error) {
    // ✨ Capture screenshot on failure
    const screenshotCapture = new ScreenshotCapture();
    const screenshotPath = await screenshotCapture.captureFailure(
      page,
      'click_button',
      error as Error
    );

    throw new MCPUIError(
      'Click button failed',
      'E_CLICK_FAILED',
      {
        ...error,
        screenshotPath  // ✨ Include in error details
      }
    );
  }
}
```

**Expected Result**:
```bash
# On failure:
❌ Button not found: "First product"
📸 Debug screenshot saved: ./debug-screenshots/click_button-2025-10-21T17-45-32.png
📸 Element highlight: ./debug-screenshots/click_button-2025-10-21T17-45-32-element.png

# Error response includes:
{
  "error": "Button not found",
  "screenshotPath": "./debug-screenshots/click_button-2025-10-21T17-45-32.png"
}
```

**Estimated Time**: 3 hours
**Impact**: MEDIUM - Improves debugging

---

## Priority 4: TESTING & VALIDATION (Day 7)

### Task 4.1: Create Comprehensive Test Suite

**Problem**: No systematic testing of real-world sites

**Files to Create**:
- `tests/integration/amazon.test.ts`
- `tests/integration/google.test.ts`
- `tests/integration/github.test.ts`

**Implementation**:

```typescript
// NEW FILE: tests/integration/amazon.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { MCPServer } from '../../src/server/MCPServer';

describe('Amazon Integration Tests', () => {
  let server: MCPServer;

  beforeAll(async () => {
    server = new MCPServer();
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should search for products', async () => {
    const result = await server.handleRunFlow({
      goal: 'Search for blue t-shirt on Amazon'
    });

    expect(result.success).toBe(true);
    expect(result.data.parsedGoal.usedLLM).toBe(true);
    expect(result.data.flow).toContainEqual(
      expect.objectContaining({
        action: 'fill',
        input: expect.objectContaining({
          value: expect.stringContaining('blue t-shirt')
        })
      })
    );
  });

  it('should click first product', async () => {
    await server.handleNavigate({
      url: 'https://www.amazon.com/s?k=blue+t-shirt'
    });

    const result = await server.handleRunFlow({
      goal: 'Click the first product'
    });

    expect(result.success).toBe(true);
    expect(result.data.currentUrl).toMatch(/\/dp\//);  // Product page
  });

  it('should find product price', async () => {
    await server.handleNavigate({
      url: 'https://www.amazon.com/dp/B07XXXXXX'  // Sample product
    });

    const result = await server.handleRunFlow({
      goal: 'Get the product price'
    });

    expect(result.success).toBe(true);
    expect(result.data.price).toMatch(/\$\d+\.\d{2}/);
  });
});
```

**Run tests**:
```bash
npm run test:integration

# Expected output:
Amazon Integration Tests
  ✓ should search for products (5234ms)
  ✓ should click first product (3421ms)
  ✓ should find product price (2156ms)

Tests: 3 passed, 3 total
```

**Estimated Time**: 8 hours
**Impact**: HIGH - Ensures reliability

---

## Implementation Timeline

### Week 1: Critical Bugs & Core Features

**Day 1-2: Critical Bugs**
- [ ] Task 1.1: Fix form filler (4h)
- [ ] Task 1.2: Dynamic selectors (6h)
- [ ] Testing & validation (2h)

**Day 3-4: Core Features**
- [ ] Task 2.1: Bulk operations (8h)
- [ ] Task 2.2: OpenAI element finding (6h)

**Day 5-6: Reliability**
- [ ] Task 3.1: Retry logic (4h)
- [ ] Task 3.2: Page context awareness (6h)
- [ ] Task 3.3: Screenshot debugging (3h)

**Day 7: Testing**
- [ ] Task 4.1: Test suite (8h)
- [ ] End-to-end validation
- [ ] Documentation updates

---

## Success Metrics

### Before Fixes:
- ❌ Form filling: Random data
- ❌ Amazon product click: 0% success
- ❌ Bulk operations: Not supported
- ❌ OpenAI element finding: Name only, no actual AI

### After Fixes:
- ✅ Form filling: Uses LLM-parsed values
- ✅ Amazon product click: >80% success rate
- ✅ Bulk operations: Fully supported
- ✅ OpenAI element finding: Actually uses OpenAI API
- ✅ Test coverage: >70% on real-world sites

---

## Risk Mitigation

### Risk 1: OpenAI API Costs
**Mitigation**:
- Implement cost tracking
- Add warning at $10 usage
- Cache common operations

### Risk 2: Site Anti-Bot Measures
**Mitigation**:
- Add human-like delays
- Rotate user agents
- Respect robots.txt

### Risk 3: Breaking Changes
**Mitigation**:
- Comprehensive test suite
- Feature flags for new behavior
- Gradual rollout

---

## Post-Implementation Validation

### Amazon Full Flow Test:
```bash
# Should work end-to-end:
1. Navigate to Amazon
2. Search for "blue t-shirt"
3. Click first product
4. Get price
5. Add to cart

# Success criteria:
- All steps complete
- No random data
- Correct price extracted
```

### Bulk Operations Test:
```bash
# Should work:
run_flow({ goal: "Click all the Add to Cart buttons" })

# Success criteria:
- All buttons clicked
- No errors
- Returns count
```

---

## Next Steps After Completion

1. **Documentation**: Update README with new capabilities
2. **Examples**: Add real-world examples to `/examples`
3. **Video Demo**: Record working Amazon demo
4. **Blog Post**: "How UI-Probe Became Production-Ready"

---

*Last Updated*: 2025-10-21
*Owner*: Development Team
*Status*: Planning → Implementation
