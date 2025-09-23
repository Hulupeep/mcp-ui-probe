# UI-Probe LLM Integration Design Document
**Version:** 1.0
**Date:** 2025-01-23
**Purpose:** Add intelligent AI-powered testing capabilities to UI-Probe MCP Server

## Executive Summary
Transform UI-Probe from a pattern-matching tool into an intelligent testing agent by integrating LLM capabilities while maintaining regex fallback for API-less usage.

---

## 🏗️ ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                     UI-Probe MCP Server                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            Intelligence Layer (New)                  │    │
│  │                                                      │    │
│  │  ┌──────────────┐        ┌──────────────────┐     │    │
│  │  │ LLM Strategy │◄──────►│  Regex Fallback  │     │    │
│  │  │   (OpenAI/   │        │    (Current)     │     │    │
│  │  │   Claude)    │        └──────────────────┘     │    │
│  │  └──────────────┘                                  │    │
│  │         │                                          │    │
│  │         ▼                                          │    │
│  │  ┌──────────────────────────────────────┐        │    │
│  │  │     Workflow Decomposer              │        │    │
│  │  │  - Parse natural language            │        │    │
│  │  │  - Generate step sequence            │        │    │
│  │  │  - Handle conditionals               │        │    │
│  │  └──────────────────────────────────────┘        │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Execution Engine (Enhanced)                │    │
│  │                                                      │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │    │
│  │  │   Context    │  │   Adaptive   │  │  Error   │ │    │
│  │  │   Manager    │  │   Executor   │  │  Recovery│ │    │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Playwright Interface                    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧠 CORE COMPONENTS

### 1. Intelligence Layer

#### A. LLM Strategy Module
```javascript
class LLMStrategy {
  constructor(config) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    this.model = config.model || 'gpt-4-turbo-preview';
    this.fallbackToRegex = !this.apiKey;
  }

  async interpretGoal(goal, pageContext) {
    if (this.fallbackToRegex) {
      return this.regexInterpret(goal);
    }

    const prompt = `
      You are a test automation expert. Convert this natural language goal into concrete Playwright steps.

      Goal: ${goal}

      Page Context:
      - URL: ${pageContext.url}
      - Title: ${pageContext.title}
      - Available elements: ${JSON.stringify(pageContext.elements, null, 2)}

      Return a JSON array of steps. Each step should have:
      {
        "action": "click|fill|select|wait|assert|navigate",
        "selector": "CSS selector or text",
        "value": "value if needed",
        "description": "what this step does",
        "validation": "expected outcome",
        "fallback": "alternative selector if primary fails"
      }

      Consider:
      1. Multi-step sequences (login → navigate → perform action)
      2. Conditional logic (if element exists, do X, else Y)
      3. Waiting for dynamic content
      4. Handling popups/modals
      5. Form validation errors
    `;

    const response = await this.llm.complete(prompt);
    return JSON.parse(response);
  }

  async understandCustomComponent(element, context) {
    const prompt = `
      Analyze this UI element and determine how to interact with it:

      HTML: ${element.outerHTML}
      Type: ${element.tagName}
      Classes: ${element.className}
      ARIA: ${element.getAttribute('role')}
      Children: ${element.children.length}

      Context: User wants to ${context.intent}

      This appears to be a custom component. Determine:
      1. What type of component is this? (dropdown, date picker, toggle, etc.)
      2. How should we interact with it? (click to open, then click option, keyboard navigation, etc.)
      3. What's the sequence of actions needed?

      Return interaction strategy as JSON.
    `;

    return await this.llm.complete(prompt);
  }
}
```

#### B. Regex Fallback Module
```javascript
class RegexFallback {
  interpretGoal(goal) {
    // Current regex-based approach
    const patterns = {
      login: /log\s*in|sign\s*in/i,
      signup: /sign\s*up|register|create\s*account/i,
      fill: /fill|enter|type|input/i,
      click: /click|press|tap|select/i,
      navigate: /go\s*to|navigate|open|visit/i
    };

    // Basic pattern matching (current implementation)
    // Returns simplified steps without context awareness
  }
}
```

---

### 2. Workflow Decomposer

```javascript
class WorkflowDecomposer {
  constructor(llmStrategy) {
    this.llm = llmStrategy;
    this.memory = new Map(); // Track state between steps
  }

  async decompose(naturalLanguageGoal, currentContext) {
    // Step 1: Understand the high-level intent
    const intent = await this.llm.interpretGoal(naturalLanguageGoal, currentContext);

    // Step 2: Break down into atomic actions
    const workflow = {
      id: generateId(),
      goal: naturalLanguageGoal,
      steps: [],
      conditionals: [],
      validations: []
    };

    for (const step of intent) {
      const atomicStep = await this.createAtomicStep(step, currentContext);
      workflow.steps.push(atomicStep);

      // Update context after each step
      currentContext = await this.predictContextAfterStep(atomicStep, currentContext);
    }

    return workflow;
  }

  async createAtomicStep(step, context) {
    return {
      id: generateId(),
      action: step.action,
      target: await this.resolveSelector(step.selector, context),
      input: step.value,
      waitConditions: this.determineWaitConditions(step, context),
      errorHandlers: this.createErrorHandlers(step),
      validation: step.validation
    };
  }

  async resolveSelector(selector, context) {
    // Smart selector resolution
    if (selector.startsWith('text:')) {
      return `text="${selector.substring(5)}"`;
    }

    // Try to find the most robust selector
    const candidates = [
      selector, // Original
      `[aria-label="${selector}"]`, // ARIA
      `button:has-text("${selector}")`, // Text-based
      `input[placeholder*="${selector}"]` // Placeholder
    ];

    // Return first valid selector or array of fallbacks
    return {
      primary: candidates[0],
      fallbacks: candidates.slice(1)
    };
  }
}
```

---

### 3. Adaptive Executor

```javascript
class AdaptiveExecutor {
  constructor(page, llmStrategy) {
    this.page = page;
    this.llm = llmStrategy;
    this.retryStrategies = new Map();
  }

  async executeStep(step, context) {
    try {
      // Try primary selector
      return await this.executeAction(step.action, step.target.primary, step.input);
    } catch (error) {
      // Intelligent error recovery
      return await this.handleExecutionError(step, error, context);
    }
  }

  async handleExecutionError(step, error, context) {
    // 1. Try fallback selectors
    for (const fallback of step.target.fallbacks) {
      try {
        return await this.executeAction(step.action, fallback, step.input);
      } catch {}
    }

    // 2. Ask LLM for alternative approach
    if (this.llm.apiKey) {
      const alternative = await this.llm.suggestAlternative(step, error, context);
      if (alternative) {
        return await this.executeStep(alternative, context);
      }
    }

    // 3. Try interaction patterns for custom components
    if (error.message.includes('not an <input>')) {
      return await this.handleCustomComponent(step, context);
    }

    throw error;
  }

  async handleCustomComponent(step, context) {
    const element = await this.page.$(step.target.primary);

    if (!element) return null;

    // Get element details
    const elementInfo = await element.evaluate(el => ({
      tag: el.tagName,
      classes: el.className,
      role: el.getAttribute('role'),
      hasDropdownIcon: el.querySelector('[class*="arrow"], [class*="chevron"], svg') !== null
    }));

    // Common patterns for custom dropdowns
    const strategies = [
      // Strategy 1: Click to open, then click option
      async () => {
        await element.click();
        await this.page.waitForTimeout(300);
        const option = await this.page.$(`text="${step.input}"`);
        if (option) await option.click();
      },

      // Strategy 2: Focus and use keyboard
      async () => {
        await element.focus();
        await this.page.keyboard.press('Space');
        await this.page.waitForTimeout(300);
        await this.page.keyboard.type(step.input);
        await this.page.keyboard.press('Enter');
      },

      // Strategy 3: Click parent, wait for portal, click option
      async () => {
        const parent = await element.$('xpath=..');
        await parent.click();
        await this.page.waitForSelector('[role="listbox"], [role="menu"]', {timeout: 1000});
        await this.page.click(`text="${step.input}"`);
      }
    ];

    for (const strategy of strategies) {
      try {
        await strategy();
        return { success: true, strategy: strategies.indexOf(strategy) };
      } catch {}
    }

    return null;
  }
}
```

---

## 🔄 WORKFLOW EXAMPLES

### Example 1: Complex Multi-Step Signup
```javascript
// User Input:
"Sign up as John Doe with email john@example.com, select 'Small Business' as type, agree to terms, and verify the welcome message appears"

// LLM Decomposition:
{
  "workflow": {
    "steps": [
      {
        "action": "navigate",
        "target": "/auth/signup",
        "description": "Go to signup page"
      },
      {
        "action": "fill",
        "target": "#businessName",
        "value": "John Doe",
        "description": "Enter business name"
      },
      {
        "action": "custom_select",
        "target": ".business-type-dropdown",
        "value": "Small Business",
        "strategy": "click_and_select",
        "description": "Select business type from custom dropdown"
      },
      {
        "action": "fill",
        "target": "#email",
        "value": "john@example.com",
        "description": "Enter email address"
      },
      {
        "action": "fill",
        "target": "#password",
        "value": "SecurePass123!",
        "description": "Enter password"
      },
      {
        "action": "fill",
        "target": "#confirmPassword",
        "value": "SecurePass123!",
        "description": "Confirm password"
      },
      {
        "action": "click",
        "target": "input[type='checkbox'][name='terms']",
        "description": "Agree to terms"
      },
      {
        "action": "click",
        "target": "button:has-text('Sign Up')",
        "description": "Submit form",
        "waitAfter": {
          "type": "navigation",
          "timeout": 5000
        }
      },
      {
        "action": "assert",
        "target": ".welcome-message",
        "validation": "contains('Welcome, John Doe')",
        "description": "Verify welcome message"
      }
    ],
    "errorHandlers": [
      {
        "trigger": "validation_error",
        "action": "capture_and_report"
      }
    ]
  }
}
```

### Example 2: Conditional Flow
```javascript
// User Input:
"Try to login, if it fails due to no account, sign up instead"

// LLM Decomposition:
{
  "workflow": {
    "steps": [
      {
        "action": "navigate",
        "target": "/auth/login"
      },
      {
        "action": "fill",
        "target": "#email",
        "value": "user@example.com"
      },
      {
        "action": "fill",
        "target": "#password",
        "value": "password123"
      },
      {
        "action": "click",
        "target": "button:has-text('Login')"
      },
      {
        "action": "conditional",
        "condition": {
          "check": "element_exists",
          "selector": ".error-message:has-text('Account not found')"
        },
        "ifTrue": {
          "action": "subroutine",
          "routine": "signup_flow"
        },
        "ifFalse": {
          "action": "assert",
          "target": ".dashboard",
          "validation": "exists"
        }
      }
    ]
  }
}
```

---

## 📋 IMPLEMENTATION PLAN

### Phase 1: Core LLM Integration (Week 1-2)
```javascript
// 1. Add configuration for API keys
{
  "llm": {
    "provider": "openai", // or "anthropic", "local"
    "apiKey": process.env.OPENAI_API_KEY,
    "model": "gpt-4-turbo-preview",
    "temperature": 0.3, // Lower for more deterministic
    "maxTokens": 2000,
    "fallbackToRegex": true
  }
}

// 2. Create LLM service wrapper
class LLMService {
  async analyzeGoal(goal, context) { }
  async suggestSelector(element, intent) { }
  async handleError(error, context) { }
  async validateResult(expected, actual) { }
}
```

### Phase 2: Workflow Engine (Week 2-3)
- Implement workflow decomposer
- Add state management between steps
- Create conditional execution logic
- Build error recovery system

### Phase 3: Custom Component Handlers (Week 3-4)
- Pattern library for common UI frameworks
- Keyboard navigation fallbacks
- JavaScript evaluation strategies
- Shadow DOM support

### Phase 4: Validation Intelligence (Week 4-5)
- Detect client-side validation
- Understand error messages
- Generate valid test data
- Handle async validation

---

## 🎯 KEY FEATURES TO IMPLEMENT

### 1. Smart Data Generation
```javascript
async generateTestData(fieldType, constraints, context) {
  if (!this.llm.apiKey) {
    return this.randomDataGenerator(fieldType);
  }

  const prompt = `
    Generate realistic test data for:
    Field: ${fieldType}
    Constraints: ${JSON.stringify(constraints)}
    Business Context: ${context.businessType}

    Provide both valid and invalid examples for testing.
  `;

  return await this.llm.generate(prompt);
}
```

### 2. Visual Understanding
```javascript
async understandLayout(screenshot) {
  // Use vision API if available
  if (this.llm.supportsVision) {
    return await this.llm.analyzeImage(screenshot, {
      task: "Identify all interactive elements and their purposes"
    });
  }

  // Fallback to DOM analysis
  return this.analyzeDOM();
}
```

### 3. Learning from Failures
```javascript
class LearningSystem {
  constructor() {
    this.failurePatterns = new Map();
    this.successfulStrategies = new Map();
  }

  async recordOutcome(step, strategy, success) {
    const key = `${step.action}:${step.target.primary}`;

    if (success) {
      this.successfulStrategies.set(key, strategy);
    } else {
      this.failurePatterns.set(key, {
        ...this.failurePatterns.get(key),
        attempts: (this.failurePatterns.get(key)?.attempts || 0) + 1
      });
    }

    // Learn and adapt
    if (this.failurePatterns.get(key)?.attempts > 3) {
      await this.requestAlternativeApproach(step);
    }
  }
}
```

---

## 🚀 USAGE EXAMPLES

### With API Key (Full Intelligence)
```javascript
const uiProbe = new UIProbe({
  llm: {
    provider: 'openai',
    apiKey: 'sk-...',
    model: 'gpt-4-turbo-preview'
  }
});

// Natural language testing
await uiProbe.test("Sign up as a small business owner, complete onboarding, and create first chatbot");

// Understands context and multi-step flows
await uiProbe.test("Login with valid credentials, if successful go to settings and enable 2FA, otherwise reset password");
```

### Without API Key (Regex Fallback)
```javascript
const uiProbe = new UIProbe({
  llm: {
    fallbackToRegex: true
  }
});

// Still works but with limitations
await uiProbe.test("Click Login button"); // ✓ Works
await uiProbe.test("Fill email with test@example.com"); // ✓ Works
await uiProbe.test("Complete the entire signup flow"); // ✗ Too complex for regex
```

---

## 📊 PERFORMANCE CONSIDERATIONS

### 1. Caching Strategy
```javascript
class LLMCache {
  constructor() {
    this.interpretationCache = new Map();
    this.selectorCache = new Map();
  }

  getCachedInterpretation(goal, context) {
    const key = `${goal}:${context.url}`;
    return this.interpretationCache.get(key);
  }
}
```

### 2. Cost Management
```javascript
class CostManager {
  constructor(budget) {
    this.monthlyBudget = budget;
    this.usage = 0;
  }

  async trackUsage(tokens, model) {
    const cost = this.calculateCost(tokens, model);
    this.usage += cost;

    if (this.usage > this.monthlyBudget * 0.8) {
      console.warn('Approaching budget limit, switching to regex mode');
      this.switchToRegexMode();
    }
  }
}
```

### 3. Response Time Optimization
- Cache common patterns
- Batch similar requests
- Use smaller models for simple tasks
- Implement timeout with regex fallback

---

## 🔒 SECURITY CONSIDERATIONS

1. **API Key Management**
   - Never log API keys
   - Use environment variables
   - Implement key rotation

2. **Prompt Injection Prevention**
   - Sanitize user input
   - Validate LLM responses
   - Limit prompt size

3. **Data Privacy**
   - Don't send sensitive data to LLM
   - Option for local LLM models
   - Audit logging for compliance

---

## ✅ SUCCESS CRITERIA

### Must Have
- [ ] Multi-step workflow understanding
- [ ] Custom component interaction
- [ ] Validation detection
- [ ] Error recovery
- [ ] Regex fallback when no API key

### Should Have
- [ ] Learning from failures
- [ ] Visual understanding
- [ ] Cost management
- [ ] Performance optimization

### Nice to Have
- [ ] Local LLM support
- [ ] Voice command testing
- [ ] Accessibility testing AI
- [ ] Performance testing AI

---

## 📈 EXPECTED IMPROVEMENTS

| Feature | Current (Regex) | With LLM | Improvement |
|---------|----------------|----------|-------------|
| Multi-step workflows | 20% success | 95% success | 4.75x |
| Custom components | 0% success | 85% success | ∞ |
| Natural language | 30% understanding | 98% understanding | 3.3x |
| Error recovery | 10% | 80% | 8x |
| Validation detection | 30% | 95% | 3.2x |
| **Overall Score** | **7/10** | **9.5/10** | **35%** |

---

## 🎯 CONCLUSION

Adding LLM intelligence to UI-Probe will transform it from a basic pattern-matching tool into a sophisticated testing agent capable of:
1. Understanding complex, multi-step workflows
2. Adapting to custom components
3. Learning from failures
4. Generating intelligent test data
5. Providing meaningful test insights

The regex fallback ensures the tool remains functional without API keys, while LLM integration unlocks its full potential for modern web application testing.