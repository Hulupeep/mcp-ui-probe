import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { Driver, UIAnalysis, UIElement, Form } from '../types/index.js';
import { NavigationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class PlaywrightDriver implements Driver {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private consoleErrors: string[] = [];
  private networkErrors: any[] = [];
  private lastResponse: any = null;
  private lastNavigationStatus: number = 200;

  async initialize(): Promise<void> {
    try {
      this.browser = await chromium.launch({
        headless: process.env.NODE_ENV === 'production',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      this.page = await this.context.newPage();

      // Set up error collection
      this.setupErrorCollection();

      logger.info('Playwright driver initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Playwright driver', { error });
      throw new NavigationError('Failed to initialize browser', error);
    }
  }

  private setupErrorCollection(): void {
    if (!this.page) return;

    // Console error collection
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
        logger.warn('Console error captured', { message: msg.text() });
      }
    });

    // Network error collection
    this.page.on('response', (response) => {
      if (!response.ok()) {
        this.networkErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          timestamp: new Date().toISOString()
        });
        logger.warn('Network error captured', {
          url: response.url(),
          status: response.status()
        });
      }
    });

    // Page error collection
    this.page.on('pageerror', (error) => {
      this.consoleErrors.push(error.message);
      logger.error('Page error captured', { error: error.message });
    });
  }

  async navigate(url: string, waitUntil: 'load' | 'domcontentloaded' | 'networkidle' = 'domcontentloaded'): Promise<void> {
    if (!this.page) {
      await this.initialize();
    }

    try {
      logger.info('Navigating to URL', { url });
      const response = await this.page!.goto(url, {
        waitUntil,
        timeout: 30000
      });
      this.lastResponse = response;

      // Clear previous errors for new navigation
      this.consoleErrors = [];
      this.networkErrors = [];

      logger.info('Navigation completed successfully', { url, currentUrl: this.page!.url() });
    } catch (error) {
      logger.error('Navigation failed', { url, error });
      throw new NavigationError(`Failed to navigate to ${url}`, error);
    }
  }

  async navigateWithResponse(url: string, waitUntil: 'load' | 'domcontentloaded' | 'networkidle' = 'domcontentloaded'): Promise<any> {
    if (!this.page) {
      await this.initialize();
    }

    try {
      logger.info('Navigating to URL with response capture', { url });

      // Set up response listener BEFORE navigation
      let capturedStatus: number | null = null;
      const responseHandler = (response: any) => {
        // Capture the main frame navigation response
        if (response.url() === url || response.url() === this.page!.url()) {
          capturedStatus = response.status();
          logger.info('Captured response status', { url: response.url(), status: capturedStatus });
        }
      };

      this.page!.once('response', responseHandler);

      const response = await this.page!.goto(url, {
        waitUntil,
        timeout: 30000
      });

      // Clear previous errors for new navigation
      this.consoleErrors = [];
      this.networkErrors = [];

      // Store the captured status
      this.lastNavigationStatus = capturedStatus || (response ? response.status() : 200);

      logger.info('Navigation completed with response', {
        url,
        currentUrl: this.page!.url(),
        status: this.lastNavigationStatus,
        hadResponse: response !== null
      });

      // Return a response-like object even if response is null
      return response || {
        status: () => this.lastNavigationStatus,
        url: () => this.page!.url(),
        ok: () => this.lastNavigationStatus < 400
      };
    } catch (error) {
      logger.error('Navigation failed', { url, error });
      throw new NavigationError(`Failed to navigate to ${url}`, error);
    }
  }

  async getPage(): Promise<Page> {
    if (!this.page) {
      await this.initialize();
    }
    return this.page!;
  }

  async snapshot(): Promise<UIAnalysis> {
    if (!this.page) {
      throw new NavigationError('Page not initialized');
    }

    try {
      logger.info('Taking UI snapshot');

      const result = await this.page.evaluate(() => {
        const forms: Form[] = [];
        const buttons: UIElement[] = [];
        const inputs: UIElement[] = [];
        const roles: UIElement[] = [];
        const landmarks: UIElement[] = [];

        // Helper function to get element bounds
        const getBounds = (element: Element) => {
          const rect = element.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          };
        };

        // Enhanced helper function to detect if element is clickable
        const isClickableElement = (element: Element): boolean => {
          // Check if element has click event listeners
          const hasClickListener = (element as any)._reactListeners?.onClick ||
                                 (element as any).__reactEventHandlers$?.onClick ||
                                 element.getAttribute('onclick');

          // Check CSS cursor style
          const computedStyle = window.getComputedStyle(element);
          const hasPointerCursor = computedStyle.cursor === 'pointer';

          // Check React synthetic event patterns
          const hasReactProps = element.hasAttribute('data-reactroot') ||
                               element.className.includes('react-') ||
                               element.hasAttribute('data-react');

          // Check for common clickable patterns
          const clickableClasses = /\b(btn|button|click|link|card|tile|item|menu|nav|action|interactive|selectable|toggle)\b/i;
          const hasClickableClass = clickableClasses.test(element.className);

          // Check ARIA roles that indicate interactivity
          const role = element.getAttribute('role');
          const interactiveRoles = ['button', 'link', 'menuitem', 'tab', 'option', 'checkbox', 'radio', 'switch'];
          const hasInteractiveRole = role && interactiveRoles.includes(role);

          // Check for tabindex (focusable elements)
          const tabIndex = element.getAttribute('tabindex');
          const isFocusable = tabIndex !== null && parseInt(tabIndex) >= 0;

          // Check if element is a semantic clickable element
          const semanticClickable = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName);

          return semanticClickable || hasClickListener || hasPointerCursor || hasClickableClass ||
                 hasInteractiveRole || isFocusable || hasReactProps;
        };

        // Enhanced helper function to generate selector
        const generateSelector = (element: Element): string => {
          // Prefer data-test attributes
          if (element.hasAttribute('data-test')) {
            return `[data-test="${element.getAttribute('data-test')}"]`;
          }
          if (element.hasAttribute('data-testid')) {
            return `[data-testid="${element.getAttribute('data-testid')}"]`;
          }

          // Use ID if available
          if (element.id) {
            return `#${element.id}`;
          }

          // Use name attribute for form elements
          if (element.hasAttribute('name')) {
            return `[name="${element.getAttribute('name')}"]`;
          }

          // Enhanced selector generation for React components
          if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ').filter(c => c.length > 0);

            // Prioritize React component classes
            const reactClass = classes.find(c => c.includes('react-') || c.includes('component-') || c.includes('widget-'));
            if (reactClass) {
              return `.${reactClass}`;
            }

            // Look for semantic classes
            const semanticClass = classes.find(c => /\b(btn|button|card|item|menu|nav|link)\b/i.test(c));
            if (semanticClass) {
              return `.${semanticClass}`;
            }

            if (classes.length > 0) {
              return `.${classes[0]}`;
            }
          }

          // Generate CSS selector path for complex elements
          const getUniquePath = (el: Element): string => {
            const path: string[] = [];
            let current = el;

            while (current && current.nodeType === Node.ELEMENT_NODE) {
              let selector = current.tagName.toLowerCase();

              // Add unique identifiers
              if (current.id) {
                selector += `#${current.id}`;
                path.unshift(selector);
                break;
              }

              // Add class if meaningful
              if (current.className && typeof current.className === 'string') {
                const classes = current.className.split(' ').filter(c => c.length > 0 && !c.includes('css-'));
                if (classes.length > 0) {
                  selector += `.${classes[0]}`;
                }
              }

              // Add nth-child if needed for uniqueness
              const siblings = Array.from(current.parentElement?.children || []);
              const sameTag = siblings.filter(s => s.tagName === current.tagName);
              if (sameTag.length > 1) {
                const index = sameTag.indexOf(current) + 1;
                selector += `:nth-of-type(${index})`;
              }

              path.unshift(selector);
              current = current.parentElement!;

              // Limit depth
              if (path.length >= 4) break;
            }

            return path.join(' > ');
          };

          return getUniquePath(element);
        };

        // Analyze forms
        document.querySelectorAll('form').forEach((form, formIndex) => {
          const fields = Array.from(form.querySelectorAll('input, select, textarea')).map((input, fieldIndex) => {
            const inputElement = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

            // Generate unique field name based on various attributes
            const fieldName = inputElement.name ||
                            inputElement.id ||
                            inputElement.getAttribute('aria-label') ||
                            inputElement.getAttribute('placeholder')?.toLowerCase().replace(/\s+/g, '_') ||
                            `${inputElement.type || 'field'}_${formIndex}_${fieldIndex}`;

            return {
              name: fieldName,
              type: inputElement.type || 'text',
              selector: generateSelector(inputElement),
              required: inputElement.hasAttribute('required'),
              placeholder: inputElement.getAttribute('placeholder') || undefined,
              label: (() => {
                // Try to find associated label
                const id = inputElement.id;
                if (id) {
                  const label = document.querySelector(`label[for="${id}"]`);
                  if (label) return label.textContent?.trim();
                }

                // Look for parent label
                const parentLabel = inputElement.closest('label');
                if (parentLabel) return parentLabel.textContent?.trim();

                // Look for nearby text
                const prevElement = inputElement.previousElementSibling;
                if (prevElement && prevElement.tagName === 'LABEL') {
                  return prevElement.textContent?.trim();
                }

                return undefined;
              })()
            };
          });

          const submitButton = form.querySelector('button[type="submit"], input[type="submit"]') ||
                              form.querySelector('button:not([type])');

          forms.push({
            name: form.getAttribute('name') || form.id || `form_${formIndex}`,
            selector: generateSelector(form),
            fields,
            submit: {
              selector: submitButton ? generateSelector(submitButton) : 'button[type="submit"]',
              text: submitButton?.textContent?.trim() || 'Submit'
            }
          });
        });

        // Enhanced button and clickable element analysis
        const processedElements = new Set<Element>();

        // First pass: semantic buttons and inputs
        document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]').forEach(button => {
          if (processedElements.has(button)) return;
          processedElements.add(button);

          buttons.push({
            type: 'button',
            selector: generateSelector(button),
            text: button.textContent?.trim() || button.getAttribute('value') || '',
            attributes: {
              type: button.getAttribute('type') || '',
              disabled: button.hasAttribute('disabled') ? 'true' : 'false',
              'data-clickable': 'semantic'
            },
            role: button.getAttribute('role') || 'button',
            name: button.getAttribute('aria-label') || button.textContent?.trim() || '',
            bounds: getBounds(button)
          });
        });

        // Second pass: React components and custom clickable elements
        const allElements = document.querySelectorAll('*');
        allElements.forEach(element => {
          if (processedElements.has(element)) return;

          // Skip if element is not visible or too small
          const rect = element.getBoundingClientRect();
          if (rect.width < 10 || rect.height < 10 || rect.width * rect.height < 100) return;

          if (isClickableElement(element)) {
            processedElements.add(element);

            // Determine element type based on characteristics
            let elementType = 'clickable';
            const className = element.className.toString().toLowerCase();
            const role = element.getAttribute('role');

            if (className.includes('card') || element.tagName === 'ARTICLE') {
              elementType = 'card';
            } else if (className.includes('menu') || className.includes('nav')) {
              elementType = 'navigation';
            } else if (role === 'tab' || className.includes('tab')) {
              elementType = 'tab';
            } else if (className.includes('toggle') || className.includes('switch')) {
              elementType = 'toggle';
            } else if (element.tagName === 'A' || role === 'link') {
              elementType = 'link';
            }

            buttons.push({
              type: elementType,
              selector: generateSelector(element),
              text: element.textContent?.trim() || element.getAttribute('aria-label') || '',
              attributes: {
                role: role || '',
                'data-clickable': 'detected',
                'data-react': element.hasAttribute('data-reactroot') ||
                             element.className.includes('react-') ? 'true' : 'false',
                cursor: window.getComputedStyle(element).cursor
              },
              role: role || 'button',
              name: element.getAttribute('aria-label') || element.textContent?.trim() || '',
              bounds: getBounds(element)
            });
          }
        });

        // Analyze inputs
        document.querySelectorAll('input, select, textarea').forEach(input => {
          inputs.push({
            type: input.getAttribute('type') || input.tagName.toLowerCase(),
            selector: generateSelector(input),
            text: input.getAttribute('placeholder') || '',
            attributes: {
              name: input.getAttribute('name') || '',
              required: input.hasAttribute('required') ? 'true' : 'false',
              disabled: input.hasAttribute('disabled') ? 'true' : 'false'
            },
            role: input.getAttribute('role') || '',
            name: input.getAttribute('aria-label') || input.getAttribute('name') || '',
            bounds: getBounds(input)
          });
        });

        // Analyze role-based elements
        document.querySelectorAll('[role]').forEach(element => {
          const role = element.getAttribute('role');
          if (role) {
            roles.push({
              type: role,
              selector: generateSelector(element),
              text: element.textContent?.trim() || '',
              attributes: {},
              role,
              name: element.getAttribute('aria-label') || element.textContent?.trim() || '',
              bounds: getBounds(element)
            });
          }
        });

        // Analyze landmarks
        document.querySelectorAll('main, nav, header, footer, aside, section[aria-labelledby], [role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]').forEach(landmark => {
          landmarks.push({
            type: landmark.tagName.toLowerCase(),
            selector: generateSelector(landmark),
            text: landmark.getAttribute('aria-label') || '',
            attributes: {},
            role: landmark.getAttribute('role') || landmark.tagName.toLowerCase(),
            name: landmark.getAttribute('aria-label') || landmark.getAttribute('aria-labelledby') || '',
            bounds: getBounds(landmark)
          });
        });

        return {
          forms,
          buttons,
          inputs,
          roles,
          landmarks
        };
      });

      logger.info('UI snapshot completed', {
        formsFound: result.forms.length,
        buttonsFound: result.buttons.length,
        inputsFound: result.inputs.length
      });

      return result;
    } catch (error) {
      logger.error('Failed to take UI snapshot', { error });
      throw new NavigationError('Failed to analyze UI', error);
    }
  }

  async takeScreenshot(): Promise<string> {
    if (!this.page) {
      throw new NavigationError('Page not initialized');
    }

    try {
      const screenshotPath = `/tmp/screenshot-${uuidv4()}.png`;
      await this.page.screenshot({
        path: screenshotPath,
        fullPage: true
      });

      logger.info('Screenshot taken', { path: screenshotPath });
      return screenshotPath;
    } catch (error) {
      logger.error('Failed to take screenshot', { error });
      throw new NavigationError('Failed to take screenshot', error);
    }
  }

  async collectConsoleErrors(): Promise<string[]> {
    return [...this.consoleErrors];
  }

  async collectNetworkErrors(): Promise<any[]> {
    return [...this.networkErrors];
  }

  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.context) {
        await this.context.close();
        this.context = null;
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }

      logger.info('Playwright driver closed successfully');
    } catch (error) {
      logger.error('Error closing Playwright driver', { error });
    }
  }
}