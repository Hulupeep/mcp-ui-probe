import { OpenAI } from 'openai';
import { ParsedGoal } from '../types/index.js';
import { GoalParser } from '../utils/goalParser.js';
import logger from '../utils/logger.js';

interface LLMConfig {
  provider?: 'openai' | 'anthropic';
  model?: string;
  maxTokens?: number;
  temperature?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
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

  constructor(config?: LLMConfig) {
    this.config = {
      provider: process.env.OPENAI_API_KEY ? 'openai' : 'anthropic',
      model: 'gpt-4-turbo-preview',
      maxTokens: 1000,
      temperature: 0.3,
      cacheEnabled: true,
      cacheTTL: this.DEFAULT_CACHE_TTL,
      ...config
    };

    this.cache = new Map();

    // Initialize API clients
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }

    // Anthropic SDK not installed yet - will add support later
    // if (process.env.ANTHROPIC_API_KEY) {
    //   this.anthropic = new Anthropic({
    //     apiKey: process.env.ANTHROPIC_API_KEY
    //   });
    // }
  }

  async parseGoal(goal: string): Promise<ParsedGoal> {
    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getFromCache(goal);
      if (cached) {
        logger.debug('Using cached LLM response for goal', { goal });
        return cached;
      }
    }

    // Fall back to regex parser if no API keys available
    if (!this.openai && !this.anthropic) {
      logger.info('No LLM API keys configured, using regex parser');
      return GoalParser.parse(goal);
    }

    try {
      const prompt = this.buildGoalParsingPrompt(goal);
      const response = await this.callLLM(prompt);
      const parsed = JSON.parse(response);

      // Validate and normalize the response
      const result = this.normalizeGoalResponse(parsed);

      // Cache the result
      if (this.config.cacheEnabled) {
        this.addToCache(goal, result);
      }

      return result;
    } catch (error: any) {
      logger.error('LLM parsing failed, falling back to regex', {
        error: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      return GoalParser.parse(goal);
    }
  }

  async interpretError(error: string, context?: any): Promise<ErrorInterpretation> {
    if (!this.openai && !this.anthropic) {
      return this.getDefaultErrorInterpretation(error);
    }

    try {
      const prompt = this.buildErrorInterpretationPrompt(error, context);
      const response = await this.callLLM(prompt);
      return JSON.parse(response);
    } catch (err) {
      logger.error('Error interpretation failed', { err });
      return this.getDefaultErrorInterpretation(error);
    }
  }

  /**
   * Simple text completion for general purposes
   */
  async complete(prompt: string): Promise<string> {
    try {
      if (this.config.provider === 'openai' && this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: this.config.model || 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature
        });

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
    if (!this.openai && !this.anthropic) {
      return this.getDefaultAlternatives(failedSelector);
    }

    try {
      const prompt = this.buildAlternativeSelectorPrompt(failedSelector, pageContent);
      const response = await this.callLLM(prompt);
      const result = JSON.parse(response);
      return result.alternatives || [];
    } catch (error) {
      logger.error('Alternative suggestion failed', { error });
      return this.getDefaultAlternatives(failedSelector);
    }
  }

  private async callLLM(prompt: string): Promise<string> {
    if (this.config.provider === 'openai' && this.openai) {
      const completion = await this.openai.chat.completions.create({
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
        temperature: this.config.temperature,
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0]?.message?.content || '{}';

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
}