import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { chromium } from 'playwright';
import { PlaywrightDriver } from '../../src/drivers/playwright.js';
import { NavigationError } from '../../src/utils/errors.js';

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

describe('Integration - Navigation Tests', () => {
  let driver: PlaywrightDriver;
  let mockBrowser: any;
  let mockContext: any;
  let mockPage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const mockResponse: any = {
      status: jest.fn().mockReturnValue(200),
      ok: jest.fn().mockReturnValue(true),
      url: jest.fn().mockReturnValue('https://example.com')
    };

    mockPage = {
      goto: (jest.fn() as any).mockResolvedValue(mockResponse),
      on: jest.fn(),
      once: jest.fn(),
      url: jest.fn().mockReturnValue('https://example.com'),
      evaluate: jest.fn(),
      screenshot: jest.fn(),
      close: jest.fn(),
    };

    mockContext = {
      newPage: (jest.fn() as any).mockResolvedValue(mockPage),
      close: jest.fn(),
    };

    mockBrowser = {
      newContext: (jest.fn() as any).mockResolvedValue(mockContext),
      close: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
      version: jest.fn().mockReturnValue('120.0.0.0')
    };

    (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

    driver = new PlaywrightDriver();
  });

  afterEach(async () => {
    if (driver) {
      await driver.close();
    }
  });

  describe('Navigation to External Sites', () => {
    it('should navigate to example.com successfully', async () => {
      mockPage.goto.mockResolvedValue({
        status: () => 200,
        ok: () => true,
        url: () => 'https://example.com'
      });

      await driver.navigate('https://example.com');

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          waitUntil: 'domcontentloaded',
          timeout: 30000
        })
      );
    });

    it('should handle HTTPS redirects correctly', async () => {
      mockPage.goto.mockResolvedValue({
        status: () => 301,
        ok: () => true,
        url: () => 'https://example.com'
      });
      mockPage.url.mockReturnValue('https://example.com');

      await driver.navigate('http://example.com');

      expect(mockPage.goto).toHaveBeenCalled();
    });

    it('should clear errors on new navigation to external site', async () => {
      await driver.initialize();

      // Simulate console error
      const consoleListener = (mockPage.on as jest.Mock).mock.calls.find(
        call => call[0] === 'console'
      )?.[1];
      consoleListener({ type: () => 'error', text: () => 'Old error' });

      // Navigate to new page
      await driver.navigate('https://example.com');

      const errors = await driver.collectConsoleErrors();
      expect(errors).toHaveLength(0);
    });

    it('should handle DNS resolution failures', async () => {
      mockPage.goto.mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'));

      await expect(driver.navigate('https://nonexistent-domain-12345.com'))
        .rejects.toThrow(NavigationError);
    });

    it('should handle connection refused errors', async () => {
      mockPage.goto.mockRejectedValue(new Error('net::ERR_CONNECTION_REFUSED'));

      await expect(driver.navigate('https://example.com:9999'))
        .rejects.toThrow(NavigationError);
    });
  });

  describe('Navigation to Localhost', () => {
    it('should navigate to localhost successfully', async () => {
      mockPage.goto.mockResolvedValue({
        status: () => 200,
        ok: () => true,
        url: () => 'http://localhost:3000'
      });

      await driver.navigate('http://localhost:3000');

      expect(mockPage.goto).toHaveBeenCalledWith(
        'http://localhost:3000',
        expect.objectContaining({
          waitUntil: 'domcontentloaded',
          timeout: 30000
        })
      );
    });

    it('should navigate to localhost with custom port', async () => {
      mockPage.goto.mockResolvedValue({
        status: () => 200,
        ok: () => true,
        url: () => 'http://localhost:8080'
      });

      await driver.navigate('http://localhost:8080');

      expect(mockPage.goto).toHaveBeenCalledWith(
        'http://localhost:8080',
        expect.any(Object)
      );
    });

    it('should navigate to 127.0.0.1', async () => {
      mockPage.goto.mockResolvedValue({
        status: () => 200,
        ok: () => true,
        url: () => 'http://127.0.0.1:3000'
      });

      await driver.navigate('http://127.0.0.1:3000');

      expect(mockPage.goto).toHaveBeenCalled();
    });

    it('should handle localhost connection refused', async () => {
      mockPage.goto.mockRejectedValue(new Error('net::ERR_CONNECTION_REFUSED'));

      await expect(driver.navigate('http://localhost:9999'))
        .rejects.toThrow(NavigationError);
    });
  });

  describe('Navigation with Authentication', () => {
    it('should navigate to URL with basic auth credentials', async () => {
      const authUrl = 'https://user:pass@example.com';

      mockPage.goto.mockResolvedValue({
        status: () => 200,
        ok: () => true,
        url: () => authUrl
      });

      await driver.navigate(authUrl);

      expect(mockPage.goto).toHaveBeenCalledWith(
        authUrl,
        expect.any(Object)
      );
    });

    it('should handle 401 unauthorized responses', async () => {
      mockPage.goto.mockResolvedValue({
        status: () => 401,
        ok: () => false,
        url: () => 'https://secure.example.com'
      });

      // Navigation succeeds but captures status
      await driver.navigate('https://secure.example.com');

      // Network errors should capture the 401
      const responseListener = (mockPage.on as jest.Mock).mock.calls.find(
        call => call[0] === 'response'
      )?.[1];

      if (responseListener) {
        responseListener({
          ok: () => false,
          status: () => 401,
          statusText: () => 'Unauthorized',
          url: () => 'https://secure.example.com'
        });

        const errors = await driver.collectNetworkErrors();
        expect(errors).toContainEqual(
          expect.objectContaining({
            status: 401,
            statusText: 'Unauthorized'
          })
        );
      }
    });

    it('should handle 403 forbidden responses', async () => {
      mockPage.goto.mockResolvedValue({
        status: () => 403,
        ok: () => false,
        url: () => 'https://forbidden.example.com'
      });

      await driver.navigate('https://forbidden.example.com');

      const responseListener = (mockPage.on as jest.Mock).mock.calls.find(
        call => call[0] === 'response'
      )?.[1];

      if (responseListener) {
        responseListener({
          ok: () => false,
          status: () => 403,
          statusText: () => 'Forbidden',
          url: () => 'https://forbidden.example.com'
        });

        const errors = await driver.collectNetworkErrors();
        expect(errors.some(e => e.status === 403)).toBe(true);
      }
    });
  });

  describe('WaitUntil Strategies', () => {
    it('should use "load" strategy when specified', async () => {
      await driver.navigate('https://example.com', 'load');

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          waitUntil: 'load',
          timeout: 30000
        })
      );
    });

    it('should use "domcontentloaded" strategy by default', async () => {
      await driver.navigate('https://example.com');

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          waitUntil: 'domcontentloaded',
          timeout: 30000
        })
      );
    });

    it('should use "networkidle" strategy when specified', async () => {
      await driver.navigate('https://example.com', 'networkidle');

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          waitUntil: 'networkidle',
          timeout: 30000
        })
      );
    });

    it('should handle timeout with "load" strategy', async () => {
      mockPage.goto.mockRejectedValue(new Error('Timeout 30000ms exceeded'));

      await expect(driver.navigate('https://slow-site.com', 'load'))
        .rejects.toThrow(NavigationError);
    });

    it('should handle timeout with "networkidle" strategy', async () => {
      mockPage.goto.mockRejectedValue(new Error('Timeout 30000ms exceeded'));

      await expect(driver.navigate('https://slow-site.com', 'networkidle'))
        .rejects.toThrow(NavigationError);
    });
  });

  describe('Navigation Error Handling', () => {
    it('should include error details in NavigationError', async () => {
      mockPage.goto.mockRejectedValue(new Error('Connection timeout'));

      try {
        await driver.navigate('https://example.com');
        fail('Should have thrown NavigationError');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NavigationError);
        expect(error.message).toContain('https://example.com');
        expect(error.message).toContain('Connection timeout');
        expect(error.details).toBeDefined();
        expect(error.details.url).toBe('https://example.com');
      }
    });

    it('should capture screenshot on navigation failure', async () => {
      mockPage.goto.mockRejectedValue(new Error('Navigation failed'));
      mockPage.screenshot.mockResolvedValue(Buffer.from('fake-image'));

      try {
        await driver.navigate('https://example.com');
      } catch (error: any) {
        expect(mockPage.screenshot).toHaveBeenCalled();
        expect(error.details.screenshotPath).toBeDefined();
      }
    });

    it('should handle navigation timeout error', async () => {
      mockPage.goto.mockRejectedValue(new Error('Timeout 30000ms exceeded'));

      await expect(driver.navigate('https://slow-site.com'))
        .rejects.toThrow(NavigationError);
    });

    it('should handle SSL certificate errors', async () => {
      mockPage.goto.mockRejectedValue(new Error('net::ERR_CERT_AUTHORITY_INVALID'));

      await expect(driver.navigate('https://self-signed.badssl.com'))
        .rejects.toThrow(NavigationError);
    });
  });

  describe('Navigation with Response Capture', () => {
    it('should capture response status on navigation', async () => {
      mockPage.goto.mockResolvedValue({
        status: () => 200,
        ok: () => true,
        url: () => 'https://example.com'
      });

      const response = await driver.navigateWithResponse('https://example.com');

      expect(response.status()).toBe(200);
      expect(response.ok()).toBe(true);
    });

    it('should handle navigation with redirects', async () => {
      mockPage.goto.mockResolvedValue({
        status: () => 302,
        ok: () => true,
        url: () => 'https://example.com/redirected'
      });
      mockPage.url.mockReturnValue('https://example.com/redirected');

      const response = await driver.navigateWithResponse('https://example.com');

      expect(response.status()).toBe(302);
    });

    it('should capture 404 responses', async () => {
      mockPage.goto.mockResolvedValue({
        status: () => 404,
        ok: () => false,
        url: () => 'https://example.com/notfound'
      });

      const response = await driver.navigateWithResponse('https://example.com/notfound');

      expect(response.status()).toBe(404);
      expect(response.ok()).toBe(false);
    });

    it('should capture 500 responses', async () => {
      mockPage.goto.mockResolvedValue({
        status: () => 500,
        ok: () => false,
        url: () => 'https://example.com/error'
      });

      const response = await driver.navigateWithResponse('https://example.com/error');

      expect(response.status()).toBe(500);
      expect(response.ok()).toBe(false);
    });
  });

  describe('Multiple Sequential Navigations', () => {
    it('should handle multiple sequential navigations', async () => {
      await driver.navigate('https://example.com');
      await driver.navigate('https://example.org');
      await driver.navigate('https://example.net');

      expect(mockPage.goto).toHaveBeenCalledTimes(3);
    });

    it('should maintain browser state across navigations', async () => {
      await driver.navigate('https://example.com');
      await driver.navigate('https://example.org');

      // Browser should only be launched once
      expect(chromium.launch).toHaveBeenCalledTimes(1);
    });

    it('should clear error state between navigations', async () => {
      await driver.initialize();

      // First navigation with error
      const consoleListener = (mockPage.on as jest.Mock).mock.calls.find(
        call => call[0] === 'console'
      )?.[1];
      consoleListener({ type: () => 'error', text: () => 'Error 1' });

      await driver.navigate('https://example.com');
      let errors = await driver.collectConsoleErrors();
      expect(errors).toHaveLength(0);

      // Second navigation
      consoleListener({ type: () => 'error', text: () => 'Error 2' });
      await driver.navigate('https://example.org');

      errors = await driver.collectConsoleErrors();
      expect(errors).toHaveLength(0);
    });
  });

  describe('Special URLs and Edge Cases', () => {
    it('should handle data URLs', async () => {
      const dataUrl = 'data:text/html,<h1>Hello</h1>';

      mockPage.goto.mockResolvedValue({
        status: () => 200,
        ok: () => true,
        url: () => dataUrl
      });

      await driver.navigate(dataUrl);

      expect(mockPage.goto).toHaveBeenCalledWith(dataUrl, expect.any(Object));
    });

    it('should handle file URLs', async () => {
      const fileUrl = 'file:///tmp/test.html';

      mockPage.goto.mockResolvedValue({
        status: () => 200,
        ok: () => true,
        url: () => fileUrl
      });

      await driver.navigate(fileUrl);

      expect(mockPage.goto).toHaveBeenCalledWith(fileUrl, expect.any(Object));
    });

    it('should handle URLs with query parameters', async () => {
      const url = 'https://example.com/search?q=test&lang=en';

      mockPage.goto.mockResolvedValue({
        status: () => 200,
        ok: () => true,
        url: () => url
      });

      await driver.navigate(url);

      expect(mockPage.goto).toHaveBeenCalledWith(url, expect.any(Object));
    });

    it('should handle URLs with hash fragments', async () => {
      const url = 'https://example.com/page#section-1';

      mockPage.goto.mockResolvedValue({
        status: () => 200,
        ok: () => true,
        url: () => url
      });

      await driver.navigate(url);

      expect(mockPage.goto).toHaveBeenCalledWith(url, expect.any(Object));
    });
  });
});