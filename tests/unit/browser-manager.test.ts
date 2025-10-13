import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { chromium } from 'playwright';
import { PlaywrightDriver } from '../../src/drivers/playwright.js';
import { NavigationError, BrowserLaunchError } from '../../src/utils/errors.js';

// Mock Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../src/utils/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  debugLog: {
    operation: jest.fn(),
    navigation: jest.fn(),
    navigationComplete: jest.fn(),
    error: jest.fn(),
    browserLaunch: jest.fn(),
  },
}));

describe('Browser Manager - Browser Launch and Management', () => {
  let driver: PlaywrightDriver;
  let mockBrowser: any;
  let mockContext: any;
  let mockPage: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // @ts-ignore - Setup mock objects
    mockPage = {
      // @ts-ignore
      goto: jest.fn().mockResolvedValue({
        status: () => 200,
        ok: () => true,
        url: () => 'https://example.com'
      }),
      on: jest.fn(),
      once: jest.fn(),
      url: jest.fn().mockReturnValue('https://example.com'),
      evaluate: jest.fn(),
      screenshot: jest.fn(),
      close: jest.fn(),
    };

    // @ts-ignore
    mockContext = {
      // @ts-ignore
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    };

    // @ts-ignore
    mockBrowser = {
      // @ts-ignore
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
      version: jest.fn().mockReturnValue('120.0.0.0')
    };

    (chromium.launch as any).mockResolvedValue(mockBrowser);

    driver = new PlaywrightDriver();
  });

  afterEach(async () => {
    if (driver) {
      await driver.close();
    }
  });

  describe('Browser Launch', () => {
    it('should launch browser with fallback strategies', async () => {
      await driver.initialize();

      // Should call chromium.launch (with fallback strategy)
      expect(chromium.launch).toHaveBeenCalled();
    });

    it('should create browser context with correct viewport', async () => {
      await driver.initialize();

      expect(mockBrowser.newContext).toHaveBeenCalledWith({
        viewport: { width: 1280, height: 800 },
        userAgent: expect.stringContaining('Chrome')
      });
    });

    it('should create a new page', async () => {
      await driver.initialize();

      expect(mockContext.newPage).toHaveBeenCalled();
    });

    it('should setup error collection listeners', async () => {
      await driver.initialize();

      expect(mockPage.on).toHaveBeenCalledWith('console', expect.any(Function));
      expect(mockPage.on).toHaveBeenCalledWith('response', expect.any(Function));
      expect(mockPage.on).toHaveBeenCalledWith('pageerror', expect.any(Function));
    });
  });

  describe('Browser Launch Failure and Retry', () => {
    it('should throw BrowserLaunchError when browser launch fails', async () => {
      const launchError = new Error('Failed to launch browser');
      (chromium.launch as any).mockRejectedValue(launchError);

      await expect(driver.initialize()).rejects.toThrow(BrowserLaunchError);
    });

    it('should throw BrowserLaunchError when context creation fails', async () => {
      const contextError = new Error('Failed to create context');
      mockBrowser.newContext.mockRejectedValueOnce(contextError);

      await expect(driver.initialize()).rejects.toThrow(BrowserLaunchError);
    });

    it('should throw BrowserLaunchError when page creation fails', async () => {
      const pageError = new Error('Failed to create page');
      mockContext.newPage.mockRejectedValueOnce(pageError);

      await expect(driver.initialize()).rejects.toThrow(BrowserLaunchError);
    });

    it('should handle browser crash gracefully', async () => {
      await driver.initialize();

      // Simulate browser crash
      mockBrowser.close.mockRejectedValueOnce(new Error('Browser crashed'));

      // Should not throw when closing
      await driver.close();
    });
  });

  describe('Browser Connection State Management', () => {
    it('should track browser connection state correctly', async () => {
      expect(await driver.getPage()).toBeDefined();
      expect(chromium.launch).toHaveBeenCalled();
    });

    it('should initialize browser lazily on first navigation', async () => {
      const freshDriver = new PlaywrightDriver();

      await freshDriver.navigate('https://example.com');

      expect(chromium.launch).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          waitUntil: 'domcontentloaded',
          timeout: 30000
        })
      );

      await freshDriver.close();
    });

    it('should maintain single browser instance across multiple operations', async () => {
      await driver.initialize();
      await driver.navigate('https://example.com');
      await driver.navigate('https://example.org');

      // Should only launch browser once
      expect(chromium.launch).toHaveBeenCalledTimes(1);
      expect(mockPage.goto).toHaveBeenCalledTimes(2);
    });

    it('should properly cleanup browser on close', async () => {
      await driver.initialize();
      await driver.close();

      expect(mockPage.close).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle double close gracefully', async () => {
      await driver.initialize();
      await driver.close();
      await driver.close(); // Second close should not throw

      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });

    it('should reinitialize after close', async () => {
      await driver.initialize();
      await driver.close();

      // Reset mocks for second initialization
      (chromium.launch as any).mockResolvedValue(mockBrowser);
      mockBrowser.newContext.mockResolvedValue(mockContext);
      mockContext.newPage.mockResolvedValue(mockPage);

      await driver.navigate('https://example.com');

      expect(chromium.launch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Collection Setup', () => {
    it('should setup error collection listeners on initialization', async () => {
      await driver.initialize();

      // Verify listeners are set up
      expect(mockPage.on).toHaveBeenCalledWith('console', expect.any(Function));
      expect(mockPage.on).toHaveBeenCalledWith('response', expect.any(Function));
      expect(mockPage.on).toHaveBeenCalledWith('pageerror', expect.any(Function));
    });

    it('should provide methods to collect errors', async () => {
      await driver.initialize();

      const consoleErrors = await driver.collectConsoleErrors();
      const networkErrors = await driver.collectNetworkErrors();

      expect(Array.isArray(consoleErrors)).toBe(true);
      expect(Array.isArray(networkErrors)).toBe(true);
    });
  });

  describe('Browser State Management', () => {
    it('should track browser state correctly', async () => {
      await driver.initialize();

      const state = driver.getBrowserState();

      expect(state).toHaveProperty('isConnected');
      expect(state).toHaveProperty('isOpen');
      expect(state).toHaveProperty('hasPage');
    });
  });

  describe('Screenshot Capture', () => {
    it('should take screenshot successfully', async () => {
      await driver.initialize();

      mockPage.screenshot.mockResolvedValue(Buffer.from('fake-image'));

      const screenshotPath = await driver.takeScreenshot();

      expect(screenshotPath).toMatch(/^\/tmp\/screenshot-.*\.png$/);
      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: screenshotPath,
        fullPage: true
      });
    });

    it('should throw NavigationError when screenshot fails', async () => {
      await driver.initialize();

      mockPage.screenshot.mockRejectedValue(new Error('Screenshot failed'));

      await expect(driver.takeScreenshot()).rejects.toThrow(NavigationError);
      await expect(driver.takeScreenshot()).rejects.toThrow('Failed to take screenshot');
    });

    it('should throw NavigationError when page not initialized', async () => {
      const freshDriver = new PlaywrightDriver();

      await expect(freshDriver.takeScreenshot()).rejects.toThrow(NavigationError);
      await expect(freshDriver.takeScreenshot()).rejects.toThrow('Page not initialized');

      await freshDriver.close();
    });
  });
});