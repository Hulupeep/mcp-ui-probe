#!/usr/bin/env node

import 'dotenv/config';
import { writeFileSync } from 'fs';
import { chromium } from 'playwright';
import { ScenarioParser } from './scenarioParser.js';
import { ScenarioExecutor } from './scenarioExecutor.js';
import { ScenarioRunOptions } from '../types/scenario.js';
import logger from '../utils/logger.js';
import { fileURLToPath } from 'url';

const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                     import.meta.url === fileURLToPath(process.argv[1]);

if (isMainModule) {
  runCLI(process.argv.slice(2))
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

interface CLIArgs {
  scenario?: string;
  baseUrl?: string;
  persona?: string;
  timeout?: number;
  retries?: number;
  captureScreenshotOnError?: boolean;
  disableCharts?: boolean;
  headless?: boolean;
  outputReport?: string;
  llm?: 'openai' | 'anthropic' | 'none';
  forceSelectors?: boolean;
  help?: boolean;
}

export async function runCLI(argv: string[]): Promise<number> {
  try {
    const args = parseArgs(argv);

    if (args.help) {
      showHelp();
      return 0;
    }

    if (!args.scenario) {
      console.error('❌ Error: --scenario is required');
      showHelp();
      return 1;
    }

    // Parse scenario
    const scenario = ScenarioParser.parseFile(args.scenario);

    // Validate scenario
    const validation = ScenarioParser.validate(scenario);
    if (!validation.valid) {
      console.error('❌ Scenario validation failed:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
      return 1;
    }

    logger.info('Starting scenario execution', {
      scenario: scenario.name,
      baseUrl: args.baseUrl || scenario.baseUrl
    });

    // Launch browser
    const browser = await chromium.launch({
      headless: args.headless !== false
    });

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Create executor with options
      const options: ScenarioRunOptions = {
        baseUrl: args.baseUrl,
        persona: args.persona,
        timeout: args.timeout,
        retries: args.retries,
        captureScreenshotOnError: args.captureScreenshotOnError,
        disableCharts: args.disableCharts,
        headless: args.headless,
        llm: args.llm,
        forceSelectors: args.forceSelectors
      };

      // Set globals if needed
      if (args.disableCharts) {
        await page.evaluate(() => {
          (window as any).__AMP_DISABLE_CHARTS = true;
        });
      }

      const executor = new ScenarioExecutor(page, options);

      // Execute scenario
      const result = await executor.execute(scenario);

      // Output result as JSON
      const output = JSON.stringify(result, null, 2);
      console.log(output);

      // Save to file if requested
      if (args.outputReport) {
        writeFileSync(args.outputReport, output);
        logger.info('Report saved', { path: args.outputReport });
      }

      // Return appropriate exit code
      return result.status === 'pass' ? 0 : 1;

    } finally {
      await browser.close();
    }

  } catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : String(error));
    logger.error('CLI execution failed', { error });

    // Output error as JSON for consistency
    const errorResult = {
      scenario: 'unknown',
      status: 'fail',
      duration: 0,
      steps: [],
      error: {
        step: 0,
        action: 'initialization',
        reason: error instanceof Error ? error.message : String(error)
      }
    };
    console.log(JSON.stringify(errorResult, null, 2));

    return 1;
  }
}

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--scenario':
        args.scenario = argv[++i];
        break;

      case '--base-url':
        args.baseUrl = argv[++i];
        break;

      case '--persona':
        args.persona = argv[++i];
        break;

      case '--timeout':
        args.timeout = parseInt(argv[++i], 10);
        break;

      case '--retries':
        args.retries = parseInt(argv[++i], 10);
        break;

      case '--capture-screenshot-on-error':
        args.captureScreenshotOnError = true;
        break;

      case '--disable-charts':
        args.disableCharts = true;
        break;

      case '--headless':
        args.headless = argv[i + 1] !== 'false';
        if (argv[i + 1] === 'true' || argv[i + 1] === 'false') i++;
        break;

      case '--output-report':
        args.outputReport = argv[++i];
        break;

      case '--llm':
        args.llm = argv[++i] as 'openai' | 'anthropic' | 'none';
        break;

      case '--force-selectors':
      case '--no-llm':
        args.forceSelectors = true;
        args.llm = 'none';
        break;

      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }

  return args;
}

function showHelp(): void {
  console.log(`
UI-Probe CLI Runner - Deterministic Scenario Execution

Usage: npx mcp-ui-probe run [options]

Options:
  --scenario <path>              Path to scenario YAML/JSON file (required)
  --base-url <url>               Override scenario base URL
  --persona <name>               Specify persona (e.g., clinical, storm)
  --timeout <ms>                 Default timeout in milliseconds (default: 30000)
  --retries <number>             Number of retries per step (default: 1)
  --capture-screenshot-on-error  Capture screenshots on failure
  --disable-charts               Set __AMP_DISABLE_CHARTS global
  --headless [true|false]        Run in headless mode (default: true)
  --output-report <path>         Save JSON report to file
  --llm <provider>               LLM provider: openai|anthropic|none (default: none)
  --no-llm, --force-selectors    Disable LLM, use only direct selectors
  --help, -h                     Show this help message

Examples:
  # Run clinical scenario
  npx mcp-ui-probe run \\
    --scenario scenarios/verifiable-clinical.yaml \\
    --base-url http://localhost:3100

  # Run with custom timeout and retries
  npx mcp-ui-probe run \\
    --scenario scenarios/verifiable-storm.yaml \\
    --timeout 15000 \\
    --retries 3 \\
    --capture-screenshot-on-error

  # Save report to file
  npx mcp-ui-probe run \\
    --scenario scenarios/test.yaml \\
    --output-report /tmp/probe-report.json

Exit Codes:
  0 - Success (all steps passed)
  1 - Failure (one or more steps failed)

Output Format:
  All output is JSON for easy parsing in CI/CD pipelines.

Environment Variables:
  OPENAI_API_KEY              - OpenAI API key (if --llm openai)
  UI_PROBE_FALLBACK_MODE      - Force fallback mode
  LOG_LEVEL                   - Log level (debug|info|warn|error)
`);
}
