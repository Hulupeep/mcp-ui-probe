import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { chromium } from 'playwright';
import { PlaywrightDriver } from '../../src/drivers/playwright.js';

// Mock Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../src/utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  debugLog: {
    operation: jest.fn(),
    navigation: jest.fn(),
    navigationComplete: jest.fn(),
    error: jest.fn(),
    browserLaunch: jest.fn(),
  }
}));

describe('Integration - Error Collection', () => {
  let driver: PlaywrightDriver;
  let mockBrowser: any;
  let mockContext: any;
  let mockPage: any;
  let consoleListener: any;
  let responseListener: any;
  let pageErrorListener: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const mockResponse: any = {
      status: jest.fn().mockReturnValue(200),
      ok: jest.fn().mockReturnValue(true),
      url: jest.fn().mockReturnValue('https://example.com')
    };

    mockPage = {
      goto: (jest.fn() as any).mockResolvedValue(mockResponse),
      on: jest.fn((event, listener) => {
        if (event === 'console') consoleListener = listener;
        if (event === 'response') responseListener = listener;
        if (event === 'pageerror') pageErrorListener = listener;
      }),
      once: jest.fn(),
      url: jest.fn().mockReturnValue('https://example.com'),
      evaluate: jest.fn(),
      screenshot: jest.fn(),
      close: jest.fn(),
    };

    mockContext = {
      newPage: (jest.fn() as any).mockResolvedValue(mockPage),
      close: jest.fn(),
    } as any;

    mockBrowser = {
      newContext: (jest.fn() as any).mockResolvedValue(mockContext),
      close: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
      version: jest.fn().mockReturnValue('120.0.0.0')
    } as any;

    (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

    driver = new PlaywrightDriver();
  });

  afterEach(async () => {
    if (driver) {
      await driver.close();
    }
  });

  describe('Console Error Capture', () => {
    it('should capture console.error messages', async () => {
      await driver.initialize();

      // Simulate console error
      consoleListener({
        type: () => 'error',
        text: () => 'Uncaught TypeError: Cannot read property of undefined'
      });

      const errors = await driver.collectConsoleErrors();

      expect(errors).toContain('Uncaught TypeError: Cannot read property of undefined');
    });

    it('should capture multiple console errors', async () => {
      await driver.initialize();

      consoleListener({
        type: () => 'error',
        text: () => 'Error 1: ReferenceError'
      });

      consoleListener({
        type: () => 'error',
        text: () => 'Error 2: TypeError'
      });

      consoleListener({
        type: () => 'error',
        text: () => 'Error 3: SyntaxError'
      });

      const errors = await driver.collectConsoleErrors();

      expect(errors).toHaveLength(3);
      expect(errors).toContain('Error 1: ReferenceError');
      expect(errors).toContain('Error 2: TypeError');
      expect(errors).toContain('Error 3: SyntaxError');
    });

    it('should not capture console.log messages', async () => {
      await driver.initialize();

      consoleListener({
        type: () => 'log',
        text: () => 'This is a log message'
      });

      const errors = await driver.collectConsoleErrors();

      expect(errors).toHaveLength(0);
    });

    it('should not capture console.warn messages', async () => {
      await driver.initialize();

      consoleListener({
        type: () => 'warning',
        text: () => 'This is a warning'
      });

      const errors = await driver.collectConsoleErrors();

      expect(errors).toHaveLength(0);
    });

    it('should capture page errors (uncaught exceptions)', async () => {
      await driver.initialize();

      const error = new Error('Uncaught ReferenceError: x is not defined');
      pageErrorListener(error);

      const errors = await driver.collectConsoleErrors();

      expect(errors).toContain('Uncaught ReferenceError: x is not defined');
    });

    it('should capture JavaScript runtime errors', async () => {
      await driver.initialize();

      consoleListener({
        type: () => 'error',
        text: () => 'Uncaught ReferenceError: myFunction is not defined'
      });

      const errors = await driver.collectConsoleErrors();

      expect(errors).toContain('Uncaught ReferenceError: myFunction is not defined');
    });

    it('should capture React errors', async () => {
      await driver.initialize();

      consoleListener({
        type: () => 'error',
        text: () => 'Warning: Failed prop type: Invalid prop `user` of type `string` supplied to `UserProfile`, expected `object`.'
      });

      const errors = await driver.collectConsoleErrors();

      expect(errors[0]).toContain('Failed prop type');
    });

    it('should return a copy of errors array', async () => {
      await driver.initialize();

      consoleListener({
        type: () => 'error',
        text: () => 'Test error'
      });

      const errors1 = await driver.collectConsoleErrors();
      const errors2 = await driver.collectConsoleErrors();

      // Both should have the error
      expect(errors1).toEqual(errors2);

      // But should be different array instances
      expect(errors1).not.toBe(errors2);

      // Modifying one shouldn't affect the other
      errors1.push('Modified');
      expect(errors2).not.toContain('Modified');
    });
  });

  describe('Network Error Capture', () => {
    it('should capture 404 network errors', async () => {
      await driver.initialize();

      responseListener({
        ok: () => false,
        url: () => 'https://example.com/missing.js',
        status: () => 404,
        statusText: () => 'Not Found'
      });

      const errors = await driver.collectNetworkErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        url: 'https://example.com/missing.js',
        status: 404,
        statusText: 'Not Found'
      });
      expect(errors[0].timestamp).toBeDefined();
    });

    it('should capture 500 server errors', async () => {
      await driver.initialize();

      responseListener({
        ok: () => false,
        url: () => 'https://example.com/api/fail',
        status: () => 500,
        statusText: () => 'Internal Server Error'
      });

      const errors = await driver.collectNetworkErrors();

      expect(errors[0]).toMatchObject({
        url: 'https://example.com/api/fail',
        status: 500,
        statusText: 'Internal Server Error'
      });
    });

    it('should capture multiple network errors', async () => {
      await driver.initialize();

      responseListener({
        ok: () => false,
        url: () => 'https://example.com/missing1.js',
        status: () => 404,
        statusText: () => 'Not Found'
      });

      responseListener({
        ok: () => false,
        url: () => 'https://example.com/missing2.css',
        status: () => 404,
        statusText: () => 'Not Found'
      });

      responseListener({
        ok: () => false,
        url: () => 'https://example.com/api/error',
        status: () => 500,
        statusText: () => 'Internal Server Error'
      });

      const errors = await driver.collectNetworkErrors();

      expect(errors).toHaveLength(3);
    });

    it('should not capture successful responses', async () => {
      await driver.initialize();

      responseListener({
        ok: () => true,
        url: () => 'https://example.com/success.js',
        status: () => 200,
        statusText: () => 'OK'
      });

      const errors = await driver.collectNetworkErrors();

      expect(errors).toHaveLength(0);
    });

    it('should capture 401 authentication errors', async () => {
      await driver.initialize();

      responseListener({
        ok: () => false,
        url: () => 'https://example.com/api/protected',
        status: () => 401,
        statusText: () => 'Unauthorized'
      });

      const errors = await driver.collectNetworkErrors();

      expect(errors[0].status).toBe(401);
      expect(errors[0].statusText).toBe('Unauthorized');
    });

    it('should capture 403 forbidden errors', async () => {
      await driver.initialize();

      responseListener({
        ok: () => false,
        url: () => 'https://example.com/admin',
        status: () => 403,
        statusText: () => 'Forbidden'
      });

      const errors = await driver.collectNetworkErrors();

      expect(errors[0].status).toBe(403);
    });

    it('should capture 503 service unavailable errors', async () => {
      await driver.initialize();

      responseListener({
        ok: () => false,
        url: () => 'https://example.com/api',
        status: () => 503,
        statusText: () => 'Service Unavailable'
      });

      const errors = await driver.collectNetworkErrors();

      expect(errors[0].status).toBe(503);
    });

    it('should include timestamp in network errors', async () => {
      await driver.initialize();

      const beforeTime = new Date();

      responseListener({
        ok: () => false,
        url: () => 'https://example.com/fail',
        status: () => 500,
        statusText: () => 'Error'
      });

      const errors = await driver.collectNetworkErrors();
      const afterTime = new Date();

      expect(errors[0].timestamp).toBeDefined();

      const errorTime = new Date(errors[0].timestamp);
      expect(errorTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(errorTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should return a copy of network errors array', async () => {
      await driver.initialize();

      responseListener({
        ok: () => false,
        url: () => 'https://example.com/fail',
        status: () => 404,
        statusText: () => 'Not Found'
      });

      const errors1 = await driver.collectNetworkErrors();
      const errors2 = await driver.collectNetworkErrors();

      expect(errors1).toEqual(errors2);
      expect(errors1).not.toBe(errors2);
    });
  });

  describe('Validation Error Capture', () => {
    it('should capture form validation errors through console', async () => {
      await driver.initialize();

      consoleListener({
        type: () => 'error',
        text: () => 'Form validation failed: Email is required'
      });

      const errors = await driver.collectConsoleErrors();

      expect(errors[0]).toContain('Form validation failed');
    });

    it('should capture HTML5 validation errors', async () => {
      await driver.initialize();

      consoleListener({
        type: () => 'error',
        text: () => 'An invalid form control with name="email" is not focusable.'
      });

      const errors = await driver.collectConsoleErrors();

      expect(errors[0]).toContain('invalid form control');
    });
  });

  describe('Error Clearing on Navigation', () => {
    it('should clear console errors on new navigation', async () => {
      await driver.initialize();

      consoleListener({
        type: () => 'error',
        text: () => 'Old error'
      });

      let errors = await driver.collectConsoleErrors();
      expect(errors).toHaveLength(1);

      // Navigate
      await driver.navigate('https://example.com');

      errors = await driver.collectConsoleErrors();
      expect(errors).toHaveLength(0);
    });

    it('should clear network errors on new navigation', async () => {
      await driver.initialize();

      responseListener({
        ok: () => false,
        url: () => 'https://example.com/old-error',
        status: () => 404,
        statusText: () => 'Not Found'
      });

      let errors = await driver.collectNetworkErrors();
      expect(errors).toHaveLength(1);

      // Navigate
      await driver.navigate('https://example.com');

      errors = await driver.collectNetworkErrors();
      expect(errors).toHaveLength(0);
    });

    it('should clear all errors on navigation', async () => {
      await driver.initialize();

      // Add console error
      consoleListener({
        type: () => 'error',
        text: () => 'Console error'
      });

      // Add network error
      responseListener({
        ok: () => false,
        url: () => 'https://example.com/fail',
        status: () => 500,
        statusText: () => 'Error'
      });

      // Verify errors exist
      expect((await driver.collectConsoleErrors()).length).toBeGreaterThan(0);
      expect((await driver.collectNetworkErrors()).length).toBeGreaterThan(0);

      // Navigate
      await driver.navigate('https://example.com');

      // Verify errors cleared
      expect(await driver.collectConsoleErrors()).toHaveLength(0);
      expect(await driver.collectNetworkErrors()).toHaveLength(0);
    });
  });

  describe('Error Collection After Navigation', () => {
    it('should collect new errors after navigation', async () => {
      await driver.navigate('https://example.com');

      consoleListener({
        type: () => 'error',
        text: () => 'New error after navigation'
      });

      const errors = await driver.collectConsoleErrors();

      expect(errors).toContain('New error after navigation');
    });

    it('should collect errors from multiple pages', async () => {
      await driver.navigate('https://example.com/page1');

      consoleListener({
        type: () => 'error',
        text: () => 'Error from page 1'
      });

      await driver.navigate('https://example.com/page2');

      consoleListener({
        type: () => 'error',
        text: () => 'Error from page 2'
      });

      const errors = await driver.collectConsoleErrors();

      // Only errors from current page
      expect(errors).toHaveLength(1);
      expect(errors).toContain('Error from page 2');
      expect(errors).not.toContain('Error from page 1');
    });
  });

  describe('Mixed Error Scenarios', () => {
    it('should capture both console and network errors simultaneously', async () => {
      await driver.initialize();

      consoleListener({
        type: () => 'error',
        text: () => 'JavaScript error'
      });

      responseListener({
        ok: () => false,
        url: () => 'https://example.com/fail',
        status: () => 500,
        statusText: () => 'Server Error'
      });

      const consoleErrors = await driver.collectConsoleErrors();
      const networkErrors = await driver.collectNetworkErrors();

      expect(consoleErrors).toHaveLength(1);
      expect(networkErrors).toHaveLength(1);
    });

    it('should handle rapid succession of errors', async () => {
      await driver.initialize();

      // Simulate many errors in quick succession
      for (let i = 0; i < 10; i++) {
        consoleListener({
          type: () => 'error',
          text: () => `Error ${i}`
        });
      }

      const errors = await driver.collectConsoleErrors();

      expect(errors).toHaveLength(10);
      expect(errors[0]).toContain('Error 0');
      expect(errors[9]).toContain('Error 9');
    });

    it('should maintain error order', async () => {
      await driver.initialize();

      consoleListener({
        type: () => 'error',
        text: () => 'First error'
      });

      consoleListener({
        type: () => 'error',
        text: () => 'Second error'
      });

      consoleListener({
        type: () => 'error',
        text: () => 'Third error'
      });

      const errors = await driver.collectConsoleErrors();

      expect(errors[0]).toBe('First error');
      expect(errors[1]).toBe('Second error');
      expect(errors[2]).toBe('Third error');
    });
  });

  describe('Error Collection Edge Cases', () => {
    it('should handle empty error collection', async () => {
      await driver.initialize();

      const consoleErrors = await driver.collectConsoleErrors();
      const networkErrors = await driver.collectNetworkErrors();

      expect(consoleErrors).toEqual([]);
      expect(networkErrors).toEqual([]);
    });

    it('should handle very long error messages', async () => {
      await driver.initialize();

      const longError = 'Error: ' + 'x'.repeat(10000);

      consoleListener({
        type: () => 'error',
        text: () => longError
      });

      const errors = await driver.collectConsoleErrors();

      expect(errors[0]).toBe(longError);
      expect(errors[0].length).toBeGreaterThan(10000);
    });

    it('should handle special characters in error messages', async () => {
      await driver.initialize();

      const specialError = 'Error: <script>alert("xss")</script>';

      consoleListener({
        type: () => 'error',
        text: () => specialError
      });

      const errors = await driver.collectConsoleErrors();

      expect(errors[0]).toBe(specialError);
    });

    it('should handle unicode characters in error messages', async () => {
      await driver.initialize();

      const unicodeError = 'Error: 你好世界 🚀';

      consoleListener({
        type: () => 'error',
        text: () => unicodeError
      });

      const errors = await driver.collectConsoleErrors();

      expect(errors[0]).toBe(unicodeError);
    });

    it('should handle multiline error messages', async () => {
      await driver.initialize();

      const multilineError = 'Error:\nLine 1\nLine 2\nLine 3';

      consoleListener({
        type: () => 'error',
        text: () => multilineError
      });

      const errors = await driver.collectConsoleErrors();

      expect(errors[0]).toBe(multilineError);
      expect(errors[0]).toContain('\n');
    });
  });

  describe('Error Logging', () => {
    it('should log console errors to logger', async () => {
      const logger = (await import('../../src/utils/logger.js')).default;

      await driver.initialize();

      consoleListener({
        type: () => 'error',
        text: () => 'Logged error'
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Console error captured',
        expect.objectContaining({
          message: 'Logged error'
        })
      );
    });

    it('should log network errors to logger', async () => {
      const logger = (await import('../../src/utils/logger.js')).default;

      await driver.initialize();

      responseListener({
        ok: () => false,
        url: () => 'https://example.com/fail',
        status: () => 500,
        statusText: () => 'Error'
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'Network error captured',
        expect.objectContaining({
          url: 'https://example.com/fail',
          status: 500
        })
      );
    });

    it('should log page errors to logger', async () => {
      const logger = (await import('../../src/utils/logger.js')).default;

      await driver.initialize();

      const error = new Error('Page error');
      pageErrorListener(error);

      expect(logger.error).toHaveBeenCalledWith(
        'Page error captured',
        expect.objectContaining({
          error: 'Page error'
        })
      );
    });
  });
});