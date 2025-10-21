/**
 * Autonomous Flow Engine
 *
 * Main orchestrator for the 3-tier autonomous agent system.
 * Coordinates Strategic Planning → Tactical Execution → Adaptive Investigation
 */

import { Page } from 'playwright';
import { logger } from '../utils/logger.js';
import { StrategicPlanner } from './StrategicPlanner.js';
import { TacticalExecutor } from './TacticalExecutor.js';
import { AdaptiveInvestigator } from './AdaptiveInvestigator.js';
import {
  AutonomousResult,
  AutonomousExecutionOptions,
  StepResult,
  AutonomousExecutionError,
} from './types.js';

export class AutonomousFlowEngine {
  private planner: StrategicPlanner;
  private executor: TacticalExecutor;
  private investigator: AdaptiveInvestigator;

  constructor(llmStrategy: any) {
    this.planner = new StrategicPlanner(llmStrategy);
    this.executor = new TacticalExecutor(llmStrategy);
    this.investigator = new AdaptiveInvestigator(llmStrategy);
  }

  /**
   * Main entry point: Execute a natural language goal autonomously
   */
  async executeGoal(
    goal: string,
    page: Page,
    options: AutonomousExecutionOptions = {}
  ): Promise<AutonomousResult> {
    const startTime = Date.now();
    logger.info('Autonomous execution started', { goal, url: page.url() });

    const {
      maxRetries = 3,
      maxInvestigationDepth = 3,
      timeout = 60000,
      enableLearning = true,
      verbose = false,
    } = options;

    try {
      // TIER 1: Strategic Planning
      logger.info('=== TIER 1: Strategic Planning ===');
      const plan = await this.planner.planGoal(goal, page);

      if (verbose) {
        logger.info('Strategic plan created', {
          siteType: plan.siteType,
          steps: plan.steps.length,
          confidence: plan.confidence,
        });
      }

      // Execute each step
      const results: StepResult[] = [];

      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        const stepStartTime = Date.now();

        logger.info(`\n=== STEP ${i + 1}/${plan.steps.length}: ${step.action} "${step.target}" ===`);

        try {
          // TIER 2: Tactical Execution
          logger.info('=== TIER 2: Tactical Execution ===');
          const executionResult = await this.executor.executeStep(step, page);

          if (executionResult.success) {
            // Success! Record and move to next step
            logger.info('Step succeeded', {
              method: executionResult.method,
              selector: executionResult.selector,
            });

            results.push({
              step,
              executionResult,
              duration: Date.now() - stepStartTime,
            });

            // Small delay between steps to allow page to stabilize
            await page.waitForTimeout(500);
            continue;
          }

          // TIER 2 failed, try TIER 3
          logger.warn('Tactical execution failed, escalating to Tier 3');

          // TIER 3: Adaptive Investigation
          logger.info('=== TIER 3: Adaptive Investigation ===');
          const adaptiveResult = await this.investigator.adaptiveRetry(
            step,
            page,
            [executionResult.error || 'Unknown error']
          );

          if (adaptiveResult.success) {
            logger.info('Adaptive retry succeeded', {
              method: adaptiveResult.method,
              attempts: adaptiveResult.attempts,
            });

            results.push({
              step,
              executionResult: adaptiveResult,
              investigations: [], // TODO: Record investigations
              duration: Date.now() - stepStartTime,
            });
          } else {
            // Even adaptive retry failed
            logger.error('Step failed after adaptive retry');

            if (step.required) {
              // Required step failed - abort execution
              throw new AutonomousExecutionError(
                `Required step failed: ${step.action}`,
                step,
                this.investigator.getLearnings(),
                'The step is marked as required and could not be completed'
              );
            } else {
              // Optional step - skip and continue
              logger.warn('Skipping optional step');
              results.push({
                step,
                skipped: true,
                skipReason: adaptiveResult.error || 'Failed after retries',
                duration: Date.now() - stepStartTime,
              });
            }
          }
        } catch (error: any) {
          logger.error('Step execution error', { error: error.message });

          if (step.required) {
            throw error;
          } else {
            results.push({
              step,
              skipped: true,
              skipReason: error.message,
              duration: Date.now() - stepStartTime,
            });
          }
        }
      }

      // All steps complete - extract final data if needed
      const finalData = await this.extractFinalData(page, goal, plan.steps);

      const totalDuration = Date.now() - startTime;

      logger.info('🎉 Autonomous execution complete', {
        goal,
        totalSteps: plan.steps.length,
        successfulSteps: results.filter(r => r.executionResult?.success).length,
        skippedSteps: results.filter(r => r.skipped).length,
        duration: totalDuration,
      });

      return {
        goal,
        plan,
        results,
        finalData,
        totalDuration,
        success: results.some(r => r.executionResult?.success),
        learnings: enableLearning ? this.investigator.getLearnings() : undefined,
      };
    } catch (error: any) {
      logger.error('Autonomous execution failed', { error: error.message });

      // Return partial results if available
      return {
        goal,
        plan: error.context?.plan || { steps: [], siteType: 'unknown', confidence: 0 },
        results: [],
        totalDuration: Date.now() - startTime,
        success: false,
      };
    }
  }

  /**
   * Extract final data based on goal
   */
  private async extractFinalData(page: Page, goal: string, steps: any[]): Promise<any> {
    // Look for extract steps in the plan
    const extractSteps = steps.filter(s => s.action === 'extract');

    if (extractSteps.length === 0) {
      return null;
    }

    try {
      const data: any = {};

      for (const extractStep of extractSteps) {
        const target = extractStep.target.toLowerCase();

        if (target.includes('price')) {
          data.price = await this.extractPrice(page);
        }

        if (target.includes('title') || target.includes('product')) {
          data.product = await this.extractProductTitle(page);
        }

        data.url = page.url();
      }

      return Object.keys(data).length > 0 ? data : null;
    } catch (error: any) {
      logger.error('Failed to extract final data', { error: error.message });
      return null;
    }
  }

  /**
   * Extract price from current page
   */
  private async extractPrice(page: Page): Promise<string | null> {
    const priceSelectors = [
      '.a-price .a-offscreen',
      '.a-price-whole',
      '[data-price]',
      '.price',
      '*:has-text("$"):visible',
    ];

    for (const selector of priceSelectors) {
      try {
        const price = await page.textContent(selector, { timeout: 2000 });
        if (price && price.includes('$')) {
          return price.trim();
        }
      } catch (err) {
        continue;
      }
    }

    return null;
  }

  /**
   * Extract product title from current page
   */
  private async extractProductTitle(page: Page): Promise<string | null> {
    const titleSelectors = [
      '#productTitle',
      'h1',
      '[data-feature-name="title"]',
      '.product-title',
    ];

    for (const selector of titleSelectors) {
      try {
        const title = await page.textContent(selector, { timeout: 2000 });
        if (title) {
          return title.trim();
        }
      } catch (err) {
        continue;
      }
    }

    return page.title();
  }
}
