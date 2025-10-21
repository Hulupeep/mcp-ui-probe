import { OpenAI } from 'openai';
import { ParsedGoal } from '../types/index.js';
import { GoalParser } from '../utils/goalParser.js';
import logger from '../utils/logger.js';
import { llmValidator } from './validator.js';
import { UsageTracker } from '../monitoring/usageTracker.js';

interface LLMConfig {
  provider?: 'openai' | 'anthropic';
  model?: string;
  maxTokens?: number;
  temperature?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  fallbackMode?: boolean;
  requestTimeout?: number;
  maxRetries?: number;
}

interface ErrorInterpretation {
  likely_cause: string;
  suggestions: string[];
  confidence: number;
}

// Anthropic SDK types (if we add it later)
interface Anthropic {
  messages: {
    create(params: any): Promise<any>;
  };
}

export class LLMStrategy {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private config: LLMConfig;
  private cache: Map<string, { result: any; timestamp: number }>;
  private readonly DEFAULT_CACHE_TTL = 300000; // 5 minutes
  private usageTracker?: UsageTracker;

  constructor(config?: LLMConfig) {
    const fallbackMode = process.env.UI_PROBE_FALLBACK_MODE === 'true';
    const requestTimeout = parseInt(process.env.LLM_REQUEST_TIMEOUT || '60000', 10);
    const maxRetries = parseInt(process.env.LLM_MAX_RETRIES || '2', 10);

    this.config = {
      provider: process.env.OPENAI_API_KEY ? 'openai' : 'anthropic',
      model: 'gpt-4-turbo-preview',
      maxTokens: 1000,
      temperature: 0.3,
      cacheEnabled: true,
      cacheTTL: this.DEFAULT_CACHE_TTL,
      fallbackMode,
      requestTimeout,
      maxRetries,
      ...config
    };

    this.cache = new Map();

    // Initialize API clients only if not in fallback mode
    if (!fallbackMode && process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }

    // Anthropic SDK not installed yet - will add support later
    // if (!fallbackMode && process.env.ANTHROPIC_API_KEY) {
    //   this.anthropic = new Anthropic({
    //     apiKey: process.env.ANTHROPIC_API_KEY
    //   });
    // }

    if (fallbackMode) {
      logger.info('LLMStrategy initialized in fallback mode - using regex parser only');
    }

    // Initialize usage tracker if cost monitoring is enabled
    if (process.env.UI_PROBE_COST_LIMITS !== 'false' && !fallbackMode) {
      this.usageTracker = new UsageTracker();
      logger.info('Usage tracking enabled for cost monitoring');
    }
  }

  async parseGoal(goal: string): Promise<ParsedGoal> {
    // Check if in fallback mode or LLM not available
    if (this.config.fallbackMode || (!this.openai && !this.anthropic)) {
      logger.debug('Using regex parser (fallback mode or no LLM)', { goal });
      return GoalParser.parse(goal);
    }

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getFromCache(goal);
      if (cached) {
        logger.debug('Using cached LLM response for goal', { goal });
        return cached;
      }
    }

    // Retry logic for LLM calls
    const maxRetries = this.config.maxRetries || 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Attempting LLM goal parsing (attempt ${attempt + 1}/${maxRetries + 1})`, { goal });

        const prompt = this.buildGoalParsingPrompt(goal);
        const response = await this.callLLM(prompt, { operation: 'parseGoal' });
        const parsed = JSON.parse(response);

        // Validate and normalize the response
        const result = this.normalizeGoalResponse(parsed);

        // Cache the result
        if (this.config.cacheEnabled) {
          this.addToCache(goal, result);
        }

        logger.debug('LLM goal parsing succeeded', { goal, attempt: attempt + 1 });
        return result;
      } catch (error: any) {
        lastError = error;
        logger.warn(`LLM parsing attempt ${attempt + 1} failed`, {
          error: error.message,
          stack: error.stack,
          response: error.response?.data,
          willRetry: attempt < maxRetries
        });

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000);
          logger.debug(`Waiting ${delayMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // All retries failed, fall back to regex parser
    logger.warn('All LLM parsing attempts failed, falling back to regex parser', {
      error: lastError?.message,
      goal
    });
    return GoalParser.parse(goal);
  }

  async interpretError(error: string, context?: any): Promise<ErrorInterpretation> {
    if (this.config.fallbackMode || (!this.openai && !this.anthropic)) {
      return this.getDefaultErrorInterpretation(error);
    }

    try {
      const prompt = this.buildErrorInterpretationPrompt(error, context);
      const response = await this.callLLM(prompt, { operation: 'interpretError' });
      return JSON.parse(response);
    } catch (err) {
      logger.warn('Error interpretation failed, using default', { err });
      return this.getDefaultErrorInterpretation(error);
    }
  }

  /**
   * Simple text completion for general purposes
   */
  async complete(prompt: string): Promise<string> {
    // Check cost limits
    if (this.usageTracker?.hasExceededMaxCost()) {
      const stats = this.usageTracker.getStats();
      throw new Error(
        `Maximum LLM cost threshold exceeded ($${stats.totalCost.toFixed(2)}). ` +
        `Further LLM operations are blocked.`
      );
    }

    try {
      if (this.config.provider === 'openai' && this.openai) {
        // Add timeout to completion calls
        const timeoutMs = this.config.requestTimeout || 60000;
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`OpenAI completion timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        });

        const completion = await Promise.race([
          this.openai.chat.completions.create({
            model: this.config.model || 'gpt-4-turbo-preview',
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature
          }),
          timeoutPromise
        ]);

        // Record token usage
        if (this.usageTracker && completion.usage) {
          this.usageTracker.recordUsage(
            'complete',
            completion,
            this.config.model || 'gpt-4-turbo-preview',
            'openai'
          );
        }

        return completion.choices[0]?.message?.content || '';
      }

      // Fallback for when no LLM is configured
      return '';
    } catch (error) {
      logger.warn('LLM completion failed', { error });
      return '';
    }
  }

  async suggestAlternatives(failedSelector: string, pageContent: string): Promise<string[]> {
    if (this.config.fallbackMode || (!this.openai && !this.anthropic)) {
      return this.getDefaultAlternatives(failedSelector);
    }

    try {
      const prompt = this.buildAlternativeSelectorPrompt(failedSelector, pageContent);
      const response = await this.callLLM(prompt, { operation: 'suggestAlternatives' });
      const result = JSON.parse(response);
      return result.alternatives || [];
    } catch (error) {
      logger.warn('Alternative suggestion failed, using defaults', { error });
      return this.getDefaultAlternatives(failedSelector);
    }
  }

  /**
   * Public LLM call method with configurable options
   * Used by autonomous agent system for strategic planning and investigation
   */
  public async callLLM(
    prompt: string,
    options: {
      response_format?: { type: 'json_object' };
      temperature?: number;
      operation?: string;
    } = {}
  ): Promise<string> {
    const operation = options.operation || 'llm_call';
    // Check if we've exceeded cost limits before making the call
    if (this.usageTracker?.hasExceededMaxCost()) {
      const stats = this.usageTracker.getStats();
      throw new Error(
        `Maximum LLM cost threshold exceeded ($${stats.totalCost.toFixed(2)}). ` +
        `Further LLM operations are blocked. Set UI_PROBE_MAX_COST higher or reset usage tracking.`
      );
    }

    if (this.config.provider === 'openai' && this.openai) {
      // Create timeout promise
      const timeoutMs = this.config.requestTimeout || 60000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`OpenAI API call timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // Race between API call and timeout
      const completion = await Promise.race([
        this.openai.chat.completions.create({
          model: this.config.model || 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a UI testing assistant. Return only valid JSON responses without any markdown formatting or code blocks.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: this.config.maxTokens,
          temperature: options.temperature ?? this.config.temperature,
          response_format: options.response_format ? { type: "json_object" as const } : { type: "json_object" as const },
          stream: false // Ensure non-streaming response
        }),
        timeoutPromise
      ]);

      // Record token usage
      if (this.usageTracker && 'usage' in completion && completion.usage) {
        this.usageTracker.recordUsage(
          operation,
          completion as any,
          this.config.model || 'gpt-4-turbo-preview',
          'openai'
        );
      }

      const content = ('choices' in completion) ? completion.choices[0]?.message?.content || '{}' : '{}';

      // Clean up response if it contains markdown code blocks
      let cleaned = content;
      if (content.includes('```')) {
        const jsonMatch = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
        if (jsonMatch) {
          cleaned = jsonMatch[1];
        }
      }

      return cleaned;
    }

    if (this.config.provider === 'anthropic' && this.anthropic) {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: this.config.maxTokens || 1000,
        messages: [
          {
            role: 'user',
            content: `You are a UI testing assistant. Return only valid JSON responses.\n\n${prompt}`
          }
        ]
      });

      return message.content[0]?.text || '{}';
    }

    throw new Error('No LLM provider available');
  }

  private buildGoalParsingPrompt(goal: string): string {
    return `Parse this UI testing goal into structured actions:
"${goal}"

CRITICAL INSTRUCTIONS:
- "Sign up" or "Create account" means navigate to the REGISTRATION/SIGNUP page
- "Sign in" or "Log in" means navigate to the LOGIN page
- Be very careful to distinguish between these two different actions
- Look for contextual clues: "new account", "register", "join" = sign up

Return JSON with one of these structures:

For single actions:
{
  "action": "click" | "navigate" | "fill" | "assert" | "wait",
  "target": "selector or description",
  "targetType": "button" | "link" | "input" | "element",
  "value": "for fill actions",
  "url": "for navigate actions",
  "formData": { "field": "value" },
  "submit": true/false,
  "metadata": { "confidence": 0-1 }
}

For multi-step sequences:
{
  "action": "sequence",
  "steps": [array of action objects above]
}

Examples:
"Sign up for a new account" -> {"action": "navigate", "url": "/signup", "metadata": {"intent": "registration"}}
"Sign in to my account" -> {"action": "navigate", "url": "/login", "metadata": {"intent": "authentication"}}
"Click the Login button" -> {"action": "click", "target": "Login", "targetType": "button"}
"Fill email with test@example.com" -> {"action": "fill", "target": "email", "value": "test@example.com"}
"Navigate to /signup, fill the form, and submit" -> {"action": "sequence", "steps": [...]}`;
  }

  private buildErrorInterpretationPrompt(error: string, context?: any): string {
    return `Analyze this UI testing error and suggest recovery strategies:

Error: ${error}
Context: ${JSON.stringify(context || {})}

Return JSON:
{
  "likely_cause": "brief explanation",
  "suggestions": ["suggestion 1", "suggestion 2", ...],
  "confidence": 0-1
}`;
  }

  private buildAlternativeSelectorPrompt(failedSelector: string, pageContent: string): string {
    const truncatedContent = pageContent.substring(0, 2000); // Limit content size

    return `The selector "${failedSelector}" failed to find an element.

Page content snippet:
${truncatedContent}

Suggest alternative selectors that might work. Return JSON:
{
  "alternatives": ["selector1", "selector2", "selector3"]
}`;
  }

  private normalizeGoalResponse(response: any): ParsedGoal {
    // Ensure the response matches our ParsedGoal interface
    const normalized: ParsedGoal = {
      action: response.action || 'unknown',
      target: response.target,
      targetType: response.targetType,
      value: response.value,
      url: response.url,
      formData: response.formData,
      submit: response.submit,
      steps: response.steps,
      metadata: response.metadata || {}
    };

    // Remove undefined properties
    Object.keys(normalized).forEach(key => {
      if (normalized[key as keyof ParsedGoal] === undefined) {
        delete normalized[key as keyof ParsedGoal];
      }
    });

    return normalized;
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > (this.config.cacheTTL || this.DEFAULT_CACHE_TTL)) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  private addToCache(key: string, result: any): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });

    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  private getDefaultErrorInterpretation(error: string): ErrorInterpretation {
    const suggestions: string[] = [];

    if (error.includes('not found') || error.includes('no such element')) {
      suggestions.push(
        'Element may not be loaded yet - add wait',
        'Check if selector is correct',
        'Element might be in an iframe',
        'Page structure may have changed'
      );
    }

    if (error.includes('timeout')) {
      suggestions.push(
        'Increase timeout duration',
        'Check network connectivity',
        'Verify page URL is correct'
      );
    }

    if (error.includes('not clickable') || error.includes('intercepted')) {
      suggestions.push(
        'Element may be covered by another element',
        'Wait for overlays to disappear',
        'Try scrolling element into view'
      );
    }

    return {
      likely_cause: 'Element interaction failed',
      suggestions,
      confidence: 0.5
    };
  }

  private getDefaultAlternatives(selector: string): string[] {
    const alternatives: string[] = [];

    // Extract key parts from the selector
    if (selector.includes('[text=')) {
      const text = selector.match(/\[text="?([^"\]]+)"?\]/)?.[1];
      if (text) {
        alternatives.push(
          `button:contains("${text}")`,
          `a:contains("${text}")`,
          `[aria-label*="${text}"]`
        );
      }
    }

    if (selector.includes('#')) {
      const id = selector.match(/#([^\s\[]+)/)?.[1];
      if (id) {
        alternatives.push(
          `[id="${id}"]`,
          `[name="${id}"]`,
          `[data-testid="${id}"]`
        );
      }
    }

    if (selector.includes('.')) {
      const className = selector.match(/\.([^\s\[]+)/)?.[1];
      if (className) {
        alternatives.push(
          `[class*="${className}"]`,
          `div.${className}`,
          `button.${className}`
        );
      }
    }

    return alternatives;
  }

  /**
   * Get the usage tracker instance (for accessing cost monitoring data)
   */
  getUsageTracker(): UsageTracker | undefined {
    return this.usageTracker;
  }
}