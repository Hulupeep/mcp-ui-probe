import { Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { TestRun, TestStep, TestError, Form, FormField } from '../types/index.js';
import { dataSynthesizer } from '../utils/dataSynthesizer.js';
import { SelectorError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export class FlowEngine {
  private errors: TestError[] = [];
  private steps: TestStep[] = [];
  private startTime: number = 0;
  private screenshots: string[] = [];

  async executeFlow(
    page: Page,
    form: Form,
    overrides?: Record<string, any>
  ): Promise<TestRun> {
    this.startTime = Date.now();
    this.errors = [];
    this.steps = [];
    this.screenshots = [];

    const runId = uuidv4();

    try {
      logger.info('Starting flow execution', {
        runId,
        formName: form.name,
        fieldsCount: form.fields.length
      });

      // Take initial screenshot
      await this.takeScreenshot(page, 'initial');

      // Fill form fields
      for (const field of form.fields) {
        await this.fillField(page, field, overrides);
      }

      // Submit form
      await this.submitForm(page, form);

      // Wait for response and check for errors
      await this.waitForResponse(page);

      // Collect any validation errors
      await this.collectValidationErrors(page);

      // Take final screenshot
      await this.takeScreenshot(page, 'final');

      const result = this.determineResult();

      const testRun: TestRun = {
        runId,
        target: {
          url: page.url(),
          viewport: '1280x800',
          userAgent: await page.evaluate(() => navigator.userAgent)
        },
        flow: this.steps,
        findings: {
          forms: [form],
          accessibility: {
            axeViolations: 0,
            details: []
          }
        },
        errors: this.errors,
        result,
        metrics: {
          totalTimeMs: Date.now() - this.startTime,
          steps: this.steps.length,
          networkErrors: this.errors.filter(e => e.type === 'network').length,
          consoleErrors: this.errors.filter(e => e.type === 'console').length
        }
      };

      logger.info('Flow execution completed', {
        runId,
        result,
        totalTime: testRun.metrics.totalTimeMs,
        errorsCount: this.errors.length
      });

      return testRun;

    } catch (error) {
      logger.error('Flow execution failed', { runId, error });

      // Add the error to our collection
      this.errors.push({
        type: 'timeout',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'E_FLOW_EXECUTION',
        timestamp: new Date().toISOString()
      });

      // Return failed test run
      return {
        runId,
        target: {
          url: page.url(),
          viewport: '1280x800',
          userAgent: await page.evaluate(() => navigator.userAgent).catch(() => 'unknown')
        },
        flow: this.steps,
        findings: {
          forms: [form],
          accessibility: {
            axeViolations: 0,
            details: []
          }
        },
        errors: this.errors,
        result: 'failed',
        metrics: {
          totalTimeMs: Date.now() - this.startTime,
          steps: this.steps.length,
          networkErrors: this.errors.filter(e => e.type === 'network').length,
          consoleErrors: this.errors.filter(e => e.type === 'console').length
        }
      };
    }
  }

  private async fillField(page: Page, field: FormField, overrides?: Record<string, any>): Promise<void> {
    const stepId = uuidv4();
    const stepStart = Date.now();

    try {
      logger.info('Filling field', { fieldName: field.name, fieldType: field.type });

      // Generate field data
      const value = dataSynthesizer.generateFieldData(field, overrides);

      // Find element with retries and self-healing
      const element = await this.findElementWithRetry(page, field.selector);

      if (!element) {
        throw new SelectorError(`Element not found: ${field.selector}`);
      }

      // Handle different input types
      await this.inputValue(page, element, field, value);

      // Record successful step
      this.steps.push({
        stepId,
        action: 'fill',
        selector: field.selector,
        inferredIntent: `Fill ${field.name} field`,
        input: { [field.name]: field.type === 'password' ? '[REDACTED]' : value },
        outcome: 'success',
        latencyMs: Date.now() - stepStart,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to fill field', {
        fieldName: field.name,
        selector: field.selector,
        error
      });

      this.steps.push({
        stepId,
        action: 'fill',
        selector: field.selector,
        inferredIntent: `Fill ${field.name} field`,
        outcome: 'fail',
        latencyMs: Date.now() - stepStart,
        timestamp: new Date().toISOString()
      });

      this.errors.push({
        type: 'validation',
        selector: field.selector,
        message: error instanceof Error ? error.message : 'Failed to fill field',
        code: 'E_FIELD_FILL',
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  private async findElementWithRetry(page: Page, selector: string, maxRetries: number = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Try original selector
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          return element;
        }
      } catch (error) {
        logger.warn(`Selector attempt ${attempt} failed`, { selector, error });
      }

      // Try self-healing selectors
      if (attempt < maxRetries) {
        const healedSelector = await this.selfHealSelector(page, selector);
        if (healedSelector && healedSelector !== selector) {
          try {
            const element = await page.locator(healedSelector).first();
            if (await element.isVisible({ timeout: 2000 })) {
              logger.info('Self-healed selector successful', {
                original: selector,
                healed: healedSelector
              });
              return element;
            }
          } catch (healError) {
            logger.warn('Self-healed selector failed', { healedSelector, healError });
          }
        }
      }

      if (attempt < maxRetries) {
        await page.waitForTimeout(1000);
      }
    }

    return null;
  }

  private async selfHealSelector(page: Page, originalSelector: string): Promise<string | null> {
    try {
      // Extract potential identifiers from the original selector
      const selectorParts = originalSelector.match(/[#.]?[\w-]+/g) || [];

      // Try common alternative selector patterns
      const alternatives = [
        // Try with data-test attributes
        `[data-test*="${selectorParts.join('').replace(/[#.]/g, '')}"]`,
        // Try with data-testid
        `[data-testid*="${selectorParts.join('').replace(/[#.]/g, '')}"]`,
        // Try with name attribute
        `[name*="${selectorParts.join('').replace(/[#.]/g, '')}"]`,
        // Try with aria-label
        `[aria-label*="${selectorParts.join('').replace(/[#.]/g, '')}"]`
      ];

      for (const alternative of alternatives) {
        try {
          const element = await page.locator(alternative).first();
          if (await element.isVisible({ timeout: 1000 })) {
            return alternative;
          }
        } catch (error) {
          // Continue to next alternative
        }
      }

      return null;
    } catch (error) {
      logger.warn('Self-healing failed', { originalSelector, error });
      return null;
    }
  }

  private async handleCustomDropdown(page: Page, element: any, field: FormField, value: any): Promise<void> {
    try {
      logger.info('Handling custom dropdown', { fieldName: field.name, value });

      // First check if this is a contenteditable or input-like element
      const tagName = await element.evaluate((el: any) => el.tagName?.toLowerCase());
      const isContentEditable = await element.evaluate((el: any) => el.contentEditable === 'true');
      const role = await element.getAttribute('role');

      // For React Select, Material UI, Radix UI, etc.
      if (role === 'combobox' || role === 'searchbox' || isContentEditable) {
        // Try typing and selecting
        await element.click();
        await page.waitForTimeout(200);

        // Clear existing value
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');

        // Type the value
        await page.keyboard.type(value.toString());
        await page.waitForTimeout(500);

        // Try to select the option
        const enterWorked = await page.keyboard.press('Enter').then(() => true).catch(() => false);
        if (!enterWorked) {
          await page.keyboard.press('Tab');
        }

        logger.info('Used keyboard input for custom dropdown');
        return;
      }

      // Pattern 1: Click to open dropdown
      await element.click();
      await page.waitForTimeout(500);

      // Enhanced option selectors for modern components
      const optionSelectors = [
        // React Select
        `div[id*="react-select"][id*="option"]:has-text("${value}")`,
        `.react-select__option:has-text("${value}")`,

        // Material UI
        `li[role="option"]:has-text("${value}")`,
        `.MuiMenuItem-root:has-text("${value}")`,

        // Radix UI
        `[role="option"]:has-text("${value}")`,
        `[data-radix-collection-item]:has-text("${value}")`,

        // Ant Design
        `.ant-select-item:has-text("${value}")`,
        `.ant-select-dropdown:visible >> text="${value}"`,

        // Generic patterns
        `[role="listbox"] >> text="${value}"`,
        `.dropdown-menu:visible >> text="${value}"`,
        `.dropdown-item:has-text("${value}")`,
        `.select-option:has-text("${value}")`,
        `li:has-text("${value}")`,
        `[data-value="${value}"]`,
        `[aria-label="${value}"]`
      ];

      let optionFound = false;
      for (const selector of optionSelectors) {
        try {
          const option = page.locator(selector).first();
          if (await option.isVisible({ timeout: 1000 })) {
            await option.click();
            optionFound = true;
            logger.info('Custom dropdown option selected', { selector, value });
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!optionFound) {
        // Pattern 2: Try JavaScript evaluation for shadow DOM or complex components
        logger.info('Trying JavaScript evaluation pattern', { value });

        const jsClicked = await page.evaluate((val) => {
          // Find all potential option elements
          const options = document.querySelectorAll(
            '[role="option"], .dropdown-item, .select-option, li[data-value], [aria-label]'
          );

          for (let i = 0; i < options.length; i++) {
            const option = options[i];
            const text = option.textContent || option.getAttribute('aria-label') || '';
            if (text.includes(val)) {
              (option as HTMLElement).click();
              return true;
            }
          }

          // Try shadow DOM
          const shadowHosts = document.querySelectorAll('*');
          for (let i = 0; i < shadowHosts.length; i++) {
            const host = shadowHosts[i];
            if ((host as any).shadowRoot) {
              const shadowOptions = (host as any).shadowRoot.querySelectorAll(
                '[role="option"], [data-value]'
              );
              for (let j = 0; j < shadowOptions.length; j++) {
                const option = shadowOptions[j];
                const text = option.textContent || '';
                if (text.includes(val)) {
                  (option as HTMLElement).click();
                  return true;
                }
              }
            }
          }

          return false;
        }, value.toString());

        if (jsClicked) {
          logger.info('Selected option via JavaScript evaluation');
          return;
        }

        // Pattern 3: Keyboard navigation as fallback
        logger.info('Trying keyboard navigation pattern', { value });
        await element.focus();
        await page.keyboard.press('Space'); // Open dropdown

        // Navigate through options
        let found = false;
        for (let i = 0; i < 20; i++) { // Max 20 attempts
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(100);

          // Check if current option matches
          const currentText = await page.evaluate(() => {
            const focused = document.activeElement;
            return focused?.textContent || focused?.getAttribute('aria-label') || '';
          });

          if (currentText.includes(value.toString())) {
            await page.keyboard.press('Enter');
            found = true;
            logger.info('Selected option via keyboard navigation');
            break;
          }
        }

        if (!found) {
          logger.warn('Could not select dropdown option', { field: field.name, value });
          // Close dropdown
          await page.keyboard.press('Escape');
        }
      }
    } catch (error) {
      logger.error('Failed to handle custom dropdown', { field: field.name, error });
      throw error;
    }
  }

  private async inputValue(page: Page, element: any, field: FormField, value: any): Promise<void> {
    switch (field.type) {
      case 'checkbox':
        if (value && !(await element.isChecked())) {
          await element.check();
        } else if (!value && (await element.isChecked())) {
          await element.uncheck();
        }
        break;

      case 'radio':
        await element.check();
        break;

      case 'select':
        // Try standard select first
        try {
          await element.selectOption(value);
        } catch (error) {
          // Handle custom dropdown/combobox
          logger.info('Standard select failed, trying custom dropdown', { selector: field.selector });
          await this.handleCustomDropdown(page, element, field, value);
        }
        break;

      case 'file':
        // Handle file uploads if needed
        logger.warn('File upload not implemented', { fieldName: field.name });
        break;

      default:
        // Check if element is clearable (input/textarea)
        const tagName = await element.evaluate((el: HTMLElement) => el.tagName.toLowerCase());

        if (tagName === 'input' || tagName === 'textarea') {
          // Clear field first, then type
          await element.clear();
          await element.fill(String(value));
        } else if (tagName === 'select') {
          // Handle native select element
          try {
            await element.selectOption(value);
          } catch (error) {
            logger.warn('Failed to select option in native select', { error });
            // Try alternative approach
            await element.focus();
            await page.keyboard.type(String(value));
          }
        } else {
          // For other elements (contenteditable, etc.), just fill
          await element.fill(String(value));
        }
        break;
    }

    // Trigger change events
    await element.dispatchEvent('change');
    await element.dispatchEvent('blur');
  }

  private async submitForm(page: Page, form: Form): Promise<void> {
    const stepId = uuidv4();
    const stepStart = Date.now();

    try {
      logger.info('Submitting form', { formName: form.name, submitSelector: form.submit.selector });

      const submitElement = await this.findElementWithRetry(page, form.submit.selector);

      if (!submitElement) {
        throw new SelectorError(`Submit button not found: ${form.submit.selector}`);
      }

      // Take screenshot before submit
      await this.takeScreenshot(page, 'before_submit');

      await submitElement.click();

      this.steps.push({
        stepId,
        action: 'click',
        selector: form.submit.selector,
        inferredIntent: 'Submit form',
        outcome: 'success',
        latencyMs: Date.now() - stepStart,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to submit form', { error });

      this.steps.push({
        stepId,
        action: 'click',
        selector: form.submit.selector,
        inferredIntent: 'Submit form',
        outcome: 'fail',
        latencyMs: Date.now() - stepStart,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  private async waitForResponse(page: Page, timeout: number = 10000): Promise<void> {
    try {
      // Wait for either navigation or network idle
      await Promise.race([
        page.waitForNavigation({ timeout }),
        page.waitForLoadState('networkidle', { timeout })
      ]);
    } catch (error) {
      logger.warn('Response wait timeout', { error });
      // Don't throw - this might be expected for AJAX forms
    }
  }

  private async collectValidationErrors(page: Page): Promise<void> {
    try {
      // Look for common validation error patterns
      const errorSelectors = [
        '.error',
        '.validation-error',
        '.field-error',
        '[role="alert"]',
        '.alert-danger',
        '.text-danger',
        '.invalid-feedback'
      ];

      for (const selector of errorSelectors) {
        const elements = await page.locator(selector).all();

        for (const element of elements) {
          try {
            if (await element.isVisible()) {
              const text = await element.textContent();
              if (text && text.trim()) {
                this.errors.push({
                  type: 'validation',
                  selector,
                  message: text.trim(),
                  code: 'E_VALIDATION_RULE',
                  evidence: {
                    text: text.trim(),
                    ariaLive: await element.getAttribute('aria-live') === 'polite'
                  },
                  timestamp: new Date().toISOString()
                });
              }
            }
          } catch (elementError) {
            // Skip this element
          }
        }
      }

      // Check for toast messages
      await this.collectToastMessages(page);

    } catch (error) {
      logger.warn('Failed to collect validation errors', { error });
    }
  }

  private async collectToastMessages(page: Page): Promise<void> {
    const toastSelectors = [
      '.toast',
      '.notification',
      '.snackbar',
      '.flash-message',
      '[data-test*="toast"]',
      '[data-test*="notification"]'
    ];

    for (const selector of toastSelectors) {
      try {
        const elements = await page.locator(selector).all();

        for (const element of elements) {
          if (await element.isVisible()) {
            const text = await element.textContent();
            if (text && text.trim()) {
              // Determine error type based on classes or content
              const className = await element.getAttribute('class') || '';
              const isError = /error|danger|fail/i.test(className) || /error|fail/i.test(text);

              this.errors.push({
                type: isError ? 'validation' : 'console',
                selector,
                message: text.trim(),
                code: isError ? 'E_VALIDATION_RULE' : 'E_NOTIFICATION',
                evidence: {
                  text: text.trim()
                },
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      } catch (error) {
        // Skip this selector
      }
    }
  }

  private async takeScreenshot(page: Page, label: string): Promise<void> {
    try {
      const screenshotPath = `/tmp/flow-${label}-${Date.now()}.png`;
      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });
      this.screenshots.push(screenshotPath);
      logger.info('Screenshot taken', { label, path: screenshotPath });
    } catch (error) {
      logger.warn('Failed to take screenshot', { label, error });
    }
  }

  private determineResult(): 'passed' | 'passed_with_warnings' | 'failed' {
    const hasErrors = this.errors.some(e => e.type === 'validation' || e.type === 'timeout');
    const hasWarnings = this.errors.some(e => e.type === 'console' || e.type === 'network');

    if (hasErrors) {
      return 'failed';
    } else if (hasWarnings) {
      return 'passed_with_warnings';
    } else {
      return 'passed';
    }
  }
}

export const flowEngine = new FlowEngine();