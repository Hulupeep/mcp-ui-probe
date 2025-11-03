/**
 * Tier 2: Tactical Executor
 *
 * Responsibilities:
 * - Execute steps using "obvious" approaches
 * - Fast execution with common patterns
 * - Fall back to Tier 3 on failure
 */

import { Page, Locator } from 'playwright';
import { logger } from '../utils/logger.js';
import {
  StrategicStep,
  TacticalApproach,
  ExecutionResult,
  PageSnapshot,
} from './types.js';
import { sublinearSolver } from '../services/SublinearSolverIntegration.js';
import { pageRankValidator } from '../services/PageRankValidator.js';

export class TacticalExecutor {
  private llmStrategy: any;
  private usePageRank: boolean = true; // Toggle PageRank optimization
  private enableValidation: boolean = true; // Enable PageRank validation

  constructor(llmStrategy: any, options: { usePageRank?: boolean; enableValidation?: boolean } = {}) {
    this.llmStrategy = llmStrategy;
    this.usePageRank = options.usePageRank ?? true;
    this.enableValidation = options.enableValidation ?? true;
  }

  /**
   * Execute a strategic step using tactical approach
   * Enhanced with PageRank-based element prioritization
   */
  async executeStep(step: StrategicStep, page: Page): Promise<ExecutionResult> {
    const startTime = Date.now();
    logger.info('Tactical execution started', {
      action: step.action,
      target: step.target,
      pageRankEnabled: this.usePageRank
    });

    try {
      // Get page snapshot for LLM
      const snapshot = await this.capturePageSnapshot(page);

      // LLM suggests the "obvious" approach
      const approach = await this.suggestApproach(step, snapshot, page);

      logger.debug('Tactical approach suggested', {
        method: approach.method,
        confidence: approach.confidence,
        selectors: approach.selectors.length,
        pageRankOptimized: this.usePageRank
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
   * Execute workflow step with multi-element iteration support (P1)
   * Handles iterateAll, index, limit, offset, rangeStart, rangeEnd
   */
  async executeStepWithIteration(step: any, page: Page): Promise<ExecutionResult> {
    const startTime = Date.now();

    if (!step.selector) {
      return {
        success: false,
        method: 'iteration',
        attempts: 0,
        duration: Date.now() - startTime,
        error: 'No selector provided'
      };
    }

    const locator = page.locator(step.selector);
    const count = await locator.count();

    if (count === 0) {
      return {
        success: false,
        method: 'iteration',
        attempts: 0,
        duration: Date.now() - startTime,
        error: 'No elements found matching selector'
      };
    }

    // Determine which elements to iterate over
    const indices = this.determineIndices(step, count);

    // Batch mode uses page.evaluate for performance
    if (step.iterationMode === 'batch') {
      return await this.executeBatchMode(step, page, indices, startTime);
    }

    // Sequential/parallel mode iterates individually
    return await this.executeIterationMode(step, locator, indices, startTime);
  }

  /**
   * Determine which element indices to iterate over
   */
  private determineIndices(step: any, totalCount: number): number[] {
    // iterateAll: all elements
    if (step.iterateAll) {
      return Array.from({ length: totalCount }, (_, i) => i);
    }

    // index: specific element (first=0, last=-1, nth=n)
    if (step.index !== undefined) {
      const idx = step.index === -1 ? totalCount - 1 : step.index;
      return [idx];
    }

    // limit/offset: first N elements with offset
    if (step.limit !== undefined) {
      const offset = step.offset || 0;
      const limit = Math.min(step.limit, totalCount - offset);
      return Array.from({ length: limit }, (_, i) => offset + i);
    }

    // rangeStart/rangeEnd: elements in range
    if (step.rangeStart !== undefined && step.rangeEnd !== undefined) {
      const start = step.rangeStart;
      const end = Math.min(step.rangeEnd, totalCount - 1);
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }

    // Default: first element only
    return [0];
  }

  /**
   * Execute in batch mode using page.evaluate
   */
  private async executeBatchMode(step: any, page: Page, indices: number[], startTime: number): Promise<ExecutionResult> {
    try {
      await page.evaluate(({ selector, action }) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el: any) => {
          if (action === 'click') el.click();
        });
      }, { selector: step.selector, action: step.action });

      return {
        success: true,
        method: 'batch',
        attempts: 1,
        duration: Date.now() - startTime,
        data: { count: indices.length }
      };
    } catch (error: any) {
      return {
        success: false,
        method: 'batch',
        attempts: 1,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Execute in sequential/parallel mode
   */
  private async executeIterationMode(step: any, locator: Locator, indices: number[], startTime: number): Promise<ExecutionResult> {
    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const idx of indices) {
      try {
        const element = locator.nth(idx);
        const result = await this.executeActionOnElement(step, element);
        results.push(result);
        if (result !== null && result !== undefined) {
          successCount++;
        }
      } catch (error: any) {
        errorCount++;
        if (!step.optional) {
          // Critical operation - fail immediately
          return {
            success: false,
            method: 'iteration',
            attempts: indices.length,
            duration: Date.now() - startTime,
            error: `Failed at index ${idx}: ${error.message}`,
            successCount,
            errorCount
          };
        }
        // Optional operation - continue
      }
    }

    // Return collected data for extraction operations
    const isExtraction = step.action === 'extract';
    return {
      success: true,
      method: 'iteration',
      attempts: indices.length,
      duration: Date.now() - startTime,
      data: isExtraction ? results.filter(r => r !== null) : { count: indices.length },
      partialSuccess: errorCount > 0,
      successCount,
      errorCount
    };
  }

  /**
   * Execute action on a single element
   */
  private async executeActionOnElement(step: any, element: Locator): Promise<any> {
    switch (step.action) {
      case 'click':
        await element.click({ timeout: 3000 });
        return null;

      case 'fill':
        await element.fill(step.value || '', { timeout: 3000 });
        return null;

      case 'extract':
        return await element.textContent({ timeout: 3000 });

      case 'scroll':
        await element.scrollIntoViewIfNeeded({ timeout: 3000 });
        return null;

      default:
        throw new Error(`Unknown action: ${step.action}`);
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
   * Enhanced with PageRank-based selector prioritization and multi-strategy fallback
   */
  private async suggestApproach(step: StrategicStep, snapshot: PageSnapshot, page: Page): Promise<TacticalApproach> {
    const prompt = this.buildTacticalPrompt(step, snapshot);

    try {
      const response = await this.llmStrategy.callLLM(prompt, {
        response_format: { type: 'json_object' },
        temperature: 0.2, // Low temperature for "obvious" answers
      });

      const parsed = JSON.parse(response);
      const llmSelectors = parsed.selectors || [];

      // MULTI-STRATEGY SELECTION: Choose best approach based on validation
      const approach = await this.selectBestStrategy(step, page, llmSelectors, parsed);

      return approach;
    } catch (error: any) {
      logger.error('LLM tactical suggestion failed', { error: error.message });

      // Fallback to heuristic approach with optional PageRank
      return this.heuristicApproach(step, snapshot, page);
    }
  }

  /**
   * Select best strategy: PageRank, LLM, Heuristic, or Hybrid
   * Uses validation to detect when PageRank might be confidently wrong
   */
  private async selectBestStrategy(
    step: StrategicStep,
    page: Page,
    llmSelectors: string[],
    llmResponse: any
  ): Promise<TacticalApproach> {
    let strategy: 'pagerank' | 'llm' | 'heuristic' | 'hybrid' = 'llm';
    let selectors = llmSelectors;
    let confidence = llmResponse.confidence || 0.5;
    let reasoning = llmResponse.reasoning || '';

    // Try PageRank if enabled
    if (this.usePageRank) {
      try {
        const ranked = await sublinearSolver.rankElementsWithPageRank(page, step.target);

        // VALIDATION: Check if PageRank is reliable
        let validation = { isValid: true, confidence: 0.8, shouldUseFallback: false, warnings: [] as string[] };

        if (this.enableValidation) {
          validation = pageRankValidator.validatePageRankResults(ranked, llmSelectors, step.target);

          logger.debug('PageRank validation result', {
            isValid: validation.isValid,
            confidence: validation.confidence,
            warnings: validation.warnings
          });
        }

        // Determine strategy based on validation
        const fallbackStrategy = pageRankValidator.selectFallbackStrategy(
          validation.isValid,
          validation.confidence,
          llmSelectors.length > 0
        );

        strategy = fallbackStrategy.strategy;
        confidence = fallbackStrategy.confidence;
        reasoning = `${reasoning} [${fallbackStrategy.reasoning}]`;

        logger.info('Strategy selected', {
          strategy,
          confidence,
          pageRankValid: validation.isValid,
          pageRankConfidence: validation.confidence
        });

        // Apply strategy
        switch (strategy) {
          case 'pagerank':
            // Use pure PageRank
            selectors = await this.optimizeSelectorsWithPageRank(llmSelectors, step, page);
            break;

          case 'hybrid':
            // Combine PageRank with LLM (interleave)
            selectors = await this.hybridStrategy(llmSelectors, ranked, step);
            break;

          case 'llm':
            // Use LLM selectors as-is
            selectors = llmSelectors;
            break;

          case 'heuristic':
            // Fall back to heuristics
            logger.warn('Falling back to heuristics due to low confidence');
            break;
        }

      } catch (error: any) {
        logger.error('PageRank strategy failed, using LLM', { error: error.message });
        strategy = 'llm';
        selectors = llmSelectors;
      }
    }

    return {
      method: `${strategy}_${llmResponse.method || 'unknown'}`,
      reasoning,
      selectors,
      confidence,
      estimatedTime: llmResponse.estimatedTime || 1000,
      fallbackStrategy: llmResponse.fallbackStrategy || 'investigate',
    };
  }

  /**
   * Hybrid strategy: Interleave PageRank and LLM suggestions
   * Example: [pagerank_top, llm_top, pagerank_2, llm_2, ...]
   */
  private async hybridStrategy(
    llmSelectors: string[],
    ranked: any[],
    step: StrategicStep
  ): Promise<string[]> {
    const pageRankSelectors = ranked.slice(0, 5).map(r => r.element.selector);
    const hybrid: string[] = [];
    const seen = new Set<string>();

    // Interleave (best of both worlds)
    const maxLen = Math.max(pageRankSelectors.length, llmSelectors.length);
    for (let i = 0; i < maxLen; i++) {
      // Add PageRank suggestion
      if (i < pageRankSelectors.length) {
        const sel = pageRankSelectors[i];
        if (!seen.has(sel)) {
          hybrid.push(sel);
          seen.add(sel);
        }
      }

      // Add LLM suggestion
      if (i < llmSelectors.length) {
        const sel = llmSelectors[i];
        if (!seen.has(sel)) {
          hybrid.push(sel);
          seen.add(sel);
        }
      }
    }

    logger.info('Hybrid strategy created', {
      pageRankCount: pageRankSelectors.length,
      llmCount: llmSelectors.length,
      hybridCount: hybrid.length
    });

    return hybrid;
  }

  /**
   * Optimize selector priority using PageRank
   * This is the KEY ENHANCEMENT - ranks selectors by element importance
   */
  private async optimizeSelectorsWithPageRank(
    selectors: string[],
    step: StrategicStep,
    page: Page
  ): Promise<string[]> {
    try {
      // Get top ranked elements for this goal
      const rankedElements = await sublinearSolver.rankElementsWithPageRank(page, step.target);

      if (rankedElements.length === 0) {
        logger.warn('No ranked elements found, using original selectors');
        return selectors;
      }

      // Map selectors to ranked elements
      const selectorScores = new Map<string, number>();

      for (const selector of selectors) {
        try {
          const matchingElement = rankedElements.find(re =>
            re.element.selector === selector ||
            re.element.text?.toLowerCase().includes(selector.toLowerCase())
          );

          if (matchingElement) {
            selectorScores.set(selector, matchingElement.rank);
          } else {
            selectorScores.set(selector, 0.1); // Low default score
          }
        } catch (error) {
          selectorScores.set(selector, 0.05); // Very low score for problematic selectors
        }
      }

      // Add top PageRank elements that might not be in original selectors
      const topElements = rankedElements.slice(0, 3);
      for (const elem of topElements) {
        if (!selectors.includes(elem.element.selector)) {
          selectors.push(elem.element.selector);
          selectorScores.set(elem.element.selector, elem.rank);
        }
      }

      // Sort selectors by PageRank score (descending)
      const sortedSelectors = selectors.sort((a, b) => {
        const scoreA = selectorScores.get(a) || 0;
        const scoreB = selectorScores.get(b) || 0;
        return scoreB - scoreA;
      });

      logger.info('PageRank selector optimization complete', {
        top3Selectors: sortedSelectors.slice(0, 3),
        top3Scores: sortedSelectors.slice(0, 3).map(s => selectorScores.get(s))
      });

      return sortedSelectors;
    } catch (error: any) {
      logger.error('PageRank optimization failed, using original selectors', {
        error: error.message
      });
      return selectors;
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
   * Enhanced with result tracking for adaptive learning
   */
  private async tryApproach(
    step: StrategicStep,
    approach: TacticalApproach,
    page: Page
  ): Promise<ExecutionResult> {
    let attempts = 0;
    const isPageRankStrategy = approach.method.includes('pagerank') || approach.method.includes('hybrid');

    for (const selector of approach.selectors) {
      attempts++;

      try {
        const result = await this.executeAction(step.action, selector, step.target, page);

        if (result.success) {
          logger.info('Tactical approach succeeded', {
            method: approach.method,
            selector,
            attempts,
            strategyUsed: isPageRankStrategy ? 'pagerank' : 'other'
          });

          // TRACKING: Record success for adaptive learning
          if (this.enableValidation && isPageRankStrategy) {
            pageRankValidator.recordResult(true, approach.confidence);
            logger.debug('PageRank success recorded', {
              confidence: approach.confidence,
              attempts
            });
          }

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
    logger.warn('All tactical approaches failed', {
      method: approach.method,
      attempts,
      selectorsCount: approach.selectors.length
    });

    // TRACKING: Record failure for adaptive learning
    if (this.enableValidation && isPageRankStrategy) {
      pageRankValidator.recordResult(false, approach.confidence);
      logger.debug('PageRank failure recorded', {
        confidence: approach.confidence,
        attempts
      });
    }

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
   * Enhanced with optional PageRank
   */
  private heuristicApproach(step: StrategicStep, snapshot: PageSnapshot, page?: Page): TacticalApproach {
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

    // If PageRank is enabled and page is available, optimize selectors
    if (this.usePageRank && page) {
      this.optimizeSelectorsWithPageRank(selectors, step, page).then(optimized => {
        selectors.splice(0, selectors.length, ...optimized);
      }).catch(err => {
        logger.debug('PageRank optimization in heuristic failed', { error: err.message });
      });
    }

    return {
      method: `heuristic_${step.action}`,
      reasoning: 'Fallback heuristic approach' + (this.usePageRank ? ' with PageRank' : ''),
      selectors,
      confidence: this.usePageRank ? 0.5 : 0.4,
      estimatedTime: 1000,
      fallbackStrategy: 'investigate',
    };
  }
}
