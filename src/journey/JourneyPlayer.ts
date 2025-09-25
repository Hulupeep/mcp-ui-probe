import { Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import {
  Journey,
  JourneyStep,
  JourneyExecutionResult,
  PlaybackConfig,
  ContextValidationResult,
  JourneyEvent
} from '../types/journey.js';
import { JourneyValidator } from './JourneyValidator.js';
import { JourneyStorage } from './JourneyStorage.js';
import { smartFieldResolver } from '../utils/smartFieldResolver.js';
import { checkboxResolver } from '../utils/checkboxResolver.js';
import { SelectorError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { EventEmitter } from 'events';

export class JourneyPlayer extends EventEmitter {
  private isPlaying = false;
  private isPaused = false;
  private currentExecution: Partial<JourneyExecutionResult> | null = null;
  private config: PlaybackConfig;
  private validator: JourneyValidator;
  private storage: JourneyStorage;
  private abortController: AbortController | null = null;

  constructor(config: PlaybackConfig, validator: JourneyValidator, storage: JourneyStorage) {
    super();
    this.config = config;
    this.validator = validator;
    this.storage = storage;
  }

  async playJourney(
    page: Page,
    journeyOrId: Journey | string,
    customConfig?: Partial<PlaybackConfig>
  ): Promise<JourneyExecutionResult> {
    // Load journey if ID provided
    const journey = typeof journeyOrId === 'string'
      ? await this.storage.loadJourney(journeyOrId)
      : journeyOrId;

    if (!journey) {
      throw new Error(`Journey not found: ${journeyOrId}`);
    }

    // Merge config
    const playbackConfig = { ...this.config, ...customConfig };

    // Initialize execution
    const executionId = uuidv4();
    const startTime = new Date();

    this.currentExecution = {
      journeyId: journey.id,
      executionId,
      startTime: startTime.toISOString(),
      success: false,
      completedSteps: 0,
      totalSteps: journey.steps.length,
      errors: [],
      warnings: [],
      screenshots: [],
      finalUrl: page.url()
    };

    this.isPlaying = true;
    this.isPaused = false;
    this.abortController = new AbortController();

    logger.info('Starting journey playback', {
      journeyId: journey.id,
      journeyName: journey.name,
      executionId,
      totalSteps: journey.steps.length
    });

    this.emit('playback_started', {
      type: 'playback_started',
      journeyId: journey.id,
      executionId,
      data: { journey, config: playbackConfig },
      timestamp: startTime.toISOString()
    } as any);

    try {
      // Validate starting context if enabled
      if (playbackConfig.validateContext) {
        await this.validateAndPrepareContext(page, journey);
      }

      // Execute journey steps
      await this.executeSteps(page, journey, playbackConfig);

      // Mark as successful
      this.currentExecution.success = true;

      logger.info('Journey playback completed successfully', {
        journeyId: journey.id,
        executionId,
        completedSteps: this.currentExecution.completedSteps
      });

    } catch (error) {
      this.currentExecution.success = false;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.currentExecution.errors!.push({
        stepId: 'execution',
        error: errorMessage,
        context: { phase: 'journey_execution' }
      });

      logger.error('Journey playback failed', {
        journeyId: journey.id,
        executionId,
        error: errorMessage,
        completedSteps: this.currentExecution.completedSteps
      });

      // Take failure screenshot if enabled
      if (playbackConfig.screenshotOnFailure) {
        try {
          const screenshotPath = await this.takeScreenshot(page, 'failure');
          if (screenshotPath) {
            this.currentExecution.screenshots!.push(screenshotPath);
          }
        } catch (screenshotError) {
          logger.warn('Failed to take failure screenshot', { screenshotError });
        }
      }

      if (!playbackConfig.continueOnNonCriticalErrors) {
        throw error;
      }
    } finally {
      // Finalize execution result
      const endTime = new Date();
      const result: JourneyExecutionResult = {
        ...this.currentExecution,
        endTime: endTime.toISOString(),
        durationMs: endTime.getTime() - startTime.getTime(),
        finalUrl: page.url()
      } as JourneyExecutionResult;

      // Update journey usage statistics
      await this.updateJourneyStats(journey, result.success);

      this.emit('playback_completed', {
        type: 'playback_completed',
        journeyId: journey.id,
        executionId,
        data: result,
        timestamp: endTime.toISOString()
      } as any);

      // Clean up
      this.isPlaying = false;
      this.isPaused = false;
      this.currentExecution = null;
      this.abortController = null;

      return result;
    }
  }

  async pausePlayback(): Promise<void> {
    if (!this.isPlaying || this.isPaused) {
      throw new Error('No active playback to pause');
    }

    this.isPaused = true;
    logger.info('Journey playback paused', {
      executionId: this.currentExecution?.executionId
    });

    this.emit('playback_paused', {
      type: 'journey_paused',
      journeyId: this.currentExecution?.journeyId || '',
      executionId: this.currentExecution?.executionId,
      timestamp: new Date().toISOString()
    } as any);
  }

  async resumePlayback(): Promise<void> {
    if (!this.isPlaying || !this.isPaused) {
      throw new Error('No paused playback to resume');
    }

    this.isPaused = false;
    logger.info('Journey playback resumed', {
      executionId: this.currentExecution?.executionId
    });

    this.emit('playback_resumed', {
      type: 'journey_resumed',
      journeyId: this.currentExecution?.journeyId || '',
      executionId: this.currentExecution?.executionId,
      timestamp: new Date().toISOString()
    } as any);
  }

  async stopPlayback(): Promise<void> {
    if (!this.isPlaying) {
      throw new Error('No active playback to stop');
    }

    if (this.abortController) {
      this.abortController.abort();
    }

    this.isPlaying = false;
    this.isPaused = false;

    logger.info('Journey playback stopped', {
      executionId: this.currentExecution?.executionId
    });

    this.emit('playback_stopped', {
      type: 'journey_completed',
      journeyId: this.currentExecution?.journeyId || '',
      executionId: this.currentExecution?.executionId,
      timestamp: new Date().toISOString()
    } as any);
  }

  private async validateAndPrepareContext(page: Page, journey: Journey): Promise<void> {
    logger.info('Validating journey context', {
      journeyId: journey.id,
      currentUrl: page.url(),
      expectedPattern: journey.startingContext.urlPattern
    });

    const validation = await this.validator.validateContext(page, journey.startingContext);

    if (!validation.isValid) {
      // Try to navigate to expected URL if current URL doesn't match
      if (validation.urlMismatch && journey.startingContext.exactUrl) {
        logger.info('URL mismatch detected, attempting navigation', {
          currentUrl: page.url(),
          expectedUrl: journey.startingContext.exactUrl
        });

        await page.goto(journey.startingContext.exactUrl, {
          waitUntil: 'domcontentloaded',
          timeout: this.config.timeoutMs
        });

        // Re-validate after navigation
        const revalidation = await this.validator.validateContext(page, journey.startingContext);
        if (!revalidation.isValid) {
          throw new Error(`Context validation failed after navigation: ${revalidation.stateIssues.join(', ')}`);
        }
      } else {
        // Context validation failed
        const errorMessage = `Context validation failed: ${validation.stateIssues.join(', ')}`;

        if (validation.suggestions.length > 0) {
          this.currentExecution!.warnings!.push(`Validation issues found. Suggestions: ${validation.suggestions.join(', ')}`);
        }

        if (validation.alternativeJourneys.length > 0) {
          this.currentExecution!.warnings!.push(`Alternative journeys available: ${validation.alternativeJourneys.join(', ')}`);
        }

        throw new Error(errorMessage);
      }
    }

    this.currentExecution!.contextValidation = {
      passed: validation.isValid,
      details: validation
    };
  }

  private async executeSteps(page: Page, journey: Journey, config: PlaybackConfig): Promise<void> {
    for (let i = 0; i < journey.steps.length; i++) {
      // Check for abort signal
      if (this.abortController?.signal.aborted) {
        throw new Error('Journey playback was aborted');
      }

      // Wait if paused
      while (this.isPaused && !this.abortController?.signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const step = journey.steps[i];
      const stepNumber = i + 1;

      logger.debug('Executing journey step', {
        stepId: step.id,
        stepNumber,
        action: step.action,
        description: step.description
      });

      this.emit('step_started', {
        type: 'step_started',
        journeyId: journey.id,
        executionId: this.currentExecution!.executionId,
        stepId: step.id,
        data: { step, stepNumber, totalSteps: journey.steps.length },
        timestamp: new Date().toISOString()
      } as any);

      try {
        await this.executeStep(page, step, config);
        this.currentExecution!.completedSteps = stepNumber;

        this.emit('step_completed', {
          type: 'step_completed',
          journeyId: journey.id,
          executionId: this.currentExecution!.executionId,
          stepId: step.id,
          data: { success: true, stepNumber },
          timestamp: new Date().toISOString()
        } as any);

        logger.debug('Journey step completed successfully', {
          stepId: step.id,
          stepNumber
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        this.currentExecution!.errors!.push({
          stepId: step.id,
          error: errorMessage,
          context: { stepNumber, action: step.action, selector: step.selector }
        });

        this.emit('step_failed', {
          type: 'step_failed',
          journeyId: journey.id,
          executionId: this.currentExecution!.executionId,
          stepId: step.id,
          data: { error: errorMessage, stepNumber },
          timestamp: new Date().toISOString()
        } as any);

        logger.error('Journey step failed', {
          stepId: step.id,
          stepNumber,
          error: errorMessage
        });

        // Decide whether to continue or abort
        if (config.pauseOnError) {
          throw new Error(`Step ${stepNumber} failed: ${errorMessage}`);
        }

        if (!config.continueOnNonCriticalErrors) {
          throw error;
        }

        // Add warning and continue
        this.currentExecution!.warnings!.push(`Step ${stepNumber} failed but continuing: ${errorMessage}`);
      }

      // Apply speed control (delay between steps)
      if (step.waitAfter || config.speed !== 1.0) {
        const delay = (step.waitAfter || 500) / config.speed;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private async executeStep(page: Page, step: JourneyStep, config: PlaybackConfig): Promise<void> {
    let retryCount = 0;
    const maxRetries = config.maxRetries;

    while (retryCount <= maxRetries) {
      try {
        await this.performStepAction(page, step);
        return; // Success, exit retry loop
      } catch (error) {
        retryCount++;

        if (retryCount > maxRetries) {
          throw error; // Max retries exceeded
        }

        logger.warn(`Step execution failed, retrying (${retryCount}/${maxRetries})`, {
          stepId: step.id,
          error: error instanceof Error ? error.message : String(error)
        });

        // Try fallback strategies if available
        if (retryCount === maxRetries && step.selector) {
          const fallbackSuccess = await this.tryFallbackStrategies(page, step);
          if (fallbackSuccess) {
            return;
          }
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }

  private async performStepAction(page: Page, step: JourneyStep): Promise<void> {
    switch (step.action) {
      case 'navigate':
        if (step.url) {
          await page.goto(step.url, {
            waitUntil: 'domcontentloaded',
            timeout: this.config.timeoutMs
          });
        }
        break;

      case 'click':
        if (step.selector) {
          const element = await this.findElementWithRetry(page, step.selector);
          await element.click({ timeout: this.config.timeoutMs });
        }
        break;

      case 'fill':
        if (step.selector && step.value !== undefined) {
          const element = await this.findElementWithRetry(page, step.selector);
          await element.clear();
          await element.fill(String(step.value));
        }
        break;

      case 'select':
        if (step.selector && step.value !== undefined) {
          await this.handleSelectStep(page, step);
        }
        break;

      case 'wait':
        const waitTime = typeof step.value === 'number' ? step.value : (step.waitAfter || 1000);
        await page.waitForTimeout(waitTime);
        break;

      case 'assert':
        await this.handleAssertStep(page, step);
        break;

      case 'upload':
        await this.handleUploadStep(page, step);
        break;

      case 'drag_drop':
        await this.handleDragDropStep(page, step);
        break;

      default:
        throw new Error(`Unsupported action: ${step.action}`);
    }
  }

  private async findElementWithRetry(page: Page, selector: string, maxRetries = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const element = page.locator(selector).first();
        await element.waitFor({ state: 'visible', timeout: 5000 });
        return element;
      } catch (error) {
        if (attempt === maxRetries) {
          throw new SelectorError(`Element not found after ${maxRetries} attempts: ${selector}`);
        }
        await page.waitForTimeout(1000 * attempt);
      }
    }
  }

  private async handleSelectStep(page: Page, step: JourneyStep): Promise<void> {
    if (!step.selector || step.value === undefined) return;

    const element = await this.findElementWithRetry(page, step.selector);
    const tagName = await element.evaluate((el: HTMLElement) => el.tagName.toLowerCase());

    if (tagName === 'select') {
      // Native select element
      await element.selectOption(String(step.value));
    } else {
      // Custom dropdown - use smart field resolver
      const fieldName = step.metadata?.name || 'dropdown';
      const resolvedValue = await smartFieldResolver.resolveSelectOption(page, fieldName, String(step.value));

      if (resolvedValue) {
        await element.selectOption(resolvedValue);
      } else {
        // Fallback to custom dropdown handling
        await this.handleCustomDropdown(page, element, String(step.value));
      }
    }
  }

  private async handleCustomDropdown(page: Page, element: any, value: string): Promise<void> {
    // Click to open dropdown
    await element.click();
    await page.waitForTimeout(500);

    // Look for options
    const optionSelectors = [
      `[role="option"]:has-text("${value}")`,
      `.dropdown-item:has-text("${value}")`,
      `.select-option:has-text("${value}")`,
      `li:has-text("${value}")`,
      `[data-value="${value}"]`
    ];

    for (const selector of optionSelectors) {
      try {
        const option = page.locator(selector).first();
        if (await option.isVisible({ timeout: 1000 })) {
          await option.click();
          return;
        }
      } catch {
        // Continue to next selector
      }
    }

    // Fallback: type and select
    await page.keyboard.type(value);
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
  }

  private async handleAssertStep(page: Page, step: JourneyStep): Promise<void> {
    if (!step.selector) {
      throw new Error('Assert step requires a selector');
    }

    const element = page.locator(step.selector).first();
    const exists = await element.count() > 0;

    if (step.metadata?.exists === false && exists) {
      throw new Error(`Element should not exist: ${step.selector}`);
    }

    if (step.metadata?.exists !== false && !exists) {
      throw new Error(`Element should exist: ${step.selector}`);
    }

    if (step.metadata?.visible !== undefined && exists) {
      const isVisible = await element.isVisible();
      if (isVisible !== step.metadata.visible) {
        throw new Error(`Element visibility mismatch: ${step.selector} (expected: ${step.metadata.visible})`);
      }
    }

    if (step.metadata?.text && exists) {
      const text = await element.textContent();
      if (!text || !text.includes(String(step.metadata.text))) {
        throw new Error(`Text assertion failed: ${step.selector} (expected: "${step.metadata.text}", actual: "${text}")`);
      }
    }
  }

  private async handleUploadStep(page: Page, step: JourneyStep): Promise<void> {
    if (!step.selector || !step.value) return;

    const element = await this.findElementWithRetry(page, step.selector);
    const filePaths = Array.isArray(step.value) ? step.value : [step.value];

    await element.setInputFiles(filePaths);
  }

  private async handleDragDropStep(page: Page, step: JourneyStep): Promise<void> {
    if (!step.selector || !step.metadata?.target) return;

    const source = await this.findElementWithRetry(page, step.selector);
    const target = await this.findElementWithRetry(page, step.metadata.target);

    await source.dragTo(target);
  }

  private async tryFallbackStrategies(page: Page, step: JourneyStep): Promise<boolean> {
    if (!step.selector) return false;

    logger.info('Trying fallback strategies', { stepId: step.id, originalSelector: step.selector });

    // Try alternative selectors based on element type
    const alternatives = this.generateAlternativeSelectors(step.selector);

    for (const altSelector of alternatives) {
      try {
        const element = page.locator(altSelector).first();
        if (await element.count() > 0 && await element.isVisible({ timeout: 1000 })) {
          logger.info('Fallback selector successful', {
            stepId: step.id,
            original: step.selector,
            alternative: altSelector
          });

          // Update step selector temporarily and retry
          const originalSelector = step.selector;
          step.selector = altSelector;

          await this.performStepAction(page, step);

          step.selector = originalSelector; // Restore original
          return true;
        }
      } catch {
        // Continue to next alternative
      }
    }

    return false;
  }

  private generateAlternativeSelectors(originalSelector: string): string[] {
    const alternatives: string[] = [];

    // Extract meaningful parts from selector
    const parts = originalSelector.match(/[#.]?[\w-]+/g) || [];

    // Generate alternatives
    alternatives.push(
      // Data attribute variations
      `[data-testid*="${parts.join('').replace(/[#.]/g, '')}"]`,
      `[data-test*="${parts.join('').replace(/[#.]/g, '')}"]`,
      `[data-cy*="${parts.join('').replace(/[#.]/g, '')}"]`,

      // Name and ID variations
      `[name*="${parts.join('').replace(/[#.]/g, '')}"]`,
      `[id*="${parts.join('').replace(/[#.]/g, '')}"]`,

      // ARIA and accessibility attributes
      `[aria-label*="${parts.join('').replace(/[#.]/g, '')}"]`,
      `[role="button"]:has-text("${parts.join('').replace(/[#.]/g, '')}")`,

      // Generic element type selectors
      'button',
      'input',
      'select',
      'textarea',
      'a'
    );

    return alternatives.filter(alt => alt !== originalSelector);
  }

  private async takeScreenshot(page: Page, label: string): Promise<string | null> {
    try {
      const filename = `journey_${this.currentExecution?.journeyId}_${this.currentExecution?.executionId}_${label}_${Date.now()}.png`;
      const screenshotPath = `/tmp/claude/${filename}`;

      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });

      return screenshotPath;
    } catch (error) {
      logger.warn('Failed to take screenshot', { label, error });
      return null;
    }
  }

  private async updateJourneyStats(journey: Journey, success: boolean): Promise<void> {
    try {
      // Update usage count
      journey.metadata.usageCount += 1;
      journey.metadata.lastUsed = new Date().toISOString();

      // Update success rate
      const totalExecutions = journey.metadata.usageCount;
      const currentSuccessRate = journey.metadata.successRate;
      const previousSuccesses = Math.round(currentSuccessRate * (totalExecutions - 1));
      const newSuccesses = previousSuccesses + (success ? 1 : 0);
      journey.metadata.successRate = newSuccesses / totalExecutions;

      // Update average duration if we have timing data
      if (this.currentExecution?.durationMs) {
        const currentAvg = journey.metadata.avgDurationMs;
        const newAvg = ((currentAvg * (totalExecutions - 1)) + this.currentExecution.durationMs) / totalExecutions;
        journey.metadata.avgDurationMs = Math.round(newAvg);
      }

      // Save updated journey
      await this.storage.saveJourney(journey);

      logger.debug('Journey statistics updated', {
        journeyId: journey.id,
        usageCount: journey.metadata.usageCount,
        successRate: journey.metadata.successRate,
        success
      });

    } catch (error) {
      logger.warn('Failed to update journey statistics', {
        journeyId: journey.id,
        error
      });
    }
  }

  // Public getters for status
  get playbackStatus(): {
    isPlaying: boolean;
    isPaused: boolean;
    executionId?: string;
    journeyId?: string;
    completedSteps: number;
    totalSteps: number;
  } {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      executionId: this.currentExecution?.executionId,
      journeyId: this.currentExecution?.journeyId,
      completedSteps: this.currentExecution?.completedSteps || 0,
      totalSteps: this.currentExecution?.totalSteps || 0
    };
  }

  // Method to get current execution details
  getCurrentExecution(): Partial<JourneyExecutionResult> | null {
    return this.currentExecution ? { ...this.currentExecution } : null;
  }
}