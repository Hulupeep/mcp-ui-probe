import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { JourneyDiscovery } from '../../src/journey/JourneyDiscovery.js';
import { Journey, JourneySearchCriteria } from '../../src/types/journey.js';
import { Page } from 'playwright';

// Mock JourneyStorage
const mockStorage = {
  searchJourneys: jest.fn(),
  listJourneys: jest.fn(),
  getJourneysByTag: jest.fn(),
  getJourneysByCategory: jest.fn(),
  loadJourney: jest.fn()
};

// Mock JourneyValidator
const mockValidator = {
  checkCompatibility: jest.fn()
};

// Mock Playwright Page
const mockPage = {
  url: jest.fn(),
  title: jest.fn(),
  locator: jest.fn(),
  evaluate: jest.fn()
} as unknown as Page;

describe('JourneyDiscovery', () => {
  let discovery: JourneyDiscovery;
  let mockJourneys: Journey[];

  beforeEach(() => {
    discovery = new JourneyDiscovery(mockStorage as any, mockValidator as any);

    mockJourneys = [
      {
        id: 'journey-1',
        name: 'Login to Example App',
        description: 'Complete login flow for example.com',
        tags: ['authentication', 'login', 'example.com'],
        category: 'authentication',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
        startingContext: {
          urlPattern: 'https://example.com/*',
          exactUrl: 'https://example.com/login',
          requiredElements: [
            { selector: '#email', type: 'input', description: 'Email field' }
          ],
          pageState: {}
        },
        steps: [
          {
            id: 'step-1',
            action: 'fill',
            selector: '#email',
            value: 'user@example.com',
            description: 'Fill email',
            timestamp: '2024-01-01T10:00:00Z',
            url: 'https://example.com/login'
          }
        ],
        metadata: {
          author: 'Test',
          version: '1.0.0',
          successRate: 0.95,
          avgDurationMs: 3000,
          usageCount: 50,
          difficulty: 'easy',
          environment: ['desktop'],
          browserCompatibility: ['chromium']
        }
      },
      {
        id: 'journey-2',
        name: 'Shopping Cart Checkout',
        description: 'Complete purchase flow in e-commerce site',
        tags: ['e-commerce', 'checkout', 'shopping'],
        category: 'e-commerce',
        createdAt: '2024-01-02T10:00:00Z',
        updatedAt: '2024-01-02T10:00:00Z',
        startingContext: {
          urlPattern: 'https://shop.example.com/*',
          requiredElements: [],
          pageState: {}
        },
        steps: [
          {
            id: 'step-1',
            action: 'click',
            selector: '#add-to-cart',
            description: 'Add item to cart',
            timestamp: '2024-01-02T10:00:00Z',
            url: 'https://shop.example.com/product/123'
          }
        ],
        metadata: {
          author: 'Test',
          version: '1.0.0',
          successRate: 0.88,
          avgDurationMs: 5000,
          usageCount: 25,
          difficulty: 'medium',
          environment: ['desktop'],
          browserCompatibility: ['chromium']
        }
      },
      {
        id: 'journey-3',
        name: 'Admin User Management',
        description: 'Create and manage users in admin panel',
        tags: ['admin', 'user-management', 'example.com'],
        category: 'administration',
        createdAt: '2024-01-03T10:00:00Z',
        updatedAt: '2024-01-03T10:00:00Z',
        startingContext: {
          urlPattern: 'https://admin.example.com/*',
          requiredElements: [],
          pageState: { userRole: 'admin' }
        },
        steps: [
          {
            id: 'step-1',
            action: 'click',
            selector: '#create-user',
            description: 'Create new user',
            timestamp: '2024-01-03T10:00:00Z',
            url: 'https://admin.example.com/users'
          }
        ],
        metadata: {
          author: 'Admin',
          version: '1.0.0',
          successRate: 0.92,
          avgDurationMs: 4000,
          usageCount: 15,
          difficulty: 'hard',
          environment: ['desktop'],
          browserCompatibility: ['chromium']
        }
      }
    ];

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    (mockStorage.listJourneys as jest.Mock).mockResolvedValue(mockJourneys);
    (mockStorage.searchJourneys as jest.Mock).mockResolvedValue({
      journeys: mockJourneys,
      total: mockJourneys.length,
      hasMore: false
    });
    (mockValidator.checkCompatibility as jest.Mock).mockResolvedValue({
      compatible: true,
      confidence: 0.9,
      issues: []
    });
    (mockPage.url as jest.Mock).mockReturnValue('https://example.com/test');
  });

  describe('Journey Discovery', () => {
    it('should discover compatible journeys for current page', async () => {
      const results = await discovery.discoverCompatibleJourneys(mockPage);

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({
        journey: expect.objectContaining({ id: 'journey-1' }),
        compatibility: expect.objectContaining({ compatible: true }),
        relevanceScore: expect.any(Number)
      });
      expect(mockValidator.checkCompatibility).toHaveBeenCalledTimes(3);
    });

    it('should filter out incompatible journeys', async () => {
      (mockValidator.checkCompatibility as jest.Mock)
        .mockResolvedValueOnce({ compatible: true, confidence: 0.9, issues: [] })
        .mockResolvedValueOnce({ compatible: false, confidence: 0.2, issues: ['URL mismatch'] })
        .mockResolvedValueOnce({ compatible: true, confidence: 0.8, issues: [] });

      const results = await discovery.discoverCompatibleJourneys(mockPage);

      expect(results).toHaveLength(2);
      expect(results.map(r => r.journey.id)).toEqual(['journey-1', 'journey-3']);
    });

    it('should sort results by relevance score', async () => {
      (mockValidator.checkCompatibility as jest.Mock)
        .mockResolvedValueOnce({ compatible: true, confidence: 0.6, issues: [] })
        .mockResolvedValueOnce({ compatible: true, confidence: 0.9, issues: [] })
        .mockResolvedValueOnce({ compatible: true, confidence: 0.7, issues: [] });

      const results = await discovery.discoverCompatibleJourneys(mockPage);

      expect(results[0].journey.id).toBe('journey-2'); // Highest confidence
      expect(results[1].journey.id).toBe('journey-3');
      expect(results[2].journey.id).toBe('journey-1'); // Lowest confidence
    });

    it('should limit results when specified', async () => {
      const results = await discovery.discoverCompatibleJourneys(mockPage, { limit: 2 });

      expect(results).toHaveLength(2);
    });

    it('should include only specific categories when filtered', async () => {
      const results = await discovery.discoverCompatibleJourneys(mockPage, {
        categories: ['authentication']
      });

      // Mock should filter by category
      expect(mockStorage.searchJourneys).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'authentication'
        })
      );
    });
  });

  describe('Journey Search', () => {
    it('should search journeys with text query', async () => {
      const criteria: JourneySearchCriteria = {
        query: 'login',
        limit: 10
      };

      await discovery.searchJourneys(criteria);

      expect(mockStorage.searchJourneys).toHaveBeenCalledWith(criteria);
    });

    it('should search by tags', async () => {
      const criteria: JourneySearchCriteria = {
        tags: ['e-commerce', 'checkout'],
        limit: 10
      };

      await discovery.searchJourneys(criteria);

      expect(mockStorage.searchJourneys).toHaveBeenCalledWith(criteria);
    });

    it('should search by category', async () => {
      const criteria: JourneySearchCriteria = {
        category: 'authentication',
        limit: 10
      };

      await discovery.searchJourneys(criteria);

      expect(mockStorage.searchJourneys).toHaveBeenCalledWith(criteria);
    });

    it('should combine multiple search criteria', async () => {
      const criteria: JourneySearchCriteria = {
        query: 'login',
        tags: ['authentication'],
        category: 'authentication',
        authorFilter: 'Test',
        minSuccessRate: 0.9,
        limit: 5
      };

      await discovery.searchJourneys(criteria);

      expect(mockStorage.searchJourneys).toHaveBeenCalledWith(criteria);
    });
  });

  describe('Recommendations', () => {
    it('should recommend journeys based on current page URL', async () => {
      (mockPage.url as jest.Mock).mockReturnValue('https://example.com/login');

      const recommendations = await discovery.getRecommendations(mockPage);

      expect(recommendations).toHaveLength(3);
      expect(recommendations[0].reason).toContain('URL pattern match');
    });

    it('should recommend based on page content', async () => {
      (mockPage.evaluate as jest.Mock).mockResolvedValue({
        hasLoginForm: true,
        hasEmailField: true,
        hasPasswordField: true
      });

      const recommendations = await discovery.getRecommendations(mockPage);

      expect(recommendations.some(r =>
        r.journey.category === 'authentication'
      )).toBe(true);
    });

    it('should prioritize high-success journeys', async () => {
      const recommendations = await discovery.getRecommendations(mockPage);

      // Journey with highest success rate should be first
      const successRates = recommendations.map(r => r.journey.metadata.successRate);
      expect(successRates[0]).toBeGreaterThanOrEqual(successRates[1]);
    });

    it('should include usage-based recommendations', async () => {
      const recommendations = await discovery.getRecommendations(mockPage);

      const popularJourney = recommendations.find(r =>
        r.journey.metadata.usageCount >= 50
      );
      expect(popularJourney).toBeDefined();
      expect(popularJourney?.reason).toContain('popular');
    });
  });

  describe('Related Journeys', () => {
    it('should find journeys with same domain', async () => {
      const baseJourney = mockJourneys[0]; // example.com journey
      const related = await discovery.findRelatedJourneys(baseJourney);

      const sameDomainJourneys = related.filter(r =>
        r.journey.tags.includes('example.com')
      );
      expect(sameDomainJourneys.length).toBeGreaterThan(0);
    });

    it('should find journeys with similar tags', async () => {
      const baseJourney = mockJourneys[0]; // Has 'authentication' tag
      const related = await discovery.findRelatedJourneys(baseJourney);

      expect(related.some(r =>
        r.relationship === 'similar-tags' &&
        r.journey.tags.includes('authentication')
      )).toBe(true);
    });

    it('should find journeys in same category', async () => {
      const baseJourney = mockJourneys[0]; // authentication category
      const related = await discovery.findRelatedJourneys(baseJourney);

      expect(related.some(r =>
        r.relationship === 'same-category' &&
        r.journey.category === 'authentication'
      )).toBe(true);
    });

    it('should find sequential journeys', async () => {
      // Mock a journey that could follow the login journey
      const followupJourneys = [
        {
          ...mockJourneys[0],
          id: 'journey-followup',
          name: 'Dashboard Navigation',
          startingContext: {
            urlPattern: 'https://example.com/dashboard',
            requiredElements: [],
            pageState: { loggedIn: true }
          }
        }
      ];

      (mockStorage.listJourneys as jest.Mock).mockResolvedValue([
        ...mockJourneys,
        ...followupJourneys
      ]);

      const baseJourney = mockJourneys[0];
      const related = await discovery.findRelatedJourneys(baseJourney);

      expect(related.some(r => r.relationship === 'sequential')).toBe(true);
    });
  });

  describe('Smart Collections', () => {
    it('should create collection by domain', async () => {
      const collection = await discovery.createSmartCollection({
        type: 'domain',
        value: 'example.com',
        name: 'Example.com Journeys'
      });

      expect(collection.name).toBe('Example.com Journeys');
      expect(collection.journeyIds).toContain('journey-1');
      expect(collection.journeyIds).toContain('journey-3');
      expect(collection.journeyIds).not.toContain('journey-2'); // Different domain
    });

    it('should create collection by category', async () => {
      const collection = await discovery.createSmartCollection({
        type: 'category',
        value: 'authentication',
        name: 'Authentication Flows'
      });

      expect(collection.name).toBe('Authentication Flows');
      expect(collection.journeyIds).toContain('journey-1');
      expect(collection.journeyIds).not.toContain('journey-2'); // Different category
    });

    it('should create collection by difficulty', async () => {
      const collection = await discovery.createSmartCollection({
        type: 'difficulty',
        value: 'easy',
        name: 'Beginner Journeys'
      });

      expect(collection.name).toBe('Beginner Journeys');
      expect(collection.journeyIds).toContain('journey-1'); // Easy difficulty
    });

    it('should create collection by author', async () => {
      const collection = await discovery.createSmartCollection({
        type: 'author',
        value: 'Test',
        name: 'Test Author Journeys'
      });

      expect(collection.journeyIds).toContain('journey-1');
      expect(collection.journeyIds).toContain('journey-2');
      expect(collection.journeyIds).not.toContain('journey-3'); // Different author
    });

    it('should create collection by success rate', async () => {
      const collection = await discovery.createSmartCollection({
        type: 'success-rate',
        value: 0.9,
        name: 'High Success Rate Journeys'
      });

      // Should include journeys with >= 90% success rate
      const highSuccessJourneys = mockJourneys.filter(j => j.metadata.successRate >= 0.9);
      highSuccessJourneys.forEach(journey => {
        expect(collection.journeyIds).toContain(journey.id);
      });
    });
  });

  describe('Context-Aware Discovery', () => {
    it('should consider page elements when discovering', async () => {
      (mockPage.locator as jest.Mock).mockReturnValue({
        count: jest.fn().mockResolvedValue(1),
        isVisible: jest.fn().mockResolvedValue(true)
      });

      const results = await discovery.discoverCompatibleJourneys(mockPage, {
        includeElementAnalysis: true
      });

      expect(mockPage.locator).toHaveBeenCalled();
      expect(results.length).toBeGreaterThan(0);
    });

    it('should consider page state when discovering', async () => {
      (mockPage.evaluate as jest.Mock).mockResolvedValue({
        userRole: 'admin',
        isLoggedIn: true
      });

      const results = await discovery.discoverCompatibleJourneys(mockPage, {
        includeStateAnalysis: true
      });

      // Should find admin journeys when user is admin
      const adminJourney = results.find(r =>
        r.journey.startingContext.pageState?.userRole === 'admin'
      );
      expect(adminJourney).toBeDefined();
    });

    it('should weight journeys by compatibility confidence', async () => {
      (mockValidator.checkCompatibility as jest.Mock)
        .mockResolvedValueOnce({ compatible: true, confidence: 0.95, issues: [] })
        .mockResolvedValueOnce({ compatible: true, confidence: 0.75, issues: [] })
        .mockResolvedValueOnce({ compatible: true, confidence: 0.85, issues: [] });

      const results = await discovery.discoverCompatibleJourneys(mockPage);

      // Results should be ordered by confidence (highest first)
      expect(results[0].compatibility.confidence).toBe(0.95);
      expect(results[1].compatibility.confidence).toBe(0.85);
      expect(results[2].compatibility.confidence).toBe(0.75);
    });
  });

  describe('Performance and Caching', () => {
    it('should cache discovery results', async () => {
      const url = 'https://example.com/test';
      (mockPage.url as jest.Mock).mockReturnValue(url);

      // First call
      await discovery.discoverCompatibleJourneys(mockPage);

      // Second call with same URL
      await discovery.discoverCompatibleJourneys(mockPage);

      // Storage should only be called once due to caching
      expect(mockStorage.listJourneys).toHaveBeenCalledTimes(1);
    });

    it('should handle large journey collections efficiently', async () => {
      const largeJourneySet = Array.from({ length: 1000 }, (_, i) => ({
        ...mockJourneys[0],
        id: `journey-${i}`,
        name: `Journey ${i}`
      }));

      (mockStorage.listJourneys as jest.Mock).mockResolvedValue(largeJourneySet);

      const startTime = Date.now();
      const results = await discovery.discoverCompatibleJourneys(mockPage, { limit: 10 });
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      (mockStorage.listJourneys as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const results = await discovery.discoverCompatibleJourneys(mockPage);

      expect(results).toEqual([]);
    });

    it('should handle validation errors gracefully', async () => {
      (mockValidator.checkCompatibility as jest.Mock).mockRejectedValue(new Error('Validation error'));

      const results = await discovery.discoverCompatibleJourneys(mockPage);

      // Should return journeys but without compatibility data
      expect(results).toHaveLength(0);
    });

    it('should handle page evaluation errors', async () => {
      (mockPage.evaluate as jest.Mock).mockRejectedValue(new Error('Page not ready'));

      const recommendations = await discovery.getRecommendations(mockPage);

      // Should still provide basic recommendations
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });
});