import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LLMStrategy } from '../../src/llm/llmStrategy.js';
import { ParsedGoal } from '../../src/types/index.js';

describe('LLMStrategy', () => {
  let strategy: LLMStrategy;

  beforeEach(() => {
    // Mock environment variables
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    strategy = new LLMStrategy();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('parseGoal', () => {
    it('should fall back to regex when no API key', async () => {
      vi.stubEnv('OPENAI_API_KEY', '');
      vi.stubEnv('ANTHROPIC_API_KEY', '');
      const strategyNoKey = new LLMStrategy();

      const result = await strategyNoKey.parseGoal('Click the Login button');

      expect(result).toMatchObject({
        action: 'click',
        target: 'Login',
        targetType: 'button'
      });
    });

    it('should parse navigation goals', async () => {
      const mockResponse = {
        action: 'navigate',
        url: '/login',
        metadata: { confidence: 0.95 }
      };

      // Mock OpenAI response
      vi.spyOn(strategy as any, 'callLLM').mockResolvedValue(JSON.stringify(mockResponse));

      const result = await strategy.parseGoal('Go to the login page');

      expect(result).toMatchObject({
        action: 'navigate',
        url: '/login'
      });
    });

    it('should parse form filling goals', async () => {
      const mockResponse = {
        action: 'fill',
        formData: {
          username: 'testuser',
          password: 'testpass'
        },
        submit: true
      };

      vi.spyOn(strategy as any, 'callLLM').mockResolvedValue(JSON.stringify(mockResponse));

      const result = await strategy.parseGoal('Fill the login form with username testuser and password testpass, then submit');

      expect(result).toMatchObject({
        action: 'fill',
        formData: {
          username: 'testuser',
          password: 'testpass'
        },
        submit: true
      });
    });

    it('should handle complex multi-step goals', async () => {
      const mockResponse = {
        action: 'sequence',
        steps: [
          { action: 'navigate', url: '/signup' },
          { action: 'fill', formData: { email: 'test@example.com' } },
          { action: 'click', target: 'Submit', targetType: 'button' }
        ]
      };

      vi.spyOn(strategy as any, 'callLLM').mockResolvedValue(JSON.stringify(mockResponse));

      const result = await strategy.parseGoal('Navigate to signup, fill email with test@example.com, and submit the form');

      expect(result).toMatchObject({
        action: 'sequence',
        steps: expect.arrayContaining([
          expect.objectContaining({ action: 'navigate' }),
          expect.objectContaining({ action: 'fill' }),
          expect.objectContaining({ action: 'click' })
        ])
      });
    });

    it('should cache repeated queries', async () => {
      const spy = vi.spyOn(strategy as any, 'callLLM').mockResolvedValue(JSON.stringify({ action: 'click', target: 'Login' }));

      await strategy.parseGoal('Click Login');
      await strategy.parseGoal('Click Login'); // Same query

      expect(spy).toHaveBeenCalledTimes(1); // Should use cache for second call
    });

    it('should handle LLM errors gracefully', async () => {
      vi.spyOn(strategy as any, 'callLLM').mockRejectedValue(new Error('API error'));

      const result = await strategy.parseGoal('Click the Login button');

      // Should fall back to regex
      expect(result).toMatchObject({
        action: 'click',
        target: 'Login',
        targetType: 'button'
      });
    });
  });

  describe('interpretError', () => {
    it('should provide recovery suggestions for common errors', async () => {
      const error = 'Element not found: button[text="Login"]';

      const mockResponse = {
        likely_cause: 'Button text may have changed',
        suggestions: [
          'Try searching for "Sign in" instead',
          'Look for login link in navigation',
          'Check if page loaded completely'
        ]
      };

      vi.spyOn(strategy as any, 'callLLM').mockResolvedValue(JSON.stringify(mockResponse));

      const result = await strategy.interpretError(error, { selector: 'button[text="Login"]' });

      expect(result.suggestions).toContain('Try searching for "Sign in" instead');
    });
  });

  describe('suggestAlternatives', () => {
    it('should suggest alternative selectors', async () => {
      const failedSelector = 'button[text="Login"]';
      const pageContent = '<button class="btn-primary">Sign In</button>';

      const mockResponse = {
        alternatives: [
          'button.btn-primary',
          'button:contains("Sign In")',
          '[class*="primary"]'
        ]
      };

      vi.spyOn(strategy as any, 'callLLM').mockResolvedValue(JSON.stringify(mockResponse));

      const result = await strategy.suggestAlternatives(failedSelector, pageContent);

      expect(result).toContain('button.btn-primary');
    });
  });
});