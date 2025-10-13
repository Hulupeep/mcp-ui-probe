/**
 * Token Counter - Tracks LLM token usage and estimates costs
 *
 * Provides accurate token counting for OpenAI and Anthropic models
 * with cost estimation based on current pricing.
 */

import logger from '../utils/logger.js';

/**
 * Pricing information for different LLM providers
 * Prices are in USD per 1K tokens
 */
export interface ModelPricing {
  provider: 'openai' | 'anthropic';
  model: string;
  inputPricePerK: number;  // Price per 1K input tokens
  outputPricePerK: number; // Price per 1K output tokens
}

/**
 * Token usage for a single operation
 */
export interface TokenUsage {
  operation: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  timestamp: Date;
  model: string;
  provider: 'openai' | 'anthropic';
}

/**
 * Pricing database for common models (as of 2025)
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI GPT-4 models
  'gpt-4-turbo-preview': {
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    inputPricePerK: 0.01,
    outputPricePerK: 0.03
  },
  'gpt-4': {
    provider: 'openai',
    model: 'gpt-4',
    inputPricePerK: 0.03,
    outputPricePerK: 0.06
  },
  'gpt-4-turbo': {
    provider: 'openai',
    model: 'gpt-4-turbo',
    inputPricePerK: 0.01,
    outputPricePerK: 0.03
  },

  // OpenAI GPT-3.5 models
  'gpt-3.5-turbo': {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    inputPricePerK: 0.0005,
    outputPricePerK: 0.0015
  },
  'gpt-3.5-turbo-16k': {
    provider: 'openai',
    model: 'gpt-3.5-turbo-16k',
    inputPricePerK: 0.001,
    outputPricePerK: 0.002
  },

  // Anthropic Claude models
  'claude-3-opus-20240229': {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    inputPricePerK: 0.015,
    outputPricePerK: 0.075
  },
  'claude-3-sonnet-20240229': {
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    inputPricePerK: 0.003,
    outputPricePerK: 0.015
  },
  'claude-3-haiku-20240307': {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    inputPricePerK: 0.00025,
    outputPricePerK: 0.00125
  }
};

export class TokenCounter {
  private sessionUsage: TokenUsage[] = [];
  private sessionStartTime: Date;
  private totalCost: number = 0;

  constructor() {
    this.sessionStartTime = new Date();
  }

  /**
   * Record token usage from an OpenAI API response
   */
  recordOpenAIUsage(
    operation: string,
    response: any,
    model: string = 'gpt-4-turbo-preview'
  ): TokenUsage {
    const usage = response.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (promptTokens + completionTokens);

    const cost = this.calculateCost(promptTokens, completionTokens, model);

    const tokenUsage: TokenUsage = {
      operation,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost: cost,
      timestamp: new Date(),
      model,
      provider: 'openai'
    };

    this.sessionUsage.push(tokenUsage);
    this.totalCost += cost;

    logger.debug('Recorded OpenAI token usage', {
      operation,
      tokens: totalTokens,
      cost: `$${cost.toFixed(4)}`,
      model
    });

    return tokenUsage;
  }

  /**
   * Record token usage from an Anthropic API response
   */
  recordAnthropicUsage(
    operation: string,
    response: any,
    model: string = 'claude-3-sonnet-20240229'
  ): TokenUsage {
    const usage = response.usage || {};
    const promptTokens = usage.input_tokens || 0;
    const completionTokens = usage.output_tokens || 0;
    const totalTokens = promptTokens + completionTokens;

    const cost = this.calculateCost(promptTokens, completionTokens, model);

    const tokenUsage: TokenUsage = {
      operation,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost: cost,
      timestamp: new Date(),
      model,
      provider: 'anthropic'
    };

    this.sessionUsage.push(tokenUsage);
    this.totalCost += cost;

    logger.debug('Recorded Anthropic token usage', {
      operation,
      tokens: totalTokens,
      cost: `$${cost.toFixed(4)}`,
      model
    });

    return tokenUsage;
  }

  /**
   * Estimate token usage when exact count is not available
   * Uses rough approximation: 1 token ≈ 4 characters for English text
   */
  estimateTokens(text: string): number {
    // More accurate estimation considering:
    // - English: ~4 chars per token
    // - Code: ~3 chars per token
    // - Numbers/special chars: ~2 chars per token

    // Simple heuristic: average of 3.5 chars per token
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Record estimated usage when exact token count is unavailable
   */
  recordEstimatedUsage(
    operation: string,
    promptText: string,
    responseText: string,
    model: string = 'gpt-4-turbo-preview'
  ): TokenUsage {
    const promptTokens = this.estimateTokens(promptText);
    const completionTokens = this.estimateTokens(responseText);
    const totalTokens = promptTokens + completionTokens;

    const cost = this.calculateCost(promptTokens, completionTokens, model);

    const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-4-turbo-preview'];

    const tokenUsage: TokenUsage = {
      operation,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost: cost,
      timestamp: new Date(),
      model,
      provider: pricing.provider
    };

    this.sessionUsage.push(tokenUsage);
    this.totalCost += cost;

    logger.debug('Recorded estimated token usage', {
      operation,
      tokens: totalTokens,
      cost: `$${cost.toFixed(4)}`,
      model,
      note: 'estimated'
    });

    return tokenUsage;
  }

  /**
   * Calculate cost based on token usage and model pricing
   */
  private calculateCost(
    promptTokens: number,
    completionTokens: number,
    model: string
  ): number {
    const pricing = MODEL_PRICING[model];

    if (!pricing) {
      logger.warn('Unknown model for pricing, using GPT-4 Turbo pricing', { model });
      const defaultPricing = MODEL_PRICING['gpt-4-turbo-preview'];
      return (
        (promptTokens / 1000) * defaultPricing.inputPricePerK +
        (completionTokens / 1000) * defaultPricing.outputPricePerK
      );
    }

    const inputCost = (promptTokens / 1000) * pricing.inputPricePerK;
    const outputCost = (completionTokens / 1000) * pricing.outputPricePerK;

    return inputCost + outputCost;
  }

  /**
   * Get total tokens used in current session
   */
  getTotalTokens(): number {
    return this.sessionUsage.reduce((sum, usage) => sum + usage.totalTokens, 0);
  }

  /**
   * Get total cost for current session
   */
  getTotalCost(): number {
    return this.totalCost;
  }

  /**
   * Get usage breakdown by operation type
   */
  getUsageByOperation(): Record<string, {
    count: number;
    tokens: number;
    cost: number;
  }> {
    const breakdown: Record<string, { count: number; tokens: number; cost: number }> = {};

    for (const usage of this.sessionUsage) {
      if (!breakdown[usage.operation]) {
        breakdown[usage.operation] = { count: 0, tokens: 0, cost: 0 };
      }

      breakdown[usage.operation].count++;
      breakdown[usage.operation].tokens += usage.totalTokens;
      breakdown[usage.operation].cost += usage.estimatedCost;
    }

    return breakdown;
  }

  /**
   * Get session duration
   */
  getSessionDuration(): number {
    return Date.now() - this.sessionStartTime.getTime();
  }

  /**
   * Get all usage records
   */
  getAllUsage(): TokenUsage[] {
    return [...this.sessionUsage];
  }

  /**
   * Get usage records within a time range
   */
  getUsageInRange(startTime: Date, endTime: Date): TokenUsage[] {
    return this.sessionUsage.filter(
      usage => usage.timestamp >= startTime && usage.timestamp <= endTime
    );
  }

  /**
   * Calculate projected monthly cost based on current usage rate
   */
  estimateMonthlyProjection(): number {
    const sessionDurationMs = this.getSessionDuration();

    if (sessionDurationMs < 60000) {
      // Less than 1 minute of data - not enough for projection
      return 0;
    }

    const monthlyMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    const projectionMultiplier = monthlyMs / sessionDurationMs;

    return this.totalCost * projectionMultiplier;
  }

  /**
   * Reset session statistics
   */
  reset(): void {
    this.sessionUsage = [];
    this.sessionStartTime = new Date();
    this.totalCost = 0;

    logger.info('Token counter reset');
  }

  /**
   * Get model pricing information
   */
  static getModelPricing(model: string): ModelPricing | null {
    return MODEL_PRICING[model] || null;
  }

  /**
   * List all supported models
   */
  static getSupportedModels(): string[] {
    return Object.keys(MODEL_PRICING);
  }
}