/**
 * Tier 2: Tactical Executor
 *
 * Responsibilities:
 * - Execute steps using "obvious" approaches
 * - Fast execution with common patterns
 * - Fall back to Tier 3 on failure
 */

import { Page } from 'playwright';
import { logger } from '../utils/logger.js';
import {
  StrategicStep,
  TacticalApproach,
  ExecutionResult,
  PageSnapshot,
} from './types.js';

export class TacticalExecutor {
  private llmStrategy: any;

  constructor(llmStrategy: any) {
    this.llmStrategy = llmStrategy;
  }

  /**
   * Execute a strategic step using tactical approach
   */
  async executeStep(step: StrategicStep, page: Page): Promise<ExecutionResult> {
    const startTime = Date.now();
    logger.info('Tactical execution started', { action: step.action, target: step.target });

    try {
      // Get page snapshot for LLM
      const snapshot = await this.capturePageSnapshot(page);

      // LLM suggests the "obvious" approach
      const approach = await this.suggestApproach(step, snapshot);

      logger.debug('Tactical approach suggested', {
        method: approach.method,
        confidence: approach.confidence,
        selectors: approach.selectors.length,
      });

      // Try the obvious approach
      const result = await this.tryApproach(step, approach, page);

      return {
        ...result,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error('Tactical execution failed', {
        action: step.action,
        error: error.message,
      });

      return {
        success: false,
        method: 'failed',
        attempts: 1,
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Capture lightweight page snapshot for LLM
   */
  private async capturePageSnapshot(page: Page): Promise<PageSnapshot> {
    try {
      const snapshot = await page.evaluate(() => {
        // Find buttons
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'))
          .slice(0, 20)
          .map((btn, idx) => ({
            text: btn.textContent?.trim() || btn.getAttribute('value') || '',
            selector: `button:nth-of-type(${idx + 1})`,
          }));

        // Find inputs
        const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
          .slice(0, 15)
          .map((input: any) => ({
            type: input.type || input.tagName.toLowerCase(),
            name: input.name || input.id || '',
            selector: input.id ? `#${input.id}` : `input[name="${input.name}"]`,
          }));

        // Find links
        const links = Array.from(document.querySelectorAll('a[href]'))
          .slice(0, 20)
          .map((link: any, idx) => ({
            text: link.textContent?.trim() || '',
            href: link.href,
            selector: `a:nth-of-type(${idx + 1})`,
          }));

        // Find forms
        const forms = Array.from(document.querySelectorAll('form')).map((form: any, idx) => ({
          name: form.name || form.id || `form-${idx}`,
          selector: form.id ? `#${form.id}` : `form:nth-of-type(${idx + 1})`,
          fields: Array.from(form.querySelectorAll('input, textarea, select')).map((field: any) => ({
            name: field.name || field.id || '',
            type: field.type || field.tagName.toLowerCase(),
          })),
        }));

        return {
          url: window.location.href,
          title: document.title,
          visibleElements: { buttons, inputs, links },
          forms,
        };
      });

      return snapshot;
    } catch (error: any) {
      logger.error('Failed to capture page snapshot', { error: error.message });
      return {
        url: page.url(),
        title: await page.title().catch(() => 'Unknown'),
        visibleElements: { buttons: [], inputs: [], links: [] },
        forms: [],
      };
    }
  }

  /**
   * Ask LLM to suggest the obvious approach
   */
  private async suggestApproach(step: StrategicStep, snapshot: PageSnapshot): Promise<TacticalApproach> {
    const prompt = this.buildTacticalPrompt(step, snapshot);

    try {
      const response = await this.llmStrategy.callLLM(prompt, {
        response_format: { type: 'json_object' },
        temperature: 0.2, // Low temperature for "obvious" answers
      });

      const parsed = JSON.parse(response);

      return {
        method: parsed.method || 'unknown',
        reasoning: parsed.reasoning || '',
        selectors: parsed.selectors || [],
        confidence: parsed.confidence || 0.5,
        estimatedTime: parsed.estimatedTime || 1000,
        fallbackStrategy: parsed.fallbackStrategy || 'investigate',
      };
    } catch (error: any) {
      logger.error('LLM tactical suggestion failed', { error: error.message });

      // Fallback to heuristic approach
      return this.heuristicApproach(step, snapshot);
    }
  }

  /**
   * Build tactical prompt for LLM
   */
  private buildTacticalPrompt(step: StrategicStep, snapshot: PageSnapshot): string {
    return `You are executing a web automation step. Suggest the MOST OBVIOUS way to do it.

# Step to Execute
Action: ${step.action}
Target: ${step.target}
Reasoning: ${step.reasoning}

# Page State
URL: ${snapshot.url}
Title: ${snapshot.title}

Available Buttons (${snapshot.visibleElements.buttons.length}):
${snapshot.visibleElements.buttons.map(b => `- "${b.text}"`).join('\n')}

Available Inputs (${snapshot.visibleElements.inputs.length}):
${snapshot.visibleElements.inputs.map(i => `- ${i.type}: ${i.name}`).join('\n')}

Available Links (${snapshot.visibleElements.links.length}):
${snapshot.visibleElements.links.slice(0, 10).map(l => `- "${l.text}"`).join('\n')}

Forms (${snapshot.forms.length}):
${snapshot.forms.map(f => `- ${f.name} (${f.fields.length} fields)`).join('\n')}

# Your Task
Think like a human: "If I saw this page and wanted to ${step.action} for '${step.target}', what's the MOST OBVIOUS thing to do?"

Examples of "obvious":
- If action is "search" and there's an input with "search" in the name → Fill that input
- If action is "click" and target is "first product" → Click the first prominent link
- If action is "extract" and target is "price" → Look for elements containing "$" or price classes

# Output Format (JSON only)
{
  "method": "fill_input | click_button | click_link | extract_text | press_enter",
  "reasoning": "Why this is the obvious approach (1 sentence)",
  "selectors": ["#main-search", "input[name='q']", "input[type='search']"],
  "confidence": 0.85,
  "estimatedTime": 500,
  "fallbackStrategy": "investigate | skip | retry"
}

Think step-by-step about what's OBVIOUS, then output ONLY the JSON.`;
  }

  /**
   * Try the suggested approach
   */
  private async tryApproach(
    step: StrategicStep,
    approach: TacticalApproach,
    page: Page
  ): Promise<ExecutionResult> {
    let attempts = 0;

    for (const selector of approach.selectors) {
      attempts++;

      try {
        const result = await this.executeAction(step.action, selector, step.target, page);

        if (result.success) {
          logger.info('Tactical approach succeeded', {
            method: approach.method,
            selector,
            attempts,
          });

          return {
            success: true,
            method: approach.method,
            selector,
            attempts,
            duration: 0, // Will be set by caller
          };
        }
      } catch (error: any) {
        logger.debug('Selector attempt failed', { selector, error: error.message });
        continue;
      }
    }

    // All selectors failed
    return {
      success: false,
      method: approach.method,
      attempts,
      duration: 0,
      error: `All ${approach.selectors.length} selectors failed`,
    };
  }

  /**
   * Execute specific action with selector
   */
  private async executeAction(
    action: string,
    selector: string,
    target: string,
    page: Page
  ): Promise<{ success: boolean; data?: any }> {
    try {
      switch (action) {
        case 'search':
        case 'fill':
          await page.fill(selector, target, { timeout: 3000 });
          return { success: true };

        case 'click':
          await page.click(selector, { timeout: 3000 });
          // Wait for potential navigation
          await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
          return { success: true };

        case 'extract':
          const text = await page.textContent(selector, { timeout: 3000 });
          return { success: true, data: text };

        case 'wait':
          await page.waitForSelector(selector, { timeout: 5000 });
          return { success: true };

        case 'scroll':
          await page.locator(selector).scrollIntoViewIfNeeded({ timeout: 3000 });
          return { success: true };

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error: any) {
      return { success: false };
    }
  }

  /**
   * Fallback heuristic approach when LLM fails
   */
  private heuristicApproach(step: StrategicStep, snapshot: PageSnapshot): TacticalApproach {
    const selectors: string[] = [];

    // Simple heuristics based on action type
    switch (step.action) {
      case 'search':
      case 'fill':
        selectors.push(
          'input[type="search"]',
          'input[name*="search"]',
          'input[name*="q"]',
          'input[id*="search"]',
          '#search',
          '.search-input'
        );
        break;

      case 'click':
        if (step.target.toLowerCase().includes('submit') || step.target.toLowerCase().includes('search')) {
          selectors.push(
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Search")',
            'button:has-text("Submit")'
          );
        } else {
          selectors.push(
            'a:first-of-type',
            'button:first-of-type',
            '[data-component-type="s-search-result"]:first-of-type a'
          );
        }
        break;

      case 'extract':
        selectors.push(
          '.price',
          '.a-price',
          '[data-price]',
          'span:has-text("$")',
          '*:has-text("$"):visible'
        );
        break;
    }

    return {
      method: `heuristic_${step.action}`,
      reasoning: 'Fallback heuristic approach',
      selectors,
      confidence: 0.4,
      estimatedTime: 1000,
      fallbackStrategy: 'investigate',
    };
  }
}
