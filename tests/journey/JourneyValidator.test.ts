import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { JourneyValidator } from '../../src/journey/JourneyValidator.js';
import { Journey, StartingContext } from '../../src/types/journey.js';
import { Page } from 'playwright';

// Mock Playwright Page
const mockPage = {
  url: jest.fn(),
  title: jest.fn(),
  locator: jest.fn(),
  evaluate: jest.fn(),
  waitForSelector: jest.fn(),
  screenshot: jest.fn()
} as unknown as Page;

describe('JourneyValidator', () => {
  let validator: JourneyValidator;
  let mockJourney: Journey;

  beforeEach(() => {
    validator = new JourneyValidator();

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
        exactUrl: 'https://example.com/login',
        requiredElements: [
          {
            selector: '#email',
            type: 'input',
            description: 'Email input field'
          },
          {
            selector: '#password',
            type: 'input',
            description: 'Password input field'
          },
          {
            selector: '#login-btn',
            type: 'button',
            description: 'Login button'
          }
        ],
        pageState: {
          loggedIn: false,
          userType: 'guest'
        }
      },
      steps: [
        {
          id: 'step-1',
          action: 'fill',
          selector: '#email',
          value: 'test@example.com',
          description: 'Fill email field',
          timestamp: new Date().toISOString(),
          url: 'https://example.com/login'
        }
      ],
      metadata: {
        author: 'Test',
        version: '1.0.0',
        successRate: 0.95,
        avgDurationMs: 3000,
        usageCount: 10,
        difficulty: 'easy',
        environment: ['desktop'],
        browserCompatibility: ['chromium']
      }
    };

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    (mockPage.url as jest.Mock).mockReturnValue('https://example.com/login');
    (mockPage.title as jest.Mock).mockReturnValue('Login Page');
    (mockPage.evaluate as jest.Mock).mockResolvedValue({
      loggedIn: false,
      userType: 'guest'
    });
    (mockPage.locator as jest.Mock).mockReturnValue({
      isVisible: jest.fn().mockResolvedValue(true),
      count: jest.fn().mockResolvedValue(1),
      getAttribute: jest.fn().mockResolvedValue('input')
    });
  });

  describe('Context Validation', () => {
    it('should validate successful context', async () => {
      const result = await validator.validateContext(mockJourney.startingContext, mockPage);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(0.8);
    });

    it('should detect URL pattern mismatch', async () => {
      (mockPage.url as jest.Mock).mockReturnValue('https://different-site.com/page');

      const result = await validator.validateContext(mockJourney.startingContext, mockPage);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        expect.stringMatching(/URL pattern.*does not match/)
      );
      expect(result.score).toBeLessThan(0.5);
    });

    it('should detect missing required elements', async () => {
      (mockPage.locator as jest.Mock).mockReturnValue({
        isVisible: jest.fn().mockResolvedValue(false),
        count: jest.fn().mockResolvedValue(0)
      });

      const result = await validator.validateContext(mockJourney.startingContext, mockPage);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        expect.stringMatching(/Required element.*not found/)
      );
    });

    it('should detect page state mismatch', async () => {
      (mockPage.evaluate as jest.Mock).mockResolvedValue({
        loggedIn: true,
        userType: 'admin'
      });

      const result = await validator.validateContext(mockJourney.startingContext, mockPage);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        expect.stringMatching(/Page state validation failed/)
      );
    });

    it('should provide suggestions for missing elements', async () => {
      // Mock scenario where #email is missing but similar element exists
      (mockPage.locator as jest.Mock).mockImplementation((selector: string) => {
        if (selector === '#email') {
          return {
            isVisible: jest.fn().mockResolvedValue(false),
            count: jest.fn().mockResolvedValue(0)
          };
        }
        return {
          isVisible: jest.fn().mockResolvedValue(true),
          count: jest.fn().mockResolvedValue(1)
        };
      });

      const result = await validator.validateContext(mockJourney.startingContext, mockPage);

      expect(result.suggestions).toContain(
        expect.stringMatching(/Consider using alternative selector/)
      );
    });

    it('should handle exact URL validation', async () => {
      const contextWithExactUrl: StartingContext = {
        ...mockJourney.startingContext,
        exactUrl: 'https://example.com/login'
      };

      const result = await validator.validateContext(contextWithExactUrl, mockPage);
      expect(result.valid).toBe(true);

      // Test with wrong exact URL
      (mockPage.url as jest.Mock).mockReturnValue('https://example.com/signup');

      const resultWithWrongUrl = await validator.validateContext(contextWithExactUrl, mockPage);
      expect(resultWithWrongUrl.valid).toBe(false);
      expect(resultWithWrongUrl.errors).toContain(
        expect.stringMatching(/Exact URL.*does not match/)
      );
    });
  });

  describe('Journey Validation', () => {
    it('should validate complete journey successfully', async () => {
      const result = await validator.validateJourney(mockJourney);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toBeDefined();
    });

    it('should detect missing required fields', async () => {
      const invalidJourney = {
        ...mockJourney,
        name: '', // Missing name
        steps: [] // Empty steps
      };

      const result = await validator.validateJourney(invalidJourney);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringMatching(/Name is required/));
      expect(result.errors).toContain(expect.stringMatching(/At least one step is required/));
    });

    it('should validate step consistency', async () => {
      const journeyWithInconsistentSteps = {
        ...mockJourney,
        steps: [
          {
            id: 'step-1',
            action: 'fill' as const,
            selector: '#email',
            // Missing value for fill action
            description: 'Fill email',
            timestamp: new Date().toISOString(),
            url: 'https://example.com/login'
          }
        ]
      };

      const result = await validator.validateJourney(journeyWithInconsistentSteps);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        expect.stringMatching(/Fill action requires a value/)
      );
    });

    it('should warn about potential issues', async () => {
      const journeyWithPotentialIssues = {
        ...mockJourney,
        steps: [
          {
            id: 'step-1',
            action: 'click' as const,
            selector: 'div > div > div:nth-child(3) > button', // Brittle selector
            description: 'Click button',
            timestamp: new Date().toISOString(),
            url: 'https://example.com/login'
          }
        ]
      };

      const result = await validator.validateJourney(journeyWithPotentialIssues);

      expect(result.warnings).toContain(
        expect.stringMatching(/potentially brittle selector/)
      );
    });

    it('should validate URL consistency across steps', async () => {
      const journeyWithInconsistentUrls = {
        ...mockJourney,
        startingContext: {
          ...mockJourney.startingContext,
          urlPattern: 'https://app.example.com/*'
        },
        steps: [
          {
            id: 'step-1',
            action: 'click' as const,
            selector: '#button',
            description: 'Click button',
            timestamp: new Date().toISOString(),
            url: 'https://different-domain.com/page' // Inconsistent URL
          }
        ]
      };

      const result = await validator.validateJourney(journeyWithInconsistentUrls);

      expect(result.warnings).toContain(
        expect.stringMatching(/URL pattern mismatch/)
      );
    });
  });

  describe('Element Validation', () => {
    it('should validate element exists and is interactive', async () => {
      const element = {
        selector: '#submit-btn',
        type: 'button',
        description: 'Submit button'
      };

      const isValid = await validator.validateElement(element, mockPage);
      expect(isValid).toBe(true);
    });

    it('should detect non-existent elements', async () => {
      (mockPage.locator as jest.Mock).mockReturnValue({
        isVisible: jest.fn().mockResolvedValue(false),
        count: jest.fn().mockResolvedValue(0)
      });

      const element = {
        selector: '#missing-element',
        type: 'button',
        description: 'Missing button'
      };

      const isValid = await validator.validateElement(element, mockPage);
      expect(isValid).toBe(false);
    });

    it('should validate element type matches', async () => {
      (mockPage.locator as jest.Mock).mockReturnValue({
        isVisible: jest.fn().mockResolvedValue(true),
        count: jest.fn().mockResolvedValue(1),
        getAttribute: jest.fn().mockResolvedValue('submit') // button type
      });

      const element = {
        selector: '#submit-btn',
        type: 'button',
        description: 'Submit button'
      };

      const isValid = await validator.validateElement(element, mockPage);
      expect(isValid).toBe(true);
    });
  });

  describe('Compatibility Checking', () => {
    it('should check journey compatibility with current page', async () => {
      const compatibility = await validator.checkCompatibility(mockJourney, mockPage);

      expect(compatibility.compatible).toBe(true);
      expect(compatibility.confidence).toBeGreaterThan(0.8);
      expect(compatibility.issues).toHaveLength(0);
    });

    it('should detect compatibility issues', async () => {
      (mockPage.url as jest.Mock).mockReturnValue('https://wrong-site.com');
      (mockPage.locator as jest.Mock).mockReturnValue({
        isVisible: jest.fn().mockResolvedValue(false),
        count: jest.fn().mockResolvedValue(0)
      });

      const compatibility = await validator.checkCompatibility(mockJourney, mockPage);

      expect(compatibility.compatible).toBe(false);
      expect(compatibility.confidence).toBeLessThan(0.5);
      expect(compatibility.issues).toContain(
        expect.stringMatching(/URL pattern mismatch/)
      );
    });

    it('should suggest alternative journeys', async () => {
      const alternativeJourneys = [
        {
          ...mockJourney,
          id: 'alt-journey',
          name: 'Alternative Journey',
          startingContext: {
            ...mockJourney.startingContext,
            urlPattern: 'https://example.com/signup'
          }
        }
      ];

      (mockPage.url as jest.Mock).mockReturnValue('https://example.com/signup');

      const compatibility = await validator.checkCompatibility(
        mockJourney,
        mockPage,
        alternativeJourneys
      );

      expect(compatibility.alternatives).toHaveLength(1);
      expect(compatibility.alternatives![0].id).toBe('alt-journey');
    });
  });

  describe('Selector Validation', () => {
    it('should validate good selectors', () => {
      const goodSelectors = [
        '#unique-id',
        '[data-testid="test-element"]',
        '.well-named-class',
        'button[type="submit"]'
      ];

      goodSelectors.forEach(selector => {
        const result = validator.validateSelector(selector);
        expect(result.valid).toBe(true);
        expect(result.score).toBeGreaterThan(0.7);
      });
    });

    it('should detect brittle selectors', () => {
      const brittleSelectors = [
        'div > div > div:nth-child(3) > span',
        '.class1.class2.class3.class4.class5',
        'body > main > section:nth-of-type(2) > article:first-child > p'
      ];

      brittleSelectors.forEach(selector => {
        const result = validator.validateSelector(selector);
        expect(result.valid).toBe(false);
        expect(result.issues).toContain(
          expect.stringMatching(/potentially brittle/)
        );
      });
    });

    it('should suggest improvements for selectors', () => {
      const improvableSelector = 'div.content span';
      const result = validator.validateSelector(improvableSelector);

      expect(result.suggestions).toContain(
        expect.stringMatching(/Consider adding.*data-testid/)
      );
    });

    it('should validate xpath selectors', () => {
      const xpathSelector = '//button[contains(text(), "Submit")]';
      const result = validator.validateSelector(xpathSelector);

      expect(result.valid).toBe(true);
      expect(result.type).toBe('xpath');
    });
  });

  describe('Page State Validation', () => {
    it('should validate page state matches expected', async () => {
      const expectedState = {
        loggedIn: false,
        userType: 'guest',
        currentStep: 1
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue(expectedState);

      const isValid = await validator.validatePageState(expectedState, mockPage);
      expect(isValid).toBe(true);
    });

    it('should detect page state mismatches', async () => {
      const expectedState = {
        loggedIn: true,
        userType: 'admin'
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue({
        loggedIn: false,
        userType: 'guest'
      });

      const isValid = await validator.validatePageState(expectedState, mockPage);
      expect(isValid).toBe(false);
    });

    it('should handle complex state objects', async () => {
      const complexState = {
        user: {
          id: 123,
          name: 'John Doe',
          permissions: ['read', 'write']
        },
        cart: {
          items: 2,
          total: 29.99
        }
      };

      (mockPage.evaluate as jest.Mock).mockResolvedValue(complexState);

      const isValid = await validator.validatePageState(complexState, mockPage);
      expect(isValid).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle page evaluation errors gracefully', async () => {
      (mockPage.evaluate as jest.Mock).mockRejectedValue(new Error('Page not ready'));

      const result = await validator.validateContext(mockJourney.startingContext, mockPage);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        expect.stringMatching(/Error validating page state/)
      );
    });

    it('should handle element query errors', async () => {
      (mockPage.locator as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid selector');
      });

      const element = {
        selector: '<<<invalid>>>',
        type: 'button',
        description: 'Invalid selector'
      };

      const isValid = await validator.validateElement(element, mockPage);
      expect(isValid).toBe(false);
    });

    it('should provide meaningful error messages', async () => {
      (mockPage.url as jest.Mock).mockReturnValue('https://wrong-site.com');

      const result = await validator.validateContext(mockJourney.startingContext, mockPage);

      expect(result.errors[0]).toMatch(/URL pattern.*example\.com.*does not match.*wrong-site\.com/);
    });
  });

  describe('Recovery Suggestions', () => {
    it('should suggest recovery actions for common issues', async () => {
      (mockPage.locator as jest.Mock).mockReturnValue({
        isVisible: jest.fn().mockResolvedValue(false),
        count: jest.fn().mockResolvedValue(0)
      });

      const result = await validator.validateContext(mockJourney.startingContext, mockPage);

      expect(result.suggestions).toContain(
        expect.stringMatching(/Wait for page to fully load/)
      );
      expect(result.suggestions).toContain(
        expect.stringMatching(/Check if element selector has changed/)
      );
    });

    it('should suggest navigation corrections', async () => {
      (mockPage.url as jest.Mock).mockReturnValue('https://example.com/wrong-page');

      const result = await validator.validateContext(mockJourney.startingContext, mockPage);

      expect(result.suggestions).toContain(
        expect.stringMatching(/Navigate to the correct starting URL/)
      );
    });

    it('should suggest element selector alternatives', async () => {
      const contextWithMissingElement = {
        ...mockJourney.startingContext,
        requiredElements: [
          {
            selector: '#old-button-id',
            type: 'button',
            description: 'Submit button'
          }
        ]
      };

      (mockPage.locator as jest.Mock).mockReturnValue({
        isVisible: jest.fn().mockResolvedValue(false),
        count: jest.fn().mockResolvedValue(0)
      });

      const result = await validator.validateContext(contextWithMissingElement, mockPage);

      expect(result.suggestions).toContain(
        expect.stringMatching(/Try alternative selectors/)
      );
    });
  });
});