// Simplified MCP Server implementation for demonstration
import { PlaywrightDriver } from '../drivers/playwright.js';
import { formInferenceEngine } from '../infer/form.js';
import { flowEngine } from '../flows/flowEngine.js';
import logger from '../utils/logger.js';

interface MCPToolRequest {
  name: string;
  arguments: Record<string, any>;
}

interface MCPToolResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class SimpleMCPServer {
  private driver: PlaywrightDriver;
  private testRuns: Map<string, any> = new Map();

  constructor() {
    this.driver = new PlaywrightDriver();
  }

  async handleToolCall(request: MCPToolRequest): Promise<MCPToolResponse> {
    const { name, arguments: args } = request;

    try {
      logger.info('Tool called', { toolName: name, args });

      switch (name) {
        case 'navigate':
          return await this.handleNavigate(args);

        case 'analyze_ui':
          return await this.handleAnalyzeUI(args);

        case 'infer_form':
          return await this.handleInferForm(args);

        case 'fill_and_submit':
          return await this.handleFillAndSubmit(args);

        case 'run_flow':
          return await this.handleRunFlow(args);

        case 'assert_selectors':
          return await this.handleAssertSelectors(args);

        case 'collect_errors':
          return await this.handleCollectErrors(args);

        case 'export_report':
          return await this.handleExportReport(args);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error('Tool execution failed', { toolName: name, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleNavigate(params: any): Promise<MCPToolResponse> {
    await this.driver.navigate(params.url, params.waitUntil);
    const page = await this.driver.getPage();
    const currentUrl = page.url();

    return {
      success: true,
      data: {
        ok: true,
        currentUrl,
      },
    };
  }

  private async handleAnalyzeUI(_params: any): Promise<MCPToolResponse> {
    const analysis = await this.driver.snapshot();
    return {
      success: true,
      data: analysis,
    };
  }

  private async handleInferForm(params: any): Promise<MCPToolResponse> {
    const analysis = await this.driver.snapshot();
    const inference = await formInferenceEngine.inferForm(analysis, {
      goal: params.goal,
      hints: params.hints,
    });

    return {
      success: true,
      data: inference,
    };
  }

  private async handleFillAndSubmit(params: any): Promise<MCPToolResponse> {
    const page = await this.driver.getPage();
    const testRun = await flowEngine.executeFlow(
      page,
      params.formSchema,
      params.overrides
    );

    this.testRuns.set(testRun.runId, testRun);

    return {
      success: true,
      data: testRun,
    };
  }

  private async handleRunFlow(params: any): Promise<MCPToolResponse> {
    if (params.url) {
      await this.driver.navigate(params.url);
    }

    const analysis = await this.driver.snapshot();
    const inference = await formInferenceEngine.inferForm(analysis, {
      goal: params.goal,
    });

    if (inference.confidence < 0.3) {
      logger.warn('Low confidence form inference', {
        goal: params.goal,
        confidence: inference.confidence,
      });
    }

    const page = await this.driver.getPage();
    const testRun = await flowEngine.executeFlow(
      page,
      inference.formSchema,
      undefined
    );

    this.testRuns.set(testRun.runId, testRun);

    return {
      success: true,
      data: testRun,
    };
  }

  private async handleAssertSelectors(params: any): Promise<MCPToolResponse> {
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
  }

  private async handleCollectErrors(params: any): Promise<MCPToolResponse> {
    const types = params.types || ['console', 'network', 'validation'];
    const errors: any[] = [];

    if (types.includes('console')) {
      const consoleErrors = await this.driver.collectConsoleErrors();
      errors.push(
        ...consoleErrors.map(error => ({
          type: 'console',
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
          type: 'network',
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

    return {
      success: true,
      data: {
        errors,
      },
    };
  }

  private async handleExportReport(params: any): Promise<MCPToolResponse> {
    const testRun = this.testRuns.get(params.runId);

    if (!testRun) {
      throw new Error(`Test run not found: ${params.runId}`);
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
        throw new Error(`Unsupported format: ${params.format}`);
    }

    return {
      success: true,
      data: {
        path: filename,
        format: params.format,
        data: exportData,
      },
    };
  }

  private convertToJUnit(testRun: any): string {
    const testCase = `
      <testcase
        name="UI Test Flow"
        classname="${testRun.target.url}"
        time="${testRun.metrics.totalTimeMs / 1000}"
        ${testRun.result === 'failed' ? `>
        <failure message="${testRun.errors[0]?.message || 'Test failed'}" type="AssertionError">
          ${testRun.errors.map((e: any) => e.message).join('\n')}
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

  private convertToAllure(testRun: any): string {
    return JSON.stringify({
      uuid: testRun.runId,
      name: 'UI Test Flow',
      fullName: testRun.target.url,
      status: testRun.result === 'passed' ? 'passed' : 'failed',
      statusDetails: {
        message: testRun.errors[0]?.message,
        trace: testRun.errors.map((e: any) => e.message).join('\n'),
      },
      start: Date.now() - testRun.metrics.totalTimeMs,
      stop: Date.now(),
      steps: testRun.flow.map((step: any) => ({
        name: step.inferredIntent,
        status: step.outcome === 'success' ? 'passed' : 'failed',
        start: Date.now() - step.latencyMs,
        stop: Date.now(),
      })),
    });
  }

  async close(): Promise<void> {
    await this.driver.close();
    logger.info('MCP UI Probe server stopped');
  }
}

export default SimpleMCPServer;