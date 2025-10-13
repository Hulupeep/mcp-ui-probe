import { chromium } from 'playwright';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger.js';
import { llmValidator } from '../llm/validator.js';

const execAsync = promisify(exec);

export interface HealthCheckResult {
  browserInstalled: boolean;
  browserVersion: string | null;
  playwrightVersion: string;
  canLaunchBrowser: boolean;
  canAccessLocalhost: boolean;
  displayAvailable: boolean;
  llm: {
    available: boolean;
    provider: 'openai' | 'anthropic' | 'none';
    error: string | null;
    quota: {
      used: number | null;
      limit: number | null;
      remaining: number | null;
    };
    estimatedCostPerTest: string;
  };
  features: {
    basicNavigation: boolean;
    intelligentWorkflows: boolean;
    formInference: boolean;
    errorEnhancement: boolean;
  };
  systemInfo: {
    platform: string;
    arch: string;
    nodeVersion: string;
    memory: {
      total: number;
      free: number;
    };
  };
  browserCapabilities: {
    headless: boolean | null;
    headlessSuccess: boolean;
    launchAttempts: number;
    launchErrors: string[];
  };
  recommendations: string[];
}

export async function performHealthCheck(): Promise<HealthCheckResult> {
  // Validate LLM first
  const llmHealth = await llmValidator.getLLMHealth();

  const result: HealthCheckResult = {
    browserInstalled: false,
    browserVersion: null,
    playwrightVersion: require('playwright/package.json').version,
    canLaunchBrowser: false,
    canAccessLocalhost: false,
    displayAvailable: !!process.env.DISPLAY,
    llm: {
      available: llmHealth.available,
      provider: llmHealth.provider,
      error: llmHealth.error,
      quota: llmHealth.quota,
      estimatedCostPerTest: llmHealth.estimatedCostPerTest
    },
    features: llmHealth.features,
    systemInfo: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: {
        total: require('os').totalmem(),
        free: require('os').freemem()
      }
    },
    browserCapabilities: {
      headless: null,
      headlessSuccess: false,
      launchAttempts: 0,
      launchErrors: []
    },
    recommendations: []
  };

  // Check if Chromium is installed
  try {
    const { stdout } = await execAsync('npx playwright --version');
    result.browserInstalled = stdout.includes('Version');
    logger.debug('Playwright version check', { stdout });
  } catch (error: any) {
    result.browserInstalled = false;
    result.recommendations.push('Run: npx playwright install chromium');
    logger.warn('Playwright version check failed', { error: error.message });
  }

  // Try to launch browser with different configurations
  const launchConfigs = [
    { headless: false, name: 'headed' },
    { headless: true, name: 'headless' }
  ];

  for (const config of launchConfigs) {
    result.browserCapabilities.launchAttempts++;

    try {
      logger.debug(`Attempting browser launch: ${config.name}`, config);

      const browser = await chromium.launch({
        headless: config.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        timeout: 10000
      });

      result.canLaunchBrowser = true;
      result.browserVersion = browser.version();
      result.browserCapabilities.headless = config.headless;

      if (config.headless) {
        result.browserCapabilities.headlessSuccess = true;
      }

      // Test localhost accessibility
      try {
        const context = await browser.newContext();
        const page = await context.newPage();

        // Try to access a simple data URL
        await page.goto('data:text/html,<h1>Health Check</h1>', {
          waitUntil: 'domcontentloaded',
          timeout: 5000
        });

        result.canAccessLocalhost = true;

        await page.close();
        await context.close();
      } catch (navError: any) {
        logger.warn('Localhost navigation test failed', { error: navError.message });
        result.browserCapabilities.launchErrors.push(`Navigation failed: ${navError.message}`);
      }

      await browser.close();

      // If we successfully launched, break the loop
      break;
    } catch (error: any) {
      logger.warn(`Browser launch failed: ${config.name}`, { error: error.message });
      result.browserCapabilities.launchErrors.push(`${config.name}: ${error.message}`);

      // Continue to try next configuration
      continue;
    }
  }

  // Generate recommendations based on results

  // LLM recommendations
  if (!result.llm.available) {
    if (result.llm.provider === 'none') {
      result.recommendations.push('⚠️  No LLM API key configured - running with basic features only');
      result.recommendations.push('💡 Set OPENAI_API_KEY for intelligent workflows, form inference, and error enhancement');
      result.recommendations.push('📖 Get API key: https://platform.openai.com/api-keys');
      result.recommendations.push(`💰 Estimated cost: ${result.llm.estimatedCostPerTest} per test`);
    } else {
      result.recommendations.push(`❌ ${result.llm.provider.toUpperCase()} API key is invalid: ${result.llm.error}`);
      result.recommendations.push('🔧 Verify API key: https://platform.openai.com/api-keys');
      result.recommendations.push('💳 Check billing: https://platform.openai.com/billing');
      result.recommendations.push('📊 Check usage: https://platform.openai.com/usage');
    }
  } else {
    result.recommendations.push(`✅ LLM available (${result.llm.provider.toUpperCase()}) - all features enabled`);
  }

  // Browser recommendations
  if (!result.browserInstalled) {
    result.recommendations.push('Install Playwright browsers: npx playwright install chromium');
  }

  if (!result.canLaunchBrowser) {
    result.recommendations.push('Browser launch failed. Check system dependencies.');

    if (process.platform === 'linux') {
      result.recommendations.push(
        'Install Linux dependencies: sudo apt-get install libgbm1 libnss3 libatk-bridge2.0-0 libgtk-3-0'
      );
    }
  }

  if (!result.displayAvailable && !result.browserCapabilities.headlessSuccess) {
    result.recommendations.push('No DISPLAY available. Ensure headless mode is supported.');
  }

  if (result.canLaunchBrowser && !result.canAccessLocalhost) {
    result.recommendations.push('Browser launches but cannot access pages. Check network settings.');
  }

  if (result.systemInfo.memory.free < 500 * 1024 * 1024) {
    result.recommendations.push('Low system memory. Browser may fail to launch or run slowly.');
  }

  // Fallback mode recommendation
  if (!result.llm.available && process.env.UI_PROBE_FALLBACK_MODE !== 'true') {
    result.recommendations.push('💡 Set UI_PROBE_FALLBACK_MODE=true to suppress LLM warnings');
  }

  if (result.recommendations.length === 0) {
    result.recommendations.push('All health checks passed! UI-Probe should work correctly.');
  }

  return result;
}

export async function getSystemDiagnostics(): Promise<any> {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      UI_PROBE_DEBUG: process.env.UI_PROBE_DEBUG,
      DISPLAY: process.env.DISPLAY,
      HOME: process.env.HOME,
      PATH: process.env.PATH
    },
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    }
  };

  // Try to get additional system info
  if (process.platform === 'linux') {
    try {
      const { stdout: osRelease } = await execAsync('cat /etc/os-release');
      diagnostics.osRelease = osRelease;
    } catch (error) {
      // Ignore
    }

    try {
      const { stdout: packages } = await execAsync(
        'dpkg -l | grep -E "(chromium|libgbm|libnss3|libatk)" | head -20'
      );
      diagnostics.installedPackages = packages.split('\n').filter(Boolean);
    } catch (error) {
      // Ignore
    }
  }

  return diagnostics;
}