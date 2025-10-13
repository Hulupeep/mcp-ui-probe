import { Page, Response } from 'playwright';
import {
  ScenarioDefinition,
  ScenarioResult,
  ScenarioStepResult,
  ScenarioRunOptions,
  ClickAction,
  WaitForResponseAction,
  AssertTextAction
} from '../types/scenario.js';
import logger from '../utils/logger.js';

export class ScenarioExecutor {
  private page: Page;
  private options: ScenarioRunOptions;
  private startTime: number = 0;
  private responseWaiters: Map<string, { resolve: (r: Response) => void; reject: (e: Error) => void }> = new Map();

  constructor(page: Page, options: ScenarioRunOptions = {}) {
    this.page = page;
    this.options = {
      timeout: 30000,
      retries: 1,
      captureScreenshotOnError: true,
      headless: true,
      llm: 'none',
      forceSelectors: true,
      ...options
    };
  }

  /**
   * Execute a complete scenario
   */
  async execute(scenario: ScenarioDefinition): Promise<ScenarioResult> {
    this.startTime = Date.now();
    const steps: ScenarioStepResult[] = [];

    try {
      logger.info('Starting scenario execution', { scenario: scenario.name });

      // Apply scenario-level options
      const effectiveTimeout = scenario.timeout || this.options.timeout || 30000;
      const effectiveRetries = scenario.retries || this.options.retries || 1;

      // Setup phase
      if (scenario.setup) {
        for (const setup of scenario.setup) {
          if (setup.setGlobal) {
            await this.setGlobalVariables(setup.setGlobal);
          }
          if (setup.navigate) {
            await this.page.goto(setup.navigate, {
              waitUntil: setup.waitForLoad ? 'networkidle' : 'domcontentloaded',
              timeout: effectiveTimeout
            });
          }
        }
      }

      // Navigate to base URL if not already done
      const baseUrl = this.options.baseUrl || scenario.baseUrl;
      if (!scenario.setup?.some(s => s.navigate)) {
        await this.page.goto(baseUrl, {
          waitUntil: 'domcontentloaded',
          timeout: effectiveTimeout
        });
      }

      // Execute steps
      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        const stepStart = Date.now();

        try {
          logger.debug(`Executing step ${i + 1}/${scenario.steps.length}`, { step });

          const result = await this.executeStepWithRetry(step, effectiveRetries, effectiveTimeout);

          steps.push({
            ...result,
            duration: Date.now() - stepStart
          });

          if (result.status === 'fail') {
            throw new Error(result.error || 'Step failed');
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Step ${i + 1} failed`, { error: errorMessage });

          steps.push({
            step: this.getStepName(step),
            status: 'fail',
            duration: Date.now() - stepStart,
            error: errorMessage
          });

          // Capture screenshot on error
          let screenshot: string | undefined;
          if (scenario.captureScreenshotOnError || this.options.captureScreenshotOnError) {
            try {
              const buffer = await this.page.screenshot({ fullPage: false });
              screenshot = buffer.toString('base64');
            } catch (screenshotError) {
              logger.warn('Failed to capture error screenshot', { error: screenshotError });
            }
          }

          return {
            scenario: scenario.name,
            status: 'fail',
            duration: Date.now() - this.startTime,
            steps,
            error: {
              step: i + 1,
              action: this.getStepName(step),
              reason: errorMessage,
              screenshot
            }
          };
        }
      }

      logger.info('Scenario completed successfully', { scenario: scenario.name });

      return {
        scenario: scenario.name,
        status: 'pass',
        duration: Date.now() - this.startTime,
        steps
      };

    } catch (error) {
      logger.error('Scenario execution failed', { scenario: scenario.name, error });

      return {
        scenario: scenario.name,
        status: 'fail',
        duration: Date.now() - this.startTime,
        steps,
        error: {
          step: 0,
          action: 'setup',
          reason: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Execute a single step with retry logic
   */
  private async executeStepWithRetry(
    step: any,
    retries: number,
    timeout: number
  ): Promise<ScenarioStepResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          logger.debug(`Retrying step (attempt ${attempt + 1}/${retries + 1})`);
          await this.page.waitForTimeout(1000 * Math.pow(2, attempt - 1)); // Exponential backoff
        }

        return await this.executeStep(step, timeout);
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Step attempt ${attempt + 1} failed`, { error: lastError.message });
      }
    }

    throw lastError || new Error('Step failed after all retries');
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: any, timeout: number): Promise<ScenarioStepResult> {
    // Click action
    if (step.click) {
      return await this.executeClick(step.click, timeout);
    }

    // Wait for response
    if (step.waitForResponse) {
      return await this.executeWaitForResponse(step.waitForResponse);
    }

    // Assert text
    if (step.assertText) {
      return await this.executeAssertText(step.assertText, timeout);
    }

    // Download
    if (step.download) {
      return await this.executeDownload(step.download, timeout);
    }

    // Wait for selector
    if (step.waitForSelector) {
      return await this.executeWaitForSelector(step.waitForSelector, timeout);
    }

    // Type
    if (step.type) {
      return await this.executeType(step.type, timeout);
    }

    // Wait
    if (step.wait) {
      await this.page.waitForTimeout(step.wait);
      return {
        step: 'wait',
        status: 'pass'
      };
    }

    // Screenshot
    if (step.screenshot) {
      await this.page.screenshot({ path: step.screenshot, fullPage: true });
      return {
        step: 'screenshot',
        status: 'pass'
      };
    }

    throw new Error('Unknown step type');
  }

  /**
   * Execute click action
   */
  private async executeClick(action: ClickAction, timeout: number): Promise<ScenarioStepResult> {
    const selector = this.buildSelector(action);
    logger.debug('Executing click', { selector });

    const element = this.page.locator(selector).first();
    await element.waitFor({ state: 'visible', timeout });
    await element.click({ timeout });

    return {
      step: 'click',
      selector,
      status: 'pass'
    };
  }

  /**
   * Execute wait for response action
   */
  private async executeWaitForResponse(action: WaitForResponseAction): Promise<ScenarioStepResult> {
    const timeout = action.timeoutMs || 10000;
    const method = action.method || 'POST';

    logger.debug('Waiting for response', { url: action.url, method, timeout });

    const response = await this.page.waitForResponse(
      (response) => {
        const matchesUrl = response.url().includes(action.url);
        const matchesMethod = response.request().method() === method;
        const matchesStatus = action.status ? response.status() === action.status : true;
        return matchesUrl && matchesMethod && matchesStatus;
      },
      { timeout }
    );

    return {
      step: 'waitForResponse',
      selector: `${method} ${action.url}`,
      status: 'pass'
    };
  }

  /**
   * Execute assert text action
   */
  private async executeAssertText(action: AssertTextAction, timeout: number): Promise<ScenarioStepResult> {
    const selector = this.buildSelector(action);
    logger.debug('Asserting text', { selector, action });

    const element = this.page.locator(selector).first();
    await element.waitFor({ state: 'visible', timeout });

    const text = await element.textContent();
    const actualText = text?.trim() || '';

    let matches = false;
    if (action.contains) {
      matches = actualText.includes(action.contains);
    } else if (action.equals) {
      matches = actualText === action.equals;
    } else if (action.matches) {
      matches = new RegExp(action.matches).test(actualText);
    }

    if (!matches) {
      throw new Error(
        `Text assertion failed. Expected: ${JSON.stringify(action)}, Actual: "${actualText}"`
      );
    }

    return {
      step: 'assertText',
      selector,
      status: 'pass'
    };
  }

  /**
   * Execute download action
   */
  private async executeDownload(action: any, timeout: number): Promise<ScenarioStepResult> {
    const selector = this.buildSelector(action);
    logger.debug('Executing download', { selector });

    const downloadPromise = this.page.waitForEvent('download', { timeout });

    const element = this.page.locator(selector).first();
    await element.click({ timeout });

    const download = await downloadPromise;

    if (action.saveAs) {
      await download.saveAs(action.saveAs);
    }

    return {
      step: 'download',
      selector,
      status: 'pass'
    };
  }

  /**
   * Execute wait for selector action
   */
  private async executeWaitForSelector(action: any, timeout: number): Promise<ScenarioStepResult> {
    const selector = this.buildSelector(action);
    const effectiveTimeout = action.timeoutMs || timeout;
    const state = action.state || 'visible';

    logger.debug('Waiting for selector', { selector, state, timeout: effectiveTimeout });

    await this.page.locator(selector).first().waitFor({
      state: state as any,
      timeout: effectiveTimeout
    });

    return {
      step: 'waitForSelector',
      selector,
      status: 'pass'
    };
  }

  /**
   * Execute type action
   */
  private async executeType(action: any, timeout: number): Promise<ScenarioStepResult> {
    const selector = this.buildSelector(action);
    logger.debug('Executing type', { selector, text: action.text });

    const element = this.page.locator(selector).first();
    await element.waitFor({ state: 'visible', timeout });
    await element.fill(action.text);

    if (action.delay) {
      await this.page.waitForTimeout(action.delay);
    }

    return {
      step: 'type',
      selector,
      status: 'pass'
    };
  }

  /**
   * Build Playwright selector from action
   */
  private buildSelector(action: any): string {
    // Priority: testId > role+name > selector > text
    if (action.testId) {
      return `[data-testid="${action.testId}"]`;
    }

    if (action.role && action.name) {
      return `${action.role}[name="${action.name}"]`;
    }

    if (action.role) {
      return action.role;
    }

    if (action.selector) {
      return action.selector;
    }

    if (action.text) {
      return `text="${action.text}"`;
    }

    throw new Error('No valid selector provided in action');
  }

  /**
   * Set global variables on the page
   */
  private async setGlobalVariables(globals: Record<string, any>): Promise<void> {
    await this.page.evaluate((vars) => {
      Object.assign(window, vars);
    }, globals);
  }

  /**
   * Get human-readable step name
   */
  private getStepName(step: any): string {
    const actions = Object.keys(step).filter(k => k !== 'screenshot' && k !== 'wait');
    return actions[0] || 'unknown';
  }
}
