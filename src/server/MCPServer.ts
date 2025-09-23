import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { PlaywrightDriver } from '../drivers/playwright.js';
import { formInferenceEngine } from '../infer/form.js';
import { flowEngine } from '../flows/flowEngine.js';
import {
  MCPToolResult,
  NavigateParams,
  AnalyzeUIParams,
  InferFormParams,
  FillAndSubmitParams,
  RunFlowParams,
  AssertSelectorsParams,
  CollectErrorsParams,
  ExportReportParams,
  TestRun
} from '../types/index.js';
import { MCPUIError, NavigationError, FormInferenceError } from '../utils/errors.js';
import { verifyPage, VerifyPageParams } from '../tools/verify_page.js';
import logger from '../utils/logger.js';

export class MCPServer {
  private server: Server;
  private driver: PlaywrightDriver;
  private testRuns: Map<string, TestRun> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-ui-probe',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.driver = new PlaywrightDriver();
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'navigate',
            description: 'Navigate to a URL and wait for page load',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'URL to navigate to',
                },
                waitUntil: {
                  type: 'string',
                  enum: ['load', 'domcontentloaded', 'networkidle'],
                  description: 'Wait condition for navigation',
                  default: 'domcontentloaded',
                },
              },
              required: ['url'],
            },
          },
          {
            name: 'analyze_ui',
            description: 'Analyze UI elements on the current page',
            inputSchema: {
              type: 'object',
              properties: {
                scope: {
                  type: 'string',
                  enum: ['viewport', 'document'],
                  description: 'Scope of analysis',
                  default: 'document',
                },
              },
            },
          },
          {
            name: 'infer_form',
            description: 'Infer form structure and field types from current page',
            inputSchema: {
              type: 'object',
              properties: {
                goal: {
                  type: 'string',
                  description: 'Goal context (e.g., signup, login, checkout)',
                },
                hints: {
                  type: 'object',
                  description: 'Additional hints for form inference',
                },
              },
            },
          },
          {
            name: 'fill_and_submit',
            description: 'Fill and submit a form with generated or provided data',
            inputSchema: {
              type: 'object',
              properties: {
                formSchema: {
                  type: 'object',
                  description: 'Form schema from infer_form',
                },
                overrides: {
                  type: 'object',
                  description: 'Override values for specific fields',
                },
              },
              required: ['formSchema'],
            },
          },
          {
            name: 'run_flow',
            description: 'Execute complete flow: analyze, infer, fill, and submit',
            inputSchema: {
              type: 'object',
              properties: {
                goal: {
                  type: 'string',
                  description: 'Goal description (e.g., "Sign up a new user")',
                },
                url: {
                  type: 'string',
                  description: 'URL to navigate to (optional if already on page)',
                },
                constraints: {
                  type: 'object',
                  description: 'Flow constraints and options',
                },
              },
              required: ['goal'],
            },
          },
          {
            name: 'click_button',
            description: 'Click a button or link on the page',
            inputSchema: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: 'Button text to click (exact or partial match)',
                },
                selector: {
                  type: 'string',
                  description: 'CSS selector for the button (optional, used if text not provided)',
                },
                waitForNavigation: {
                  type: 'boolean',
                  description: 'Wait for navigation after click (default: true)',
                },
              },
            },
          },
          {
            name: 'assert_selectors',
            description: 'Assert presence and properties of page elements',
            inputSchema: {
              type: 'object',
              properties: {
                assertions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      selector: { type: 'string' },
                      exists: { type: 'boolean' },
                      textMatches: { type: 'string' },
                      visible: { type: 'boolean' },
                    },
                    required: ['selector', 'exists'],
                  },
                  description: 'Array of assertions to check',
                },
              },
              required: ['assertions'],
            },
          },
          {
            name: 'verify_page',
            description: 'Verify page content and check for 404/error pages',
            inputSchema: {
              type: 'object',
              properties: {
                expectedContent: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Text that should be present on the page',
                },
                unexpectedContent: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Text that should NOT be present (e.g., "404", "Error")',
                },
                expectedTitle: {
                  type: 'string',
                  description: 'Expected page title (partial match)',
                },
                expectedUrl: {
                  type: 'string',
                  description: 'Expected URL pattern',
                },
              },
            },
          },
          {
            name: 'collect_errors',
            description: 'Collect errors from console, network, and validation',
            inputSchema: {
              type: 'object',
              properties: {
                types: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['console', 'network', 'validation'],
                  },
                  description: 'Types of errors to collect',
                },
              },
            },
          },
          {
            name: 'export_report',
            description: 'Export test run report in specified format',
            inputSchema: {
              type: 'object',
              properties: {
                runId: {
                  type: 'string',
                  description: 'Test run ID to export',
                },
                format: {
                  type: 'string',
                  enum: ['json', 'junit', 'allure'],
                  description: 'Export format',
                },
              },
              required: ['runId', 'format'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        logger.info('Tool called', { toolName: name, args });

        let result: MCPToolResult;

        switch (name) {
          case 'navigate':
            result = await this.handleNavigate(args as any);
            break;

          case 'analyze_ui':
            result = await this.handleAnalyzeUI(args as any);
            break;

          case 'infer_form':
            result = await this.handleInferForm(args as any);
            break;

          case 'fill_and_submit':
            result = await this.handleFillAndSubmit(args as any);
            break;

          case 'run_flow':
            result = await this.handleRunFlow(args as any);
            break;

          case 'verify_page':
            result = await this.handleVerifyPage(args as any);
            break;

          case 'assert_selectors':
            result = await this.handleAssertSelectors(args as any);
            break;

          case 'collect_errors':
            result = await this.handleCollectErrors(args as any);
            break;

          case 'click_button':
            result = await this.handleClickButton(args as any);
            break;

          case 'export_report':
            result = await this.handleExportReport(args as any);
            break;

          default:
            throw new MCPUIError(`Unknown tool: ${name}`, 'E_UNKNOWN_TOOL');
        }

        logger.info('Tool completed successfully', { toolName: name, success: result.success });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error('Tool execution failed', { toolName: name, error });

        const errorResult: MCPToolResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(errorResult, null, 2),
            },
          ],
        };
      }
    });
  }

  private async handleNavigate(params: NavigateParams): Promise<MCPToolResult> {
    try {
      // Navigate and capture response
      const response = await this.driver.navigateWithResponse(params.url, params.waitUntil);
      const page = await this.driver.getPage();
      const currentUrl = page.url();
      const pageTitle = await page.title();

      // Check HTTP status code
      const httpStatus = response ? response.status() : 200;
      const isHTTP404 = httpStatus === 404;
      const isHTTPError = httpStatus >= 400;

      // Get page text content for better detection
      const pageText = await page.locator('body').textContent() || '';

      // Enhanced 404 detection
      const contentIndicators404 = [
        pageTitle.toLowerCase().includes('404'),
        pageTitle.toLowerCase().includes('not found'),
        pageTitle.toLowerCase().includes('page not found'),
        pageText.includes('404') && pageText.toLowerCase().includes('not found'),
        pageText.includes('404 - '),
        pageText.includes('Error 404'),
        pageText.includes('404 Error'),
        pageText.toLowerCase().includes('the page you are looking for'),
        pageText.toLowerCase().includes('could not be found'),
        pageText.toLowerCase().includes('page cannot be found'),
        pageText.toLowerCase().includes('doesn\'t exist'),
        pageText.toLowerCase().includes('does not exist'),
        currentUrl !== params.url && currentUrl.includes('404')
      ];

      // Count how many indicators are present
      const indicatorCount = contentIndicators404.filter(Boolean).length;
      const is404Page = isHTTP404 || indicatorCount >= 2;

      // Check for empty or error pages
      const isEmpty = pageText.trim().length < 100;
      const isError = isHTTPError || pageTitle.toLowerCase().includes('error');

      const success = !is404Page && !isHTTPError && !isEmpty;

      return {
        success,
        data: {
          ok: success,
          currentUrl,
          pageTitle,
          httpStatus,
          is404Page,
          isError,
          isEmpty,
          warning: is404Page ? `Page appears to be a 404 error (HTTP ${httpStatus}, indicators: ${indicatorCount})` :
                   isHTTPError ? `HTTP Error ${httpStatus}` :
                   isEmpty ? 'Page appears to be empty' : undefined,
        },
      };
    } catch (error) {
      throw new NavigationError('Navigation failed', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async handleAnalyzeUI(_params: AnalyzeUIParams): Promise<MCPToolResult> {
    try {
      const analysis = await this.driver.snapshot();

      return {
        success: true,
        data: analysis,
      };
    } catch (error) {
      throw new NavigationError('UI analysis failed', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async handleInferForm(params: InferFormParams): Promise<MCPToolResult> {
    try {
      const analysis = await this.driver.snapshot();
      const inference = await formInferenceEngine.inferForm(analysis, {
        goal: params.goal,
        hints: params.hints,
      });

      return {
        success: true,
        data: inference,
      };
    } catch (error) {
      throw new FormInferenceError('Form inference failed', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async handleFillAndSubmit(params: FillAndSubmitParams): Promise<MCPToolResult> {
    try {
      const page = await this.driver.getPage();
      const testRun = await flowEngine.executeFlow(
        page,
        params.formSchema,
        params.overrides
      );

      // Store test run for later retrieval
      this.testRuns.set(testRun.runId, testRun);

      return {
        success: true,
        data: testRun,
      };
    } catch (error) {
      throw new MCPUIError('Fill and submit failed', 'E_FILL_SUBMIT', error);
    }
  }

  private async handleClickButton(params: any): Promise<MCPToolResult> {
    try {
      const page = await this.driver.getPage();
      let buttonClicked = false;
      let selector = '';

      if (params.text) {
        // Try multiple selector patterns for button text
        const buttonSelectors = [
          `button:has-text("${params.text}")`,
          `[role="button"]:has-text("${params.text}")`,
          `a:has-text("${params.text}")`,
          `input[type="button"][value="${params.text}"]`,
          `input[type="submit"][value="${params.text}"]`,
          `*:has-text("${params.text}"):is(button, [role="button"], a)`,
        ];

        for (const sel of buttonSelectors) {
          try {
            const element = page.locator(sel).first();
            if (await element.isVisible({ timeout: 1000 })) {
              selector = sel;
              if (params.waitForNavigation !== false) {
                await Promise.all([
                  page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null),
                  element.click()
                ]);
              } else {
                await element.click();
              }
              buttonClicked = true;
              break;
            }
          } catch (e) {
            // Continue to next selector
          }
        }
      } else if (params.selector) {
        const element = page.locator(params.selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          selector = params.selector;
          if (params.waitForNavigation !== false) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null),
              element.click()
            ]);
          } else {
            await element.click();
          }
          buttonClicked = true;
        }
      }

      if (!buttonClicked) {
        throw new MCPUIError(
          `Button not found: ${params.text || params.selector}`,
          'E_BUTTON_NOT_FOUND',
          { text: params.text, selector: params.selector }
        );
      }

      return {
        success: true,
        data: {
          clicked: true,
          selector,
          currentUrl: page.url(),
          pageTitle: await page.title(),
        },
      };
    } catch (error) {
      throw new MCPUIError(
        'Click button failed',
        'E_CLICK_FAILED',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleRunFlow(params: RunFlowParams): Promise<MCPToolResult> {
    const errors: any[] = [];
    const steps: any[] = [];

    try {
      // Step 1: Navigate if URL provided
      if (params.url) {
        steps.push({ step: 'navigate', status: 'starting' });
        const navResult = await this.handleNavigate({ url: params.url });
        if (!navResult.success) {
          errors.push({
            step: 'navigate',
            error: 'Navigation failed - page might be 404',
            details: navResult.data
          });
        }
        steps.push({ step: 'navigate', status: 'completed', url: params.url });
      }

      // Step 2: Analyze UI
      steps.push({ step: 'analyze', status: 'starting' });
      const analysis = await this.driver.snapshot();
      steps.push({
        step: 'analyze',
        status: 'completed',
        found: {
          forms: analysis.forms.length,
          buttons: analysis.buttons.length,
          inputs: analysis.inputs.length
        }
      });

      // Step 3: Check if this is a button click goal
      const isButtonGoal = params.goal.toLowerCase().includes('click') ||
                          params.goal.toLowerCase().includes('button') ||
                          params.goal.toLowerCase().includes('link');

      if (isButtonGoal) {
        // Extract button text from goal
        const buttonMatch = params.goal.match(/["']([^"']+)["']/) ||
                           params.goal.match(/(?:click|press)\s+(?:the\s+)?([\w\s]+?)(?:\s+button|\s+link|$)/i);

        if (buttonMatch) {
          const buttonText = buttonMatch[1];
          steps.push({ step: 'click_button', status: 'starting', target: buttonText });

          const clickResult = await this.handleClickButton({ text: buttonText });
          steps.push({ step: 'click_button', status: 'completed', result: clickResult.data });

          return {
            success: true,
            data: {
              goal: params.goal,
              steps,
              result: 'completed',
              clickResult: clickResult.data
            }
          };
        }
      }

      // Step 4: Form-based flow
      steps.push({ step: 'infer_form', status: 'starting' });
      const inference = await formInferenceEngine.inferForm(analysis, {
        goal: params.goal,
      });

      if (inference.confidence < 0.3) {
        errors.push({
          step: 'infer_form',
          error: 'Low confidence form inference',
          confidence: inference.confidence,
          goal: params.goal,
          availableForms: analysis.forms.length
        });
      }
      steps.push({
        step: 'infer_form',
        status: 'completed',
        confidence: inference.confidence,
        fields: inference.formSchema.fields.length
      });

      // Step 5: Execute flow
      steps.push({ step: 'execute', status: 'starting' });
      const page = await this.driver.getPage();
      const testRun = await flowEngine.executeFlow(
        page,
        inference.formSchema,
        undefined
      );

      // Store test run
      this.testRuns.set(testRun.runId, testRun);

      steps.push({ step: 'execute', status: 'completed', runId: testRun.runId });

      return {
        success: true,
        data: {
          ...testRun,
          steps,
          errors
        },
      };
    } catch (error) {
      const errorDetails = {
        message: error instanceof Error ? error.message : String(error),
        steps,
        errors,
        lastStep: steps[steps.length - 1]
      };

      throw new MCPUIError(
        `Flow execution failed at step: ${errorDetails.lastStep?.step || 'unknown'}. ${errorDetails.message}`,
        'E_FLOW_EXECUTION',
        errorDetails
      );
    }
  }

  private async handleAssertSelectors(params: any): Promise<MCPToolResult> {
    try {
      const page = await this.driver.getPage();
      const results: any[] = [];
      const failures: any[] = [];

      for (const assertion of params.assertions) {
        try {
          const element = page.locator(assertion.selector).first();
          const exists = await element.count() > 0;

          let passed = exists === assertion.exists;

          if (passed && assertion.visible !== undefined) {
            const visible = exists ? await element.isVisible() : false;
            passed = visible === assertion.visible;
          }

          if (passed && assertion.textMatches && exists) {
            const text = await element.textContent();
            const regex = new RegExp(assertion.textMatches);
            passed = regex.test(text || '');
          }

          const result = {
            selector: assertion.selector,
            expected: assertion,
            actual: {
              exists,
              visible: exists ? await element.isVisible() : false,
              text: exists ? await element.textContent() : null,
            },
            passed,
          };

          results.push(result);

          if (!passed) {
            failures.push(result);
          }
        } catch (error) {
          const result = {
            selector: assertion.selector,
            expected: assertion,
            actual: null,
            passed: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };

          results.push(result);
          failures.push(result);
        }
      }

      return {
        success: failures.length === 0,
        data: {
          pass: failures.length === 0,
          results,
          failures,
        },
      };
    } catch (error) {
      throw new MCPUIError('Selector assertion failed', 'E_ASSERT_SELECTORS', error);
    }
  }

  private async handleCollectErrors(params: any): Promise<MCPToolResult> {
    try {
      const types = params.types || ['console', 'network', 'validation'];
      const errors: any[] = [];

      if (types.includes('console')) {
        const consoleErrors = await this.driver.collectConsoleErrors();
        errors.push(
          ...consoleErrors.map(error => ({
            type: 'console' as const,
            message: error,
            code: 'E_CONSOLE',
            timestamp: new Date().toISOString(),
          }))
        );
      }

      if (types.includes('network')) {
        const networkErrors = await this.driver.collectNetworkErrors();
        errors.push(
          ...networkErrors.map(error => ({
            type: 'network' as const,
            message: `${error.status} ${error.statusText}`,
            code: 'E_NETWORK',
            evidence: {
              request: {
                method: 'GET',
                url: error.url,
                status: error.status,
              },
            },
            timestamp: error.timestamp,
          }))
        );
      }

      if (types.includes('validation')) {
        // Validation errors would be collected during form execution
        // This is a placeholder for standalone validation error collection
        const page = await this.driver.getPage();
        const validationErrors = await this.collectPageValidationErrors(page);
        errors.push(...validationErrors);
      }

      return {
        success: true,
        data: {
          errors,
        },
      };
    } catch (error) {
      throw new MCPUIError('Error collection failed', 'E_COLLECT_ERRORS', error);
    }
  }

  private async collectPageValidationErrors(page: any): Promise<any[]> {
    const errors: any[] = [];

    try {
      const errorSelectors = [
        '.error',
        '.validation-error',
        '.field-error',
        '[role="alert"]',
        '.alert-danger',
        '.text-danger',
        '.invalid-feedback',
      ];

      for (const selector of errorSelectors) {
        const elements = await page.locator(selector).all();

        for (const element of elements) {
          try {
            if (await element.isVisible()) {
              const text = await element.textContent();
              if (text && text.trim()) {
                errors.push({
                  type: 'validation',
                  selector,
                  message: text.trim(),
                  code: 'E_VALIDATION_RULE',
                  timestamp: new Date().toISOString(),
                });
              }
            }
          } catch (elementError) {
            // Skip this element
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to collect page validation errors', { error });
    }

    return errors;
  }

  private async handleVerifyPage(params: VerifyPageParams): Promise<MCPToolResult> {
    try {
      const page = await this.driver.getPage();
      const result = await verifyPage(page, params);

      return {
        success: result.success,
        data: result,
      };
    } catch (error) {
      throw new MCPUIError(
        'Page verification failed',
        'E_VERIFY_FAILED',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async handleExportReport(params: ExportReportParams): Promise<MCPToolResult> {
    try {
      const testRun = this.testRuns.get(params.runId);

      if (!testRun) {
        throw new MCPUIError(`Test run not found: ${params.runId}`, 'E_RUN_NOT_FOUND');
      }

      let exportData: any;
      let filename: string;

      switch (params.format) {
        case 'json':
          exportData = JSON.stringify(testRun, null, 2);
          filename = `/tmp/test-run-${params.runId}.json`;
          break;

        case 'junit':
          exportData = this.convertToJUnit(testRun);
          filename = `/tmp/test-run-${params.runId}.xml`;
          break;

        case 'allure':
          exportData = this.convertToAllure(testRun);
          filename = `/tmp/test-run-${params.runId}-allure.json`;
          break;

        default:
          throw new MCPUIError(`Unsupported format: ${params.format}`, 'E_UNSUPPORTED_FORMAT');
      }

      // In a real implementation, you would write the file to disk
      // For now, we'll return the data
      return {
        success: true,
        data: {
          path: filename,
          format: params.format,
          data: exportData,
        },
      };
    } catch (error) {
      throw new MCPUIError('Report export failed', 'E_EXPORT_REPORT', error);
    }
  }

  private convertToJUnit(testRun: TestRun): string {
    const testCase = `
      <testcase
        name="UI Test Flow"
        classname="${testRun.target.url}"
        time="${testRun.metrics.totalTimeMs / 1000}"
        ${testRun.result === 'failed' ? `>
        <failure message="${testRun.errors[0]?.message || 'Test failed'}" type="AssertionError">
          ${testRun.errors.map(e => e.message).join('\n')}
        </failure>
      </testcase>` : '/>'
        }
    `;

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite
  name="MCP UI Probe Tests"
  tests="1"
  failures="${testRun.result === 'failed' ? 1 : 0}"
  time="${testRun.metrics.totalTimeMs / 1000}"
>
  ${testCase}
</testsuite>`;
  }

  private convertToAllure(testRun: TestRun): string {
    return JSON.stringify({
      uuid: testRun.runId,
      name: 'UI Test Flow',
      fullName: testRun.target.url,
      status: testRun.result === 'passed' ? 'passed' : 'failed',
      statusDetails: {
        message: testRun.errors[0]?.message,
        trace: testRun.errors.map(e => e.message).join('\n'),
      },
      start: Date.now() - testRun.metrics.totalTimeMs,
      stop: Date.now(),
      steps: testRun.flow.map(step => ({
        name: step.inferredIntent,
        status: step.outcome === 'success' ? 'passed' : 'failed',
        start: Date.now() - step.latencyMs,
        stop: Date.now(),
      })),
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP UI Probe server started');
  }

  async stop(): Promise<void> {
    await this.driver.close();
    logger.info('MCP UI Probe server stopped');
  }
}