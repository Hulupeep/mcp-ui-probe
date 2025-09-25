import { Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { TestRun, TestStep, TestError, Form, FormField } from '../types/index.js';
import { dataSynthesizer } from '../utils/dataSynthesizer.js';
import { SelectorError } from '../utils/errors.js';
import { checkboxResolver } from '../utils/checkboxResolver.js';
import { smartFieldResolver } from '../utils/smartFieldResolver.js';
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

      // Special handling for checkboxes with values
      if (field.type === 'checkbox' && (typeof value === 'string' || Array.isArray(value))) {
        // Use CheckboxResolver for checkbox fields with specific values
        await this.inputValue(page, null, field, value);
      } else {
        // Find element with retries and self-healing
        const element = await this.findElementWithRetry(page, field.selector);

        if (!element) {
          throw new SelectorError(`Element not found: ${field.selector}`);
        }

        // Handle different input types
        await this.inputValue(page, element, field, value);
      }

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
      const className = await element.getAttribute('class') || '';

      // Enhanced detection for modern component libraries
      const isReactSelect = className.includes('react-select') ||
                           className.includes('Select') ||
                           await element.evaluate((el: any) => el.closest('[class*="react-select"]') !== null);

      const isMuiSelect = className.includes('Mui') ||
                         className.includes('MuiSelect') ||
                         await element.evaluate((el: any) => el.closest('[class*="Mui"]') !== null);

      const isAntSelect = className.includes('ant-select') ||
                         await element.evaluate((el: any) => el.closest('[class*="ant-select"]') !== null);

      // For React Select, Material UI, Radix UI, etc.
      if (role === 'combobox' || role === 'searchbox' || isContentEditable || isReactSelect || isMuiSelect) {
        await this.handleSearchableDropdown(page, element, value);
        return;
      }

      // Handle Ant Design specifically
      if (isAntSelect) {
        await this.handleAntDesignSelect(page, element, value);
        return;
      }

      // Pattern 1: Click to open dropdown
      await element.click();
      await page.waitForTimeout(500);

      // Enhanced option selectors for modern components
      const optionSelectors = [
        // React Select variants
        `div[id*="react-select"][id*="option"]:has-text("${value}")`,
        `.react-select__option:has-text("${value}")`,
        `.react-select__menu >> text="${value}"`,
        `.Select__option:has-text("${value}")`,

        // Material UI variants
        `li[role="option"]:has-text("${value}")`,
        `.MuiMenuItem-root:has-text("${value}")`,
        `.MuiMenu-paper >> li:has-text("${value}")`,
        `.MuiPopover-paper >> [role="option"]:has-text("${value}")`,

        // Radix UI
        `[role="option"]:has-text("${value}")`,
        `[data-radix-collection-item]:has-text("${value}")`,
        `[data-radix-select-item]:has-text("${value}")`,
        `[data-radix-combobox-item]:has-text("${value}")`,

        // Ant Design variants
        `.ant-select-item:has-text("${value}")`,
        `.ant-select-dropdown:visible >> text="${value}"`,
        `.ant-select-item-option:has-text("${value}")`,
        `.ant-cascader-menu-item:has-text("${value}")`,

        // Chakra UI
        `[role="menuitem"]:has-text("${value}")`,
        `[data-focus]:has-text("${value}")`,

        // Headless UI
        `[role="listbox"] [role="option"]:has-text("${value}")`,
        `.listbox-option:has-text("${value}")`,

        // Generic patterns
        `[role="listbox"] >> text="${value}"`,
        `.dropdown-menu:visible >> text="${value}"`,
        `.dropdown-item:has-text("${value}")`,
        `.select-option:has-text("${value}")`,
        `.option:has-text("${value}")`,
        `.choice:has-text("${value}")`,
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
        // Use SmartFieldResolver for better resolution
        if (Array.isArray(value) || typeof value === 'string') {
          const locators = await smartFieldResolver.resolveField(
            page,
            'checkbox',
            field.name,
            value
          );

          for (const locator of locators) {
            try {
              if (await locator.count() > 0 && !(await locator.isChecked())) {
                await locator.check();
                logger.info('Checked checkbox using smart resolver', {
                  fieldName: field.name,
                  value: Array.isArray(value) ? value : [value]
                });
              }
            } catch (error) {
              logger.warn('Failed to check checkbox with smart resolver', { error });
              // Fallback to checkbox resolver
              if (typeof value === 'string' || Array.isArray(value)) {
                const fallbackSelectors = await checkboxResolver.resolveCheckbox(page, field.name, value);
                for (const selector of fallbackSelectors) {
                  try {
                    const checkbox = page.locator(selector).first();
                    if (await checkbox.count() > 0 && !(await checkbox.isChecked())) {
                      await checkbox.check();
                    }
                  } catch (e) {
                    logger.warn('Fallback also failed', { e });
                  }
                }
              }
            }
          }
        } else {
          // Boolean value (simple checkbox)
          if (value && element && !(await element.isChecked())) {
            await element.check();
          } else if (!value && element && (await element.isChecked())) {
            await element.uncheck();
          }
        }
        break;

      case 'radio':
        // Use SmartFieldResolver for radio buttons too
        if (typeof value === 'string') {
          const locators = await smartFieldResolver.resolveField(
            page,
            'radio',
            field.name,
            value
          );

          if (locators.length > 0) {
            try {
              await locators[0].check();
              logger.info('Selected radio button using smart resolver', {
                fieldName: field.name,
                value
              });
            } catch (error) {
              logger.warn('Failed to select radio with smart resolver, using fallback', { error });
              if (element) {
                await element.check();
              }
            }
          } else if (element) {
            await element.check();
          }
        } else if (element) {
          await element.check();
        }
        break;

      case 'select':
        // Use SmartFieldResolver for select options
        if (typeof value === 'string') {
          // First try to resolve the option value using smart resolver
          const resolvedValue = await smartFieldResolver.resolveSelectOption(
            page,
            field.name,
            value
          );

          if (resolvedValue) {
            try {
              // Try with resolved value
              if (element) {
                await element.selectOption(resolvedValue);
                logger.info('Selected option using smart resolver', {
                  fieldName: field.name,
                  displayText: value,
                  resolvedValue
                });
              }
            } catch (error) {
              logger.warn('Smart resolver select failed, trying custom dropdown', { error });
              await this.handleCustomDropdown(page, element, field, value);
            }
          } else {
            // Fallback to standard select or custom dropdown
            try {
              if (element) {
                await element.selectOption(value);
              }
            } catch (error) {
              logger.info('Standard select failed, trying custom dropdown', { selector: field.selector });
              await this.handleCustomDropdown(page, element, field, value);
            }
          }
        } else {
          // Non-string value, try standard approach
          try {
            if (element) {
              await element.selectOption(value);
            }
          } catch (error) {
            await this.handleCustomDropdown(page, element, field, value);
          }
        }
        break;

      case 'file':
        await this.handleFileUpload(page, element, field, value);
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

    // Trigger change events (only if element exists)
    if (element && element.dispatchEvent) {
      await element.dispatchEvent('change');
      await element.dispatchEvent('blur');
    }
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

  private async handleFileUpload(page: Page, element: any, field: FormField, value: any): Promise<void> {
    try {
      logger.info('Handling file upload', { fieldName: field.name, value });

      // Generate test files if not provided
      let filePaths: string[] = [];

      if (Array.isArray(value)) {
        // Multiple files provided
        filePaths = value;
      } else if (typeof value === 'string') {
        // Single file path provided
        filePaths = [value];
      } else if (typeof value === 'object' && value !== null) {
        // File configuration object
        filePaths = await this.generateTestFiles(value);
      } else {
        // Generate default test file
        filePaths = await this.generateTestFiles({ count: 1, type: 'text' });
      }

      // Check if it's a drag-and-drop zone
      const isDragDropZone = await this.isDragDropZone(element);

      if (isDragDropZone) {
        await this.handleDragDropUpload(page, element, filePaths);
      } else {
        // Standard file input
        if (element) {
          await element.setInputFiles(filePaths);
          logger.info('Files uploaded via input element', { count: filePaths.length });
        } else {
          // Find file input by various selectors
          const fileInputSelectors = [
            'input[type="file"]',
            '[data-testid*="file"]',
            '[data-test*="file"]',
            '[accept*="file"]',
            '.file-input',
            '.upload-input'
          ];

          for (const selector of fileInputSelectors) {
            try {
              const fileInput = page.locator(selector).first();
              if (await fileInput.count() > 0) {
                await fileInput.setInputFiles(filePaths);
                logger.info('Files uploaded via selector', { selector, count: filePaths.length });
                break;
              }
            } catch (e) {
              // Continue to next selector
            }
          }
        }
      }

      // Trigger change events
      await page.waitForTimeout(500);
      if (element) {
        await element.dispatchEvent('change');
        await element.dispatchEvent('input');
      }

    } catch (error) {
      logger.error('Failed to handle file upload', { fieldName: field.name, error });
      throw error;
    }
  }

  private async generateTestFiles(config: {
    count?: number;
    type?: 'text' | 'image' | 'pdf' | 'csv' | 'json';
    size?: 'small' | 'medium' | 'large';
    names?: string[];
  }): Promise<string[]> {
    const { count = 1, type = 'text', size = 'small' } = config;
    const filePaths: string[] = [];

    for (let i = 0; i < count; i++) {
      const timestamp = Date.now();
      const filename = config.names?.[i] || `test-file-${i + 1}-${timestamp}`;
      let content = '';
      let extension = '.txt';

      switch (type) {
        case 'text':
          content = this.generateTextContent(size);
          extension = '.txt';
          break;
        case 'csv':
          content = this.generateCSVContent(size);
          extension = '.csv';
          break;
        case 'json':
          content = JSON.stringify(this.generateJSONContent(size), null, 2);
          extension = '.json';
          break;
        case 'image':
          // For images, we'll create a small SVG
          content = this.generateSVGContent();
          extension = '.svg';
          break;
        case 'pdf':
          // Simple PDF-like content (not actual PDF)
          content = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj';
          extension = '.pdf';
          break;
      }

      const filePath = `/tmp/claude/${filename}${extension}`;

      try {
        // Write file content using Node.js fs
        const fs = await import('fs/promises');
        await fs.mkdir('/tmp/claude', { recursive: true });
        await fs.writeFile(filePath, content);
        filePaths.push(filePath);
      } catch (error) {
        logger.warn('Could not write test file, using mock path', { filePath, error });
        filePaths.push(filePath);
      }
    }

    return filePaths;
  }

  private generateTextContent(size: string): string {
    const baseText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
    const multipliers = { small: 10, medium: 100, large: 1000 };
    const multiplier = multipliers[size as keyof typeof multipliers] || 10;
    return baseText.repeat(multiplier);
  }

  private generateCSVContent(size: string): string {
    const headers = 'Name,Email,Age,City';
    const sampleRows = [
      'John Doe,john@example.com,30,New York',
      'Jane Smith,jane@example.com,25,Los Angeles',
      'Bob Johnson,bob@example.com,35,Chicago'
    ];

    const multipliers = { small: 10, medium: 100, large: 1000 };
    const rowCount = multipliers[size as keyof typeof multipliers] || 10;

    const rows = [headers];
    for (let i = 0; i < rowCount; i++) {
      rows.push(sampleRows[i % sampleRows.length]);
    }

    return rows.join('\n');
  }

  private generateJSONContent(size: string): any {
    const baseObject = {
      id: 1,
      name: 'Test Object',
      description: 'A test JSON object',
      active: true,
      tags: ['test', 'mock', 'data']
    };

    const multipliers = { small: 5, medium: 50, large: 500 };
    const count = multipliers[size as keyof typeof multipliers] || 5;

    return {
      data: Array.from({ length: count }, (_, i) => ({
        ...baseObject,
        id: i + 1,
        name: `Test Object ${i + 1}`
      }))
    };
  }

  private generateSVGContent(): string {
    return `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" fill="#007bff"/>
  <text x="50" y="55" font-family="Arial" font-size="14" fill="white" text-anchor="middle">Test</text>
</svg>`;
  }

  private async isDragDropZone(element: any): Promise<boolean> {
    try {
      // Check various indicators that this might be a drag-and-drop zone
      const indicators = await element.evaluate((el: HTMLElement) => {
        const className = el.className.toString().toLowerCase();
        const hasDropZoneClass = /\b(drop-zone|dropzone|file-drop|drag-drop|upload-area)\b/.test(className);

        const style = window.getComputedStyle(el);
        const hasBorder = style.border && style.border !== 'none' && style.border !== '0px';
        const hasDashedBorder = style.borderStyle === 'dashed';

        const text = el.textContent?.toLowerCase() || '';
        const hasDropText = /\b(drop|drag|upload|choose)\b/.test(text);

        return {
          hasDropZoneClass,
          hasBorder,
          hasDashedBorder,
          hasDropText,
          tagName: el.tagName.toLowerCase()
        };
      });

      return indicators.hasDropZoneClass ||
             (indicators.hasDashedBorder && indicators.hasDropText) ||
             (indicators.tagName === 'div' && indicators.hasDropText && indicators.hasBorder);

    } catch (error) {
      return false;
    }
  }

  private async handleDragDropUpload(page: Page, element: any, filePaths: string[]): Promise<void> {
    try {
      logger.info('Handling drag-and-drop file upload');

      // Create a file input element if one doesn't exist
      await page.evaluate(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.style.display = 'none';
        input.id = 'temp-file-input';
        document.body.appendChild(input);
      });

      // Set files on the temporary input
      const tempInput = page.locator('#temp-file-input');
      await tempInput.setInputFiles(filePaths);

      // Get file data and simulate drop event
      await element.evaluate((el: HTMLElement, paths: string[]) => {
        // Create a mock FileList
        const files = paths.map(path => {
          const filename = path.split('/').pop() || 'file.txt';
          return new File(['mock content'], filename, { type: 'text/plain' });
        });

        // Create and dispatch drag events
        const dragEnter = new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer()
        });

        const dragOver = new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer()
        });

        const drop = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer()
        });

        // Add files to dataTransfer
        files.forEach(file => {
          drop.dataTransfer?.items.add(file);
        });

        el.dispatchEvent(dragEnter);
        el.dispatchEvent(dragOver);
        el.dispatchEvent(drop);

      }, filePaths);

      // Clean up temporary input
      await page.evaluate(() => {
        const input = document.getElementById('temp-file-input');
        if (input) input.remove();
      });

      logger.info('Drag-and-drop upload completed');

    } catch (error) {
      logger.error('Failed to handle drag-and-drop upload', { error });
      throw error;
    }
  }

  private async handleSearchableDropdown(page: Page, element: any, value: any): Promise<void> {
    try {
      // Try typing and selecting for searchable dropdowns
      await element.click();
      await page.waitForTimeout(200);

      // Clear existing value
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(100);

      // Type the value
      await page.keyboard.type(value.toString());
      await page.waitForTimeout(300);

      // Try multiple selection methods
      const selectionMethods = [
        () => page.keyboard.press('Enter'),
        () => page.keyboard.press('Tab'),
        () => page.keyboard.press('ArrowDown').then(() => page.keyboard.press('Enter')),
        // Click on the first option if it appears
        async () => {
          const firstOption = page.locator('[role="option"], .option, .dropdown-item').first();
          if (await firstOption.isVisible({ timeout: 500 })) {
            await firstOption.click();
          }
        }
      ];

      for (const method of selectionMethods) {
        try {
          await method();
          await page.waitForTimeout(200);
          // Check if dropdown closed (indicates selection worked)
          const dropdownStillOpen = await page.locator('[role="listbox"], .dropdown-menu, .react-select__menu').isVisible().catch(() => false);
          if (!dropdownStillOpen) {
            logger.info('Used searchable dropdown selection');
            return;
          }
        } catch (e) {
          // Try next method
        }
      }

      logger.warn('Searchable dropdown selection may not have worked');
    } catch (error) {
      logger.error('Failed to handle searchable dropdown', { error });
      throw error;
    }
  }

  private async handleAntDesignSelect(page: Page, element: any, value: any): Promise<void> {
    try {
      // Ant Design specific handling
      await element.click();
      await page.waitForTimeout(300);

      // Look for Ant Design dropdown
      const antOptionSelectors = [
        `.ant-select-dropdown:visible .ant-select-item:has-text("${value}")`,
        `.ant-select-dropdown:visible .ant-select-item-option:has-text("${value}")`,
        `.ant-select-item[title="${value}"]`,
        `.ant-select-item-option[title="${value}"]`
      ];

      for (const selector of antOptionSelectors) {
        try {
          const option = page.locator(selector).first();
          if (await option.isVisible({ timeout: 1000 })) {
            await option.click();
            logger.info('Ant Design select option clicked');
            return;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      // Fallback: use keyboard navigation
      await page.keyboard.type(value.toString().charAt(0));
      await page.waitForTimeout(200);
      await page.keyboard.press('Enter');

    } catch (error) {
      logger.error('Failed to handle Ant Design select', { error });
      throw error;
    }
  }
}

export const flowEngine = new FlowEngine();