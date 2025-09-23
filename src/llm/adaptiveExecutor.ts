import { Page } from 'playwright';
import logger from '../utils/logger.js';
import { LLMStrategy } from './llmStrategy.js';

export interface ExecutionOptions {
  maxRetries?: number;
  timeout?: number;
  waitForNavigation?: boolean;
  screenshot?: boolean;
}

export interface ExecutionResult {
  success: boolean;
  retryCount?: number;
  error?: string;
  context?: any;
  completedSteps?: number;
  errors?: string[];
}

export interface Action {
  action: string;
  target?: string;
  url?: string;
  value?: any;
  data?: any;
  optional?: boolean;
  critical?: boolean;
  waitFor?: boolean;
  storeAs?: string;
  useStored?: string;
  condition?: string;
  submit?: boolean;
}

export class AdaptiveExecutor {
  private llmStrategy: LLMStrategy;
  private context: Map<string, any>;

  constructor() {
    this.llmStrategy = new LLMStrategy();
    this.context = new Map();
  }

  async execute(
    page: Page,
    action: Action,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const maxRetries = options.maxRetries || 3;
    let retryCount = 0;
    let lastError: Error | null = null;
    const attemptedSelectors: string[] = [];

    while (retryCount < maxRetries) {
      try {
        // Handle waiting for dynamic content
        if (action.waitFor && action.target) {
          await page.waitForSelector(action.target, {
            timeout: options.timeout || 5000
          });
        }

        // Execute based on action type
        switch (action.action) {
          case 'navigate':
            await this.executeNavigate(page, action, options);
            break;

          case 'click':
            await this.executeClick(page, action, attemptedSelectors);
            break;

          case 'fill':
            await this.executeFill(page, action);
            break;

          case 'assert':
            await this.executeAssert(page, action);
            break;

          case 'wait':
            await page.waitForTimeout(action.value || 1000);
            break;

          case 'conditional':
            await this.executeConditional(page, action);
            break;

          default:
            throw new Error(`Unknown action: ${action.action}`);
        }

        // Store result if needed
        if (action.storeAs) {
          this.context.set(action.storeAs, action.value);
        }

        return {
          success: true,
          retryCount,
          context: Object.fromEntries(this.context)
        };

      } catch (error: any) {
        lastError = error;
        retryCount++;
        attemptedSelectors.push(action.target || '');

        logger.warn(`Action failed, attempt ${retryCount}/${maxRetries}`, {
          action: action.action,
          error: error.message
        });

        // Try recovery strategies
        if (retryCount < maxRetries) {
          const recovered = await this.attemptRecovery(page, action, error);
          if (recovered) {
            action = recovered;
            continue;
          }
        }

        // Try alternative approaches
        if (error.message.includes('not attached') || error.message.includes('stale')) {
          await page.waitForTimeout(500);
          continue;
        }

        if (error.message.includes('not found') && action.target) {
          // Try finding in iframes
          const inIframe = await this.tryInIframe(page, action);
          if (inIframe) {
            return {
              success: true,
              retryCount,
              context: { ...Object.fromEntries(this.context), frameUsed: true }
            };
          }

          // Try shadow DOM
          const inShadow = await this.tryInShadowDOM(page, action);
          if (inShadow) {
            return {
              success: true,
              retryCount,
              context: Object.fromEntries(this.context)
            };
          }
        }
      }
    }

    // Failed after all retries
    return {
      success: false,
      retryCount,
      error: lastError?.message || 'Unknown error',
      context: {
        url: page.url(),
        attemptedSelectors,
        ...Object.fromEntries(this.context)
      }
    };
  }

  async executeSequence(
    page: Page,
    actions: Action[],
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    let completedSteps = 0;
    const errors: string[] = [];

    for (const action of actions) {
      // Handle stored values
      if (action.useStored && this.context.has(action.useStored)) {
        action.value = this.context.get(action.useStored);
      }

      // Replace variables in values
      if (action.value && typeof action.value === 'string') {
        action.value = this.replaceVariables(action.value);
      }

      const result = await this.execute(page, action, options);

      if (result.success) {
        completedSteps++;
      } else {
        if (action.critical !== false && !action.optional) {
          // Critical failure, stop execution
          return {
            success: false,
            completedSteps,
            errors: [result.error || 'Unknown error'],
            context: result.context
          };
        } else {
          // Optional/non-critical, continue
          errors.push(result.error || 'Unknown error');
          logger.info('Skipping optional/non-critical step', { action });
        }
      }
    }

    return {
      success: errors.length === 0,
      completedSteps,
      errors: errors.length > 0 ? errors : undefined,
      context: Object.fromEntries(this.context)
    };
  }

  private async executeNavigate(page: Page, action: Action, options: ExecutionOptions): Promise<void> {
    const url = action.url || '/';

    if (options.waitForNavigation) {
      await Promise.all([
        page.waitForNavigation(),
        page.goto(url)
      ]);
    } else {
      await page.goto(url);
    }
  }

  private async executeClick(page: Page, action: Action, attemptedSelectors: string[]): Promise<void> {
    if (!action.target) throw new Error('Click action requires a target');

    try {
      await page.click(action.target);
    } catch (error: any) {
      // Try alternative click methods
      const element = await page.$(action.target);
      if (element) {
        await element.click();
      } else {
        // Try to find by text content
        const alternatives = await this.findAlternativeSelectors(page, action.target);
        for (const alt of alternatives) {
          if (!attemptedSelectors.includes(alt)) {
            try {
              await page.click(alt);
              return;
            } catch {
              attemptedSelectors.push(alt);
            }
          }
        }
        throw error;
      }
    }
  }

  private async executeFill(page: Page, action: Action): Promise<void> {
    if (action.data) {
      // Multiple fields
      for (const [field, value] of Object.entries(action.data)) {
        const selector = await this.findFieldSelector(page, field);
        if (selector) {
          await page.fill(selector, String(value));
        }
      }

      if (action.submit) {
        await this.submitForm(page);
      }
    } else if (action.target && action.value !== undefined) {
      // Single field
      await page.fill(action.target, action.value);
    }
  }

  private async executeAssert(page: Page, action: Action): Promise<void> {
    if (!action.target) throw new Error('Assert action requires a target');

    const element = await page.$(action.target);
    if (!element) {
      throw new Error(`Element not found: ${action.target}`);
    }

    if (action.value) {
      const text = await element.textContent();
      if (action.value && !text?.includes(String(action.value))) {
        throw new Error(`Text "${action.value}" not found in element`);
      }
    }
  }

  private async executeConditional(page: Page, action: Action): Promise<void> {
    // Simplified conditional execution
    const conditionMet = await this.evaluateCondition(page, action.condition || '');

    if (conditionMet) {
      logger.info('Condition met', { condition: action.condition });
    } else {
      logger.info('Condition not met', { condition: action.condition });
    }
  }

  private async attemptRecovery(page: Page, action: Action, error: Error): Promise<Action | null> {
    if (!action.target) return null;

    try {
      // Ask LLM for alternatives
      const pageContent = await page.content();
      const alternatives = await this.llmStrategy.suggestAlternatives(
        action.target,
        pageContent.substring(0, 5000)
      );

      if (alternatives.length > 0) {
        logger.info('Trying alternative selector', {
          original: action.target,
          alternative: alternatives[0]
        });

        return {
          ...action,
          target: alternatives[0]
        };
      }
    } catch (err) {
      logger.error('Recovery attempt failed', { err });
    }

    return null;
  }

  private async tryInIframe(page: Page, action: Action): Promise<boolean> {
    const frames = page.frames();

    for (const frame of frames) {
      try {
        if (action.target) {
          const element = await frame.$(action.target);
          if (element) {
            await element.click();
            return true;
          }
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  private async tryInShadowDOM(page: Page, action: Action): Promise<boolean> {
    if (!action.target) return false;

    try {
      const result = await page.evaluate((selector) => {
        const shadowRoots = Array.from(document.querySelectorAll('*'))
          .filter(el => el.shadowRoot)
          .map(el => el.shadowRoot);

        for (const root of shadowRoots) {
          const element = root?.querySelector(selector);
          if (element && element instanceof HTMLElement) {
            element.click();
            return true;
          }
        }
        return false;
      }, action.target);

      return result;
    } catch {
      return false;
    }
  }

  private async findAlternativeSelectors(page: Page, target: string): Promise<string[]> {
    const alternatives: string[] = [];

    // Extract text from target
    const textMatch = target.match(/text[=~]"?([^"]+)"?/);
    if (textMatch) {
      const text = textMatch[1];
      alternatives.push(
        `button:has-text("${text}")`,
        `a:has-text("${text}")`,
        `[aria-label="${text}"]`,
        `[title="${text}"]`
      );
    }

    // Try to find by partial class or id
    if (target.includes('.')) {
      const className = target.split('.')[1];
      alternatives.push(`[class*="${className}"]`);
    }

    if (target.includes('#')) {
      const id = target.split('#')[1];
      alternatives.push(`[id="${id}"]`, `[name="${id}"]`);
    }

    // Filter out alternatives that don't exist
    const existing: string[] = [];
    for (const alt of alternatives) {
      try {
        const element = await page.$(alt);
        if (element) existing.push(alt);
      } catch {
        continue;
      }
    }

    return existing;
  }

  private async findFieldSelector(page: Page, fieldName: string): Promise<string | null> {
    const possibleSelectors = [
      `input[name="${fieldName}"]`,
      `input[id="${fieldName}"]`,
      `input[placeholder*="${fieldName}"]`,
      `textarea[name="${fieldName}"]`,
      `select[name="${fieldName}"]`,
      `[data-testid="${fieldName}"]`,
      `label:has-text("${fieldName}") + input`,
      `label:has-text("${fieldName}") + select`,
      `label:has-text("${fieldName}") + textarea`
    ];

    for (const selector of possibleSelectors) {
      try {
        const element = await page.$(selector);
        if (element) return selector;
      } catch {
        continue;
      }
    }

    return null;
  }

  private async submitForm(page: Page): Promise<void> {
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("Sign Up")',
      'button:has-text("Login")',
      'button:has-text("Register")',
      '.submit-button',
      '[data-testid="submit"]'
    ];

    for (const selector of submitSelectors) {
      try {
        await page.click(selector);
        return;
      } catch {
        continue;
      }
    }

    throw new Error('Could not find submit button');
  }

  private replaceVariables(value: string): string {
    return value.replace(/\$\{(\w+)\}/g, (match, key) => {
      return this.context.get(key) || match;
    });
  }

  private async evaluateCondition(page: Page, condition: string): Promise<boolean> {
    // Simple condition evaluation
    if (condition.includes('logged in')) {
      // Check for common logged-in indicators
      const loggedInSelectors = [
        '.user-menu',
        '[data-testid="user-profile"]',
        '.logout-button',
        '#dashboard'
      ];

      for (const selector of loggedInSelectors) {
        const element = await page.$(selector);
        if (element) return true;
      }
      return false;
    }

    return false;
  }
}