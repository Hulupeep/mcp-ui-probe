/**
 * Tier 3: Adaptive Investigator
 *
 * Responsibilities:
 * - Deep investigation when tactical approaches fail
 * - Progressive depth analysis (visible → forms → full DOM)
 * - Generate and test alternative approaches
 * - Learn from failures
 */

import { Page } from 'playwright';
import { logger } from '../utils/logger.js';
import {
  StrategicStep,
  ExecutionResult,
  Investigation,
  InvestigationDepth,
  Alternative,
  LearningRecord,
  AlternativeAction,
} from './types.js';

export class AdaptiveInvestigator {
  private llmStrategy: any;
  private learnings: LearningRecord[] = [];
  private maxDepth: InvestigationDepth = 3;

  constructor(llmStrategy: any) {
    this.llmStrategy = llmStrategy;
  }

  /**
   * Adaptive retry when tactical execution fails
   */
  async adaptiveRetry(
    step: StrategicStep,
    page: Page,
    priorAttempts: string[]
  ): Promise<ExecutionResult> {
    logger.info('Adaptive investigation started', {
      step: step.action,
      target: step.target,
      priorAttempts: priorAttempts.length,
    });

    const startTime = Date.now();
    let depth: InvestigationDepth = 1;

    while (depth <= this.maxDepth) {
      logger.debug('Investigation depth', { depth });

      try {
        // Investigate page at this depth
        const investigation = await this.investigate(page, step, depth, priorAttempts);

        logger.debug('Investigation complete', {
          depth,
          alternatives: investigation.alternatives.length,
        });

        // Try each alternative approach
        for (const alternative of investigation.alternatives) {
          try {
            const result = await this.tryAlternative(alternative, page, step);

            if (result.success) {
              logger.info('Alternative approach succeeded', {
                method: alternative.method,
                depth,
                attempts: depth,
              });

              return {
                ...result,
                duration: Date.now() - startTime,
              };
            }

            // Record learning
            this.learnings.push({
              alternative,
              error: new Error(result.error || 'Unknown failure'),
              timestamp: Date.now(),
              context: `Depth ${depth}, step: ${step.action}`,
            });
          } catch (error: any) {
            this.learnings.push({
              alternative,
              error,
              timestamp: Date.now(),
              context: `Depth ${depth}, step: ${step.action}`,
            });
          }
        }

        // All alternatives at this depth failed, go deeper
        depth = (depth + 1) as InvestigationDepth;
      } catch (error: any) {
        logger.error('Investigation failed at depth', { depth, error: error.message });
        depth = (depth + 1) as InvestigationDepth;
      }
    }

    // Exhausted all depths
    logger.error('Adaptive retry exhausted', {
      step: step.action,
      depths: this.maxDepth,
      learnings: this.learnings.length,
    });

    return {
      success: false,
      method: 'adaptive_retry',
      attempts: this.maxDepth,
      duration: Date.now() - startTime,
      error: `Exhausted all investigation depths (${this.maxDepth})`,
    };
  }

  /**
   * Investigate page at given depth
   */
  private async investigate(
    page: Page,
    step: StrategicStep,
    depth: InvestigationDepth,
    priorAttempts: string[]
  ): Promise<Investigation> {
    const startTime = Date.now();

    // Gather findings at this depth
    const findings = await this.gatherFindings(page, depth);

    // Ask LLM to analyze and suggest alternatives
    const alternatives = await this.generateAlternatives(step, findings, priorAttempts, depth);

    return {
      depth,
      findings,
      alternatives,
      timestamp: startTime,
    };
  }

  /**
   * Gather findings at specified depth
   */
  private async gatherFindings(page: Page, depth: InvestigationDepth): Promise<string> {
    try {
      switch (depth) {
        case 1:
          // Depth 1: Visible elements only
          return await this.scanVisibleElements(page);

        case 2:
          // Depth 2: Form structure analysis
          return await this.analyzeFormStructure(page);

        case 3:
          // Depth 3: Full DOM analysis
          return await this.fullDOMAnalysis(page);

        default:
          return 'Unknown depth';
      }
    } catch (error: any) {
      logger.error('Failed to gather findings', { depth, error: error.message });
      return `Error gathering findings at depth ${depth}: ${error.message}`;
    }
  }

  /**
   * Depth 1: Scan visible elements
   */
  private async scanVisibleElements(page: Page): Promise<string> {
    const analysis = await page.evaluate(() => {
      const visible: string[] = [];

      // Get all visible, interactive elements
      const elements = document.querySelectorAll(
        'button, a, input, textarea, select, [role="button"], [onclick]'
      );

      elements.forEach((el: any, idx) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const text = el.textContent?.trim() || el.value || el.placeholder || '';
          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : '';
          const classes = el.className ? `.${el.className.split(' ').join('.')}` : '';

          visible.push(`${tag}${id}${classes}: "${text.substring(0, 50)}"`);
        }
      });

      return visible.slice(0, 30).join('\n');
    });

    return `Visible interactive elements:\n${analysis}`;
  }

  /**
   * Depth 2: Analyze form structure
   */
  private async analyzeFormStructure(page: Page): Promise<string> {
    const analysis = await page.evaluate(() => {
      const forms: string[] = [];

      document.querySelectorAll('form').forEach((form: any, idx) => {
        const formInfo: string[] = [];
        formInfo.push(`Form ${idx + 1}:`);
        formInfo.push(`  ID: ${form.id || 'none'}`);
        formInfo.push(`  Action: ${form.action || 'none'}`);
        formInfo.push(`  Method: ${form.method || 'none'}`);

        const fields: string[] = [];
        form.querySelectorAll('input, textarea, select').forEach((field: any) => {
          fields.push(
            `    ${field.type || field.tagName}: ${field.name || field.id || 'unnamed'}`
          );
        });

        formInfo.push(`  Fields (${fields.length}):`);
        formInfo.push(...fields.slice(0, 10));

        forms.push(formInfo.join('\n'));
      });

      return forms.join('\n\n');
    });

    return `Form structure analysis:\n${analysis}`;
  }

  /**
   * Depth 3: Full DOM analysis
   */
  private async fullDOMAnalysis(page: Page): Promise<string> {
    const analysis = await page.evaluate(() => {
      const info: string[] = [];

      // Document structure
      info.push(`Title: ${document.title}`);
      info.push(`URL: ${window.location.href}`);
      info.push(`Body classes: ${document.body.className}`);

      // Count all interactive elements
      info.push(`\nElement counts:`);
      info.push(`  Forms: ${document.querySelectorAll('form').length}`);
      info.push(`  Buttons: ${document.querySelectorAll('button, input[type="button"], input[type="submit"]').length}`);
      info.push(`  Links: ${document.querySelectorAll('a').length}`);
      info.push(`  Inputs: ${document.querySelectorAll('input, textarea, select').length}`);

      // Find elements with specific attributes
      info.push(`\nElements with data attributes:`);
      document.querySelectorAll('[data-component-type], [data-testid], [data-cy]').forEach((el: any) => {
        info.push(`  ${el.tagName}: ${el.getAttribute('data-component-type') || el.getAttribute('data-testid') || el.getAttribute('data-cy')}`);
      });

      // Find elements with aria labels
      info.push(`\nAccessible elements:`);
      document.querySelectorAll('[aria-label], [role]').forEach((el: any, idx) => {
        if (idx < 10) {
          info.push(`  ${el.tagName}[${el.getAttribute('role') || ''}]: ${el.getAttribute('aria-label') || ''}`);
        }
      });

      return info.join('\n');
    });

    return `Full DOM analysis:\n${analysis}`;
  }

  /**
   * Generate alternative approaches using LLM
   */
  private async generateAlternatives(
    step: StrategicStep,
    findings: string,
    priorAttempts: string[],
    depth: InvestigationDepth
  ): Promise<Alternative[]> {
    const prompt = this.buildInvestigationPrompt(step, findings, priorAttempts, depth);

    try {
      const response = await this.llmStrategy.callLLM(prompt, {
        response_format: { type: 'json_object' },
        temperature: 0.5, // Higher temperature for creative alternatives
      });

      const parsed = JSON.parse(response);
      return parsed.alternatives || [];
    } catch (error: any) {
      logger.error('Failed to generate alternatives', { error: error.message });
      return this.fallbackAlternatives(step, depth);
    }
  }

  /**
   * Build investigation prompt for LLM
   */
  private buildInvestigationPrompt(
    step: StrategicStep,
    findings: string,
    priorAttempts: string[],
    depth: InvestigationDepth
  ): string {
    return `You are investigating why a web automation step failed. Generate alternative approaches.

# Failed Step
Action: ${step.action}
Target: ${step.target}
Original reasoning: ${step.reasoning}

# Prior Attempts (ALL FAILED)
${priorAttempts.map((a, i) => `${i + 1}. ${a}`).join('\n') || 'None yet'}

# Investigation Findings (Depth ${depth}/3)
${findings}

# Your Task
Analyze WHY the previous attempts failed and generate 3 DIFFERENT alternative approaches.

Think creatively:
- Depth 1: Try different common selectors
- Depth 2: Try form submission, keyboard events
- Depth 3: Try data attributes, ARIA labels, JavaScript execution

# Output Format (JSON only)
{
  "analysis": "Why did previous attempts fail? (2-3 sentences)",
  "alternatives": [
    {
      "method": "Description of this approach",
      "reasoning": "Why this might work where others failed",
      "selectors": ["selector1", "selector2"],
      "actions": [
        { "type": "fill | click | press | hover", "target": "selector", "value": "optional" }
      ],
      "confidence": 0.6,
      "estimatedComplexity": "simple | moderate | complex"
    }
  ]
}

Generate 3 alternatives ranked by likelihood. Output ONLY the JSON.`;
  }

  /**
   * Try an alternative approach
   */
  private async tryAlternative(
    alternative: Alternative,
    page: Page,
    step: StrategicStep
  ): Promise<ExecutionResult> {
    logger.debug('Trying alternative', { method: alternative.method });

    try {
      // If selectors are provided, try them first
      if (alternative.selectors && alternative.selectors.length > 0) {
        for (const selector of alternative.selectors) {
          try {
            await this.executeSimpleAction(step.action, selector, step.target, page);
            return {
              success: true,
              method: alternative.method,
              selector,
              attempts: 1,
              duration: 0,
            };
          } catch (err) {
            continue;
          }
        }
      }

      // If actions are provided, execute the sequence
      if (alternative.actions && alternative.actions.length > 0) {
        for (const action of alternative.actions) {
          await this.executeComplexAction(action, page);
        }
        return {
          success: true,
          method: alternative.method,
          attempts: 1,
          duration: 0,
        };
      }

      return {
        success: false,
        method: alternative.method,
        attempts: 1,
        duration: 0,
        error: 'No executable actions in alternative',
      };
    } catch (error: any) {
      return {
        success: false,
        method: alternative.method,
        attempts: 1,
        duration: 0,
        error: error.message,
      };
    }
  }

  /**
   * Execute simple action (fill, click, etc.)
   */
  private async executeSimpleAction(
    action: string,
    selector: string,
    value: string,
    page: Page
  ): Promise<void> {
    switch (action) {
      case 'search':
      case 'fill':
        await page.fill(selector, value, { timeout: 3000 });
        break;
      case 'click':
        await page.click(selector, { timeout: 3000 });
        break;
      case 'extract':
        await page.textContent(selector, { timeout: 3000 });
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Execute complex action sequence
   */
  private async executeComplexAction(action: AlternativeAction, page: Page): Promise<void> {
    if (action.delay) {
      await page.waitForTimeout(action.delay);
    }

    if (!action.target) {
      return;
    }

    switch (action.type) {
      case 'fill':
        await page.fill(action.target, action.value || '', { timeout: 3000 });
        break;
      case 'click':
        await page.click(action.target, { timeout: 3000 });
        break;
      case 'press':
        await page.keyboard.press(action.value || 'Enter');
        break;
      case 'hover':
        await page.hover(action.target, { timeout: 3000 });
        break;
      case 'wait':
        await page.waitForSelector(action.target, { timeout: 5000 });
        break;
      case 'scroll':
        await page.locator(action.target).scrollIntoViewIfNeeded({ timeout: 3000 });
        break;
    }
  }

  /**
   * Fallback alternatives when LLM fails
   */
  private fallbackAlternatives(step: StrategicStep, depth: InvestigationDepth): Alternative[] {
    // Simple fallback based on depth
    const alternatives: Alternative[] = [];

    if (depth === 1) {
      alternatives.push({
        method: 'Try common selectors',
        reasoning: 'Fallback to common patterns',
        selectors: ['button[type="submit"]', 'input[type="submit"]', '.submit-button'],
        confidence: 0.3,
        estimatedComplexity: 'simple',
      });
    } else if (depth === 2) {
      alternatives.push({
        method: 'Try keyboard submit',
        reasoning: 'Use Enter key instead of clicking',
        actions: [
          { type: 'press', value: 'Enter' },
        ],
        confidence: 0.4,
        estimatedComplexity: 'simple',
      });
    } else {
      alternatives.push({
        method: 'Try data attributes',
        reasoning: 'Look for data-testid or data-cy',
        selectors: ['[data-testid*="submit"]', '[data-cy*="submit"]'],
        confidence: 0.2,
        estimatedComplexity: 'moderate',
      });
    }

    return alternatives;
  }

  /**
   * Get all learnings from this session
   */
  getLearnings(): LearningRecord[] {
    return this.learnings;
  }
}
