import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdaptiveExecutor } from '../../src/llm/adaptiveExecutor.js';
import { Page } from 'playwright';

describe('AdaptiveExecutor', () => {
  let executor: AdaptiveExecutor;
  let mockPage: any;

  beforeEach(() => {
    executor = new AdaptiveExecutor();

    // Mock Playwright Page
    mockPage = {
      goto: vi.fn(),
      click: vi.fn(),
      fill: vi.fn(),
      $: vi.fn(),
      $$: vi.fn(),
      evaluate: vi.fn(),
      waitForSelector: vi.fn(),
      content: vi.fn().mockResolvedValue('<html></html>'),
      url: vi.fn().mockReturnValue('http://test.com')
    };
  });

  describe('execute', () => {
    it('should execute simple action successfully', async () => {
      const action = {
        action: 'click',
        target: 'button.submit'
      };

      mockPage.click.mockResolvedValue(undefined);

      const result = await executor.execute(mockPage, action);

      expect(result.success).toBe(true);
      expect(mockPage.click).toHaveBeenCalledWith('button.submit');
    });

    it('should retry with alternative selectors on failure', async () => {
      const action = {
        action: 'click',
        target: 'button[text="Login"]'
      };

      // First attempt fails
      mockPage.click.mockRejectedValueOnce(new Error('Element not found'));
      // Mock finding alternative
      mockPage.$.mockResolvedValue({ click: vi.fn() });
      mockPage.evaluate.mockResolvedValue(['button.btn-primary']);

      const result = await executor.execute(mockPage, action, { maxRetries: 2 });

      expect(result.success).toBe(true);
      expect(result.retryCount).toBeGreaterThan(0);
    });

    it('should handle stale element references', async () => {
      const action = {
        action: 'fill',
        target: 'input#email',
        value: 'test@example.com'
      };

      // First attempt throws stale element
      mockPage.fill.mockRejectedValueOnce(new Error('Element is not attached to the DOM'));
      // Second attempt succeeds
      mockPage.fill.mockResolvedValueOnce(undefined);

      const result = await executor.execute(mockPage, action);

      expect(result.success).toBe(true);
      expect(mockPage.fill).toHaveBeenCalledTimes(2);
    });

    it('should wait for dynamic content', async () => {
      const action = {
        action: 'click',
        target: '.dynamic-button',
        waitFor: true
      };

      mockPage.waitForSelector.mockResolvedValue(true);
      mockPage.click.mockResolvedValue(undefined);

      const result = await executor.execute(mockPage, action);

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.dynamic-button', expect.any(Object));
      expect(result.success).toBe(true);
    });

    it('should provide detailed error context on failure', async () => {
      const action = {
        action: 'click',
        target: 'button.non-existent'
      };

      mockPage.click.mockRejectedValue(new Error('Element not found'));
      mockPage.content.mockResolvedValue('<div>Test page</div>');
      mockPage.evaluate.mockResolvedValue([]); // No alternatives found

      const result = await executor.execute(mockPage, action, { maxRetries: 1 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.context).toMatchObject({
        url: 'http://test.com',
        attemptedSelectors: expect.any(Array)
      });
    });
  });

  describe('executeSequence', () => {
    it('should execute multiple actions in order', async () => {
      const actions = [
        { action: 'navigate', url: '/login' },
        { action: 'fill', target: '#email', value: 'test@example.com' },
        { action: 'fill', target: '#password', value: 'pass123' },
        { action: 'click', target: 'button[type="submit"]' }
      ];

      mockPage.goto.mockResolvedValue(undefined);
      mockPage.fill.mockResolvedValue(undefined);
      mockPage.click.mockResolvedValue(undefined);

      const result = await executor.executeSequence(mockPage, actions);

      expect(result.success).toBe(true);
      expect(result.completedSteps).toBe(4);
      expect(mockPage.goto).toHaveBeenCalled();
      expect(mockPage.fill).toHaveBeenCalledTimes(2);
      expect(mockPage.click).toHaveBeenCalled();
    });

    it('should stop on critical failure but continue on warnings', async () => {
      const actions = [
        { action: 'navigate', url: '/login' },
        { action: 'fill', target: '#optional-field', value: 'test', optional: true },
        { action: 'click', target: 'button.submit', critical: true }
      ];

      mockPage.goto.mockResolvedValue(undefined);
      mockPage.fill.mockRejectedValue(new Error('Optional field not found'));
      mockPage.click.mockRejectedValue(new Error('Submit button not found'));

      const result = await executor.executeSequence(mockPage, actions);

      expect(result.success).toBe(false);
      expect(result.completedSteps).toBe(2); // Navigation succeeded, optional fill skipped
      expect(result.errors).toHaveLength(1); // Only critical error
    });

    it('should maintain context between steps', async () => {
      const actions = [
        { action: 'fill', target: '#email', value: 'test@example.com', storeAs: 'userEmail' },
        { action: 'navigate', url: '/confirm' },
        { action: 'assert', target: '.email-display', contains: '${userEmail}' }
      ];

      mockPage.fill.mockResolvedValue(undefined);
      mockPage.goto.mockResolvedValue(undefined);
      mockPage.$.mockResolvedValue({ textContent: () => 'test@example.com' });

      const result = await executor.executeSequence(mockPage, actions);

      expect(result.success).toBe(true);
      expect(result.context.userEmail).toBe('test@example.com');
    });
  });

  describe('recovery strategies', () => {
    it('should try iframe context when main frame fails', async () => {
      const action = {
        action: 'click',
        target: 'button.in-iframe'
      };

      // Main frame fails
      mockPage.click.mockRejectedValueOnce(new Error('Not found'));

      // Mock iframe handling
      const mockFrame = {
        click: vi.fn().mockResolvedValue(undefined)
      };
      mockPage.frames = vi.fn().mockReturnValue([mockFrame]);

      const result = await executor.execute(mockPage, action);

      expect(result.success).toBe(true);
      expect(result.context?.frameUsed).toBeTruthy();
    });

    it('should handle shadow DOM elements', async () => {
      const action = {
        action: 'click',
        target: 'custom-element button'
      };

      mockPage.click.mockRejectedValueOnce(new Error('Not found'));
      mockPage.evaluate.mockResolvedValue(true); // Simulate shadow DOM interaction

      const result = await executor.execute(mockPage, action);

      expect(result.success).toBe(true);
      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });
});