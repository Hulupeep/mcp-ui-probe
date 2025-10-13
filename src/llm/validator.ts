import { OpenAI } from 'openai';
import logger from '../utils/logger.js';

export interface LLMValidationResult {
  available: boolean;
  provider: 'openai' | 'anthropic' | 'none';
  error: string | null;
  quota: {
    used: number | null;
    limit: number | null;
    remaining: number | null;
  };
  estimatedCostPerTest: string;
  configuredKey: boolean;
  keyValid: boolean;
  features: {
    basicNavigation: boolean;
    intelligentWorkflows: boolean;
    formInference: boolean;
    errorEnhancement: boolean;
  };
}

export class LLMValidator {
  private validationCache: LLMValidationResult | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache

  /**
   * Validate LLM configuration on startup
   * Throws clear errors if LLM is required but not configured
   */
  async validateLLMConfig(): Promise<LLMValidationResult> {
    // Check cache first
    if (this.validationCache && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.validationCache;
    }

    const result: LLMValidationResult = {
      available: false,
      provider: 'none',
      error: null,
      quota: {
        used: null,
        limit: null,
        remaining: null
      },
      estimatedCostPerTest: '$0.01-0.10',
      configuredKey: false,
      keyValid: false,
      features: {
        basicNavigation: true, // Always available via Playwright
        intelligentWorkflows: false,
        formInference: false,
        errorEnhancement: false
      }
    };

    // Check if fallback mode is enabled
    const fallbackMode = process.env.UI_PROBE_FALLBACK_MODE === 'true';
    if (fallbackMode) {
      logger.info('UI-Probe running in fallback mode (LLM features disabled)');
      result.provider = 'none';
      result.error = 'Fallback mode enabled - LLM features disabled';
      this.validationCache = result;
      this.cacheTimestamp = Date.now();
      return result;
    }

    // Check for OpenAI API key
    if (process.env.OPENAI_API_KEY) {
      result.configuredKey = true;
      result.provider = 'openai';

      try {
        const validation = await this.testOpenAIConnection();
        result.keyValid = validation.valid;
        result.available = validation.valid;
        result.error = validation.error;
        result.quota = validation.quota;

        if (validation.valid) {
          result.features.intelligentWorkflows = true;
          result.features.formInference = true;
          result.features.errorEnhancement = true;
        }
      } catch (error) {
        result.keyValid = false;
        result.error = error instanceof Error ? error.message : 'Unknown error validating OpenAI key';
        logger.error('OpenAI validation failed', { error });
      }
    }
    // Check for Anthropic API key
    else if (process.env.ANTHROPIC_API_KEY) {
      result.configuredKey = true;
      result.provider = 'anthropic';
      result.error = 'Anthropic support not yet implemented';
      logger.warn('Anthropic API key detected but support not yet implemented');
    }
    // No API key configured
    else {
      result.provider = 'none';
      result.error = 'No LLM API key configured';
    }

    this.validationCache = result;
    this.cacheTimestamp = Date.now();

    return result;
  }

  /**
   * Test OpenAI API connection with a minimal request
   */
  async testOpenAIConnection(): Promise<{
    valid: boolean;
    error: string | null;
    quota: { used: number | null; limit: number | null; remaining: number | null };
  }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        valid: false,
        error: 'No OpenAI API key configured',
        quota: { used: null, limit: null, remaining: null }
      };
    }

    try {
      const openai = new OpenAI({ apiKey });

      // Make a minimal API call to verify access
      // This is the cheapest possible call - just list models
      const models = await openai.models.list();

      // Check if we can access GPT-4 models
      const hasGPT4 = models.data.some(m => m.id.includes('gpt-4'));

      if (!hasGPT4) {
        logger.warn('OpenAI API key valid but no GPT-4 access detected');
      }

      return {
        valid: true,
        error: null,
        quota: {
          used: null, // OpenAI doesn't provide quota info in API responses
          limit: null,
          remaining: null
        }
      };
    } catch (error: any) {
      let errorMessage = 'Unknown error';

      if (error.status === 401) {
        errorMessage = 'Invalid API key - authentication failed';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded or quota exhausted';
      } else if (error.status === 403) {
        errorMessage = 'API key does not have required permissions';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot connect to OpenAI API - check network connection';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        valid: false,
        error: errorMessage,
        quota: { used: null, limit: null, remaining: null }
      };
    }
  }

  /**
   * Get detailed LLM health status
   */
  async getLLMHealth(): Promise<LLMValidationResult> {
    return this.validateLLMConfig();
  }

  /**
   * Check if LLM is available and throw error if required
   * @param required - If true, throws error when LLM not available
   */
  async ensureLLMAvailable(required: boolean = false): Promise<boolean> {
    const validation = await this.validateLLMConfig();

    if (required && !validation.available) {
      const error = this.buildLLMRequiredError(validation);
      throw error;
    }

    return validation.available;
  }

  /**
   * Build a detailed error when LLM is required but not available
   */
  private buildLLMRequiredError(validation: LLMValidationResult): Error {
    const lines: string[] = [
      '',
      '⚠️  UI-Probe LLM Features Not Available',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ''
    ];

    if (!validation.configuredKey) {
      lines.push('❌ No API key configured');
      lines.push('');
      lines.push('UI-Probe requires an OpenAI or Anthropic API key for intelligent features.');
      lines.push('');
      lines.push('To get started:');
      lines.push('  1. Get an API key: https://platform.openai.com/api-keys');
      lines.push('  2. Set environment variable: export OPENAI_API_KEY=sk-...');
      lines.push('  3. Restart UI-Probe');
      lines.push('');
      lines.push(`Estimated cost: ${validation.estimatedCostPerTest} per test`);
    } else if (!validation.keyValid) {
      lines.push(`❌ ${validation.provider.toUpperCase()} API key is invalid`);
      lines.push('');
      lines.push(`Error: ${validation.error}`);
      lines.push('');
      lines.push('To fix:');
      lines.push('  1. Verify your API key: https://platform.openai.com/api-keys');
      lines.push('  2. Check billing: https://platform.openai.com/billing');
      lines.push('  3. Check usage: https://platform.openai.com/usage');
      lines.push('  4. Generate a new key if needed');
    }

    lines.push('');
    lines.push('Alternative options:');
    lines.push('  • Use Playwright directly for basic browser automation (free)');
    lines.push('  • Set UI_PROBE_FALLBACK_MODE=true for basic features without LLM');
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const error = new Error(lines.join('\n'));
    error.name = 'LLMRequiredError';
    return error;
  }

  /**
   * Clear validation cache (useful for testing or when env changes)
   */
  clearCache(): void {
    this.validationCache = null;
    this.cacheTimestamp = 0;
  }
}

// Singleton instance
export const llmValidator = new LLMValidator();