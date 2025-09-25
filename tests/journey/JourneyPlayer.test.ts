import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JourneyPlayer } from '../../src/journey/JourneyPlayer.js';
import { Journey, PlaybackConfig, JourneyExecutionResult } from '../../src/types/journey.js';
import { Page } from 'playwright';

// Mock Playwright Page
const mockPage = {
  url: jest.fn(),
  goto: jest.fn(),
  click: jest.fn(),
  fill: jest.fn(),
  selectOption: jest.fn(),
  check: jest.fn(),
  uncheck: jest.fn(),
  setInputFiles: jest.fn(),
  waitForSelector: jest.fn(),
  waitForTimeout: jest.fn(),
  locator: jest.fn(),
  screenshot: jest.fn(),
  evaluate: jest.fn()
} as unknown as Page;

describe('JourneyPlayer', () => {
  let player: JourneyPlayer;
  let config: PlaybackConfig;
  let mockJourney: Journey;

  beforeEach(() => {
    config = {
      speed: 1.0,
      pauseOnError: true,
      maxRetries: 2,
      screenshotOnFailure: true,
      continueOnNonCriticalErrors: true,
      validateContext: true,
      timeoutMs: 5000
    };

    mockJourney = {
      id: 'test-journey',
      name: 'Test Journey',
      description: 'A test journey',
      tags: ['test'],
      category: 'testing',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startingContext: {
        urlPattern: 'https://example.com/*',
        exactUrl: 'https://example.com/test',
        requiredElements: [
          {
            selector: '#test-button',
            type: 'button',
            description: 'Test button'
          }
        ],
        pageState: {}
      },
      steps: [
        {
          id: 'step-1',
          action: 'click',
          selector: '#test-button',
          description: 'Click test button',
          timestamp: new Date().toISOString(),
          url: 'https://example.com/test'
        },
        {
          id: 'step-2',
          action: 'fill',
          selector: '#email',
          value: 'test@example.com',
          description: 'Fill email field',
          timestamp: new Date().toISOString(),
          url: 'https://example.com/test'
        }
      ],
      metadata: {
        author: 'Test',
        version: '1.0.0',
        successRate: 1.0,
        avgDurationMs: 2000,
        usageCount: 5,
        difficulty: 'easy',
        environment: ['desktop'],
        browserCompatibility: ['chromium']
      }
    };

    player = new JourneyPlayer(config);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    (mockPage.url as jest.Mock).mockReturnValue('https://example.com/test');
    (mockPage.goto as jest.Mock).mockResolvedValue(undefined);
    (mockPage.click as jest.Mock).mockResolvedValue(undefined);
    (mockPage.fill as jest.Mock).mockResolvedValue(undefined);
    (mockPage.waitForSelector as jest.Mock).mockResolvedValue(null);
    (mockPage.waitForTimeout as jest.Mock).mockResolvedValue(undefined);
    (mockPage.screenshot as jest.Mock).mockResolvedValue(Buffer.from('screenshot'));
    (mockPage.evaluate as jest.Mock).mockResolvedValue(true);
    (mockPage.locator as jest.Mock).mockReturnValue({
      isVisible: jest.fn().mockResolvedValue(true),
      count: jest.fn().mockResolvedValue(1)
    });
  });

  afterEach(async () => {
    if (player.isPlaying()) {
      await player.stop();
    }
  });

  describe('Playback Lifecycle', () => {
    it('should start playback successfully', async () => {
      const result = await player.play(mockJourney, mockPage);

      expect(result.success).toBe(true);
      expect(result.stepsExecuted).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com/test', expect.any(Object));
      expect(mockPage.click).toHaveBeenCalledWith('#test-button', expect.any(Object));
      expect(mockPage.fill).toHaveBeenCalledWith('#email', 'test@example.com', expect.any(Object));
    });

    it('should validate context before starting', async () => {
      // Mock context validation failure
      (mockPage.url as jest.Mock).mockReturnValue('https://wrong-domain.com');

      const result = await player.play(mockJourney, mockPage);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Starting context validation failed');
      expect(mockPage.click).not.toHaveBeenCalled();
    });

    it('should skip context validation when disabled', async () => {
      config.validateContext = false;
      player = new JourneyPlayer(config);

      (mockPage.url as jest.Mock).mockReturnValue('https://wrong-domain.com');

      const result = await player.play(mockJourney, mockPage);

      expect(result.success).toBe(true);
      expect(mockPage.click).toHaveBeenCalled();
    });

    it('should pause and resume playback', async () => {
      // Start playback but don't await
      const playbackPromise = player.play(mockJourney, mockPage);

      // Pause after a short delay
      setTimeout(() => {
        player.pause();
        expect(player.isPaused()).toBe(true);
      }, 10);

      // Resume after another delay
      setTimeout(() => {
        player.resume();
        expect(player.isPaused()).toBe(false);
      }, 50);

      const result = await playbackPromise;
      expect(result.success).toBe(true);
    });

    it('should stop playback', async () => {
      const playbackPromise = player.play(mockJourney, mockPage);

      setTimeout(() => {
        player.stop();
      }, 10);

      const result = await playbackPromise;
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('stopped');
    });
  });

  describe('Step Execution', () => {
    it('should execute click actions', async () => {
      const clickStep = {
        id: 'step-1',
        action: 'click' as const,
        selector: '#submit-btn',
        description: 'Click submit button',
        timestamp: new Date().toISOString(),
        url: 'https://example.com/test'
      };

      const journey = { ...mockJourney, steps: [clickStep] };
      const result = await player.play(journey, mockPage);

      expect(result.success).toBe(true);
      expect(mockPage.click).toHaveBeenCalledWith('#submit-btn', expect.any(Object));
    });

    it('should execute fill actions', async () => {
      const fillStep = {
        id: 'step-1',
        action: 'fill' as const,
        selector: '#username',
        value: 'testuser',
        description: 'Fill username',
        timestamp: new Date().toISOString(),
        url: 'https://example.com/test'
      };

      const journey = { ...mockJourney, steps: [fillStep] };
      const result = await player.play(journey, mockPage);

      expect(result.success).toBe(true);
      expect(mockPage.fill).toHaveBeenCalledWith('#username', 'testuser', expect.any(Object));
    });

    it('should execute select actions', async () => {
      const selectStep = {
        id: 'step-1',
        action: 'select' as const,
        selector: '#country',
        value: 'US',
        description: 'Select country',
        timestamp: new Date().toISOString(),
        url: 'https://example.com/test'
      };

      const journey = { ...mockJourney, steps: [selectStep] };
      const result = await player.play(journey, mockPage);

      expect(result.success).toBe(true);
      expect(mockPage.selectOption).toHaveBeenCalledWith('#country', 'US');
    });

    it('should execute navigate actions', async () => {
      const navigateStep = {
        id: 'step-1',
        action: 'navigate' as const,
        url: 'https://example.com/page2',
        description: 'Navigate to page 2',
        timestamp: new Date().toISOString()
      };

      const journey = { ...mockJourney, steps: [navigateStep] };
      const result = await player.play(journey, mockPage);

      expect(result.success).toBe(true);
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com/page2', expect.any(Object));
    });

    it('should handle upload actions', async () => {
      const uploadStep = {
        id: 'step-1',
        action: 'upload' as const,
        selector: '#file-input',
        value: '/path/to/file.txt',
        description: 'Upload file',
        timestamp: new Date().toISOString(),
        url: 'https://example.com/test'
      };

      const journey = { ...mockJourney, steps: [uploadStep] };
      const result = await player.play(journey, mockPage);

      expect(result.success).toBe(true);
      expect(mockPage.setInputFiles).toHaveBeenCalledWith('#file-input', '/path/to/file.txt');
    });

    it('should respect waitAfter delays', async () => {
      const stepWithWait = {
        id: 'step-1',
        action: 'click' as const,
        selector: '#test-btn',
        description: 'Click with wait',
        timestamp: new Date().toISOString(),
        url: 'https://example.com/test',
        waitAfter: 1000
      };

      const journey = { ...mockJourney, steps: [stepWithWait] };
      const result = await player.play(journey, mockPage);

      expect(result.success).toBe(true);
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(1000);
    });
  });

  describe('Error Handling and Retries', () => {
    it('should retry failed steps', async () => {
      (mockPage.click as jest.Mock)
        .mockRejectedValueOnce(new Error('Element not found'))
        .mockResolvedValueOnce(undefined);

      const result = await player.play(mockJourney, mockPage);

      expect(result.success).toBe(true);
      expect(mockPage.click).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries exceeded', async () => {
      (mockPage.click as jest.Mock).mockRejectedValue(new Error('Element not found'));

      const result = await player.play(mockJourney, mockPage);

      expect(result.success).toBe(false);
      expect(mockPage.click).toHaveBeenCalledTimes(config.maxRetries + 1);
      expect(result.errors[0]).toContain('Element not found');
    });

    it('should continue on non-critical errors when configured', async () => {
      config.continueOnNonCriticalErrors = true;
      player = new JourneyPlayer(config);

      (mockPage.click as jest.Mock).mockRejectedValue(new Error('Timeout'));

      const result = await player.play(mockJourney, mockPage);

      expect(result.success).toBe(true); // Journey continues despite error
      expect(result.errors).toHaveLength(1);
      expect(result.warnings).toContain(expect.stringContaining('Non-critical error'));
    });

    it('should stop on critical errors', async () => {
      config.pauseOnError = true;
      player = new JourneyPlayer(config);

      (mockPage.click as jest.Mock).mockRejectedValue(new Error('Page crashed'));

      const result = await player.play(mockJourney, mockPage);

      expect(result.success).toBe(false);
      expect(mockPage.fill).not.toHaveBeenCalled(); // Second step not executed
    });

    it('should capture screenshots on failure when enabled', async () => {
      config.screenshotOnFailure = true;
      player = new JourneyPlayer(config);

      (mockPage.click as jest.Mock).mockRejectedValue(new Error('Element not found'));

      const result = await player.play(mockJourney, mockPage);

      expect(result.success).toBe(false);
      expect(mockPage.screenshot).toHaveBeenCalled();
      expect(result.screenshots).toBeDefined();
      expect(result.screenshots?.failure).toBeInstanceOf(Buffer);
    });
  });

  describe('Fallback Strategies', () => {
    it('should try alternative selectors when primary fails', async () => {
      const stepWithFallbacks = {
        id: 'step-1',
        action: 'click' as const,
        selector: '#primary-btn',
        fallbackSelectors: ['.secondary-btn', '[data-testid="backup-btn"]'],
        description: 'Click with fallbacks',
        timestamp: new Date().toISOString(),
        url: 'https://example.com/test'
      };

      (mockPage.click as jest.Mock)
        .mockRejectedValueOnce(new Error('Element not found'))
        .mockResolvedValueOnce(undefined);

      const journey = { ...mockJourney, steps: [stepWithFallbacks] };
      const result = await player.play(journey, mockPage);

      expect(result.success).toBe(true);
      expect(mockPage.click).toHaveBeenCalledWith('#primary-btn', expect.any(Object));
      expect(mockPage.click).toHaveBeenCalledWith('.secondary-btn', expect.any(Object));
    });

    it('should apply fallback strategy for missing elements', async () => {
      const stepWithStrategy = {
        id: 'step-1',
        action: 'click' as const,
        selector: '#missing-btn',
        fallbackStrategy: 'skip' as const,
        description: 'Click with skip strategy',
        timestamp: new Date().toISOString(),
        url: 'https://example.com/test'
      };

      (mockPage.locator as jest.Mock).mockReturnValue({
        isVisible: jest.fn().mockResolvedValue(false),
        count: jest.fn().mockResolvedValue(0)
      });

      const journey = { ...mockJourney, steps: [stepWithStrategy] };
      const result = await player.play(journey, mockPage);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain(expect.stringContaining('Skipped step'));
    });
  });

  describe('Playback Control', () => {
    it('should respect playback speed', async () => {
      config.speed = 2.0; // 2x speed
      player = new JourneyPlayer(config);

      const startTime = Date.now();
      await player.play(mockJourney, mockPage);
      const endTime = Date.now();

      // With 2x speed, timeouts should be halved
      const expectedDelay = mockJourney.steps.length * (500 / 2.0); // Base delay adjusted for speed
      expect(endTime - startTime).toBeLessThan(expectedDelay * 2);
    });

    it('should emit progress events', async () => {
      const progressHandler = jest.fn();
      player.on('progress', progressHandler);

      await player.play(mockJourney, mockPage);

      expect(progressHandler).toHaveBeenCalledWith({
        currentStep: expect.any(Number),
        totalSteps: 2,
        progress: expect.any(Number),
        step: expect.any(Object)
      });
    });

    it('should emit step completion events', async () => {
      const stepHandler = jest.fn();
      player.on('step-completed', stepHandler);

      await player.play(mockJourney, mockPage);

      expect(stepHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Context Validation', () => {
    it('should validate required elements exist', async () => {
      (mockPage.locator as jest.Mock).mockReturnValue({
        isVisible: jest.fn().mockResolvedValue(false),
        count: jest.fn().mockResolvedValue(0)
      });

      const result = await player.play(mockJourney, mockPage);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Required element not found');
    });

    it('should validate URL pattern matches', async () => {
      (mockPage.url as jest.Mock).mockReturnValue('https://wrong-site.com/test');

      const result = await player.play(mockJourney, mockPage);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('URL pattern mismatch');
    });

    it('should validate page state', async () => {
      const journeyWithState = {
        ...mockJourney,
        startingContext: {
          ...mockJourney.startingContext,
          pageState: { loggedIn: true }
        }
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue(false); // Not logged in

      const result = await player.play(journeyWithState, mockPage);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Page state validation failed');
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const newConfig: PlaybackConfig = {
        ...config,
        speed: 0.5,
        maxRetries: 5
      };

      player.updateConfig(newConfig);

      const currentConfig = player.getConfig();
      expect(currentConfig.speed).toBe(0.5);
      expect(currentConfig.maxRetries).toBe(5);
    });

    it('should get current playback status', async () => {
      expect(player.isPlaying()).toBe(false);
      expect(player.isPaused()).toBe(false);

      const playbackPromise = player.play(mockJourney, mockPage);
      expect(player.isPlaying()).toBe(true);

      await playbackPromise;
      expect(player.isPlaying()).toBe(false);
    });
  });

  describe('Metrics and Reporting', () => {
    it('should track execution metrics', async () => {
      const result = await player.play(mockJourney, mockPage);

      expect(result.duration).toBeGreaterThan(0);
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
      expect(result.stepsExecuted).toBe(2);
      expect(result.stepsSkipped).toBe(0);
    });

    it('should include performance data', async () => {
      const result = await player.play(mockJourney, mockPage);

      expect(result.performance).toBeDefined();
      expect(result.performance?.avgStepDuration).toBeGreaterThan(0);
      expect(result.performance?.slowestStep).toBeDefined();
      expect(result.performance?.fastestStep).toBeDefined();
    });
  });
});