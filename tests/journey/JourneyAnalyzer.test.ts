import { describe, it, expect, beforeEach } from '@jest/globals';
import { JourneyAnalyzer } from '../../src/journey/JourneyAnalyzer.js';
import { Journey } from '../../src/types/journey.js';

describe('JourneyAnalyzer', () => {
  let analyzer: JourneyAnalyzer;

  const createTestJourney = (overrides: Partial<Journey> = {}): Journey => ({
    id: 'test-journey-1',
    name: 'Test Journey',
    description: 'A test journey',
    tags: [],
    category: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startingContext: {
      urlPattern: 'https://shop.example.com/*',
      exactUrl: 'https://shop.example.com/login',
      requiredElements: [
        {
          selector: '#email',
          type: 'input',
          description: 'Email input'
        },
        {
          selector: '#password',
          type: 'input',
          description: 'Password input'
        }
      ],
      pageState: {}
    },
    steps: [
      {
        id: 'step-1',
        action: 'fill',
        selector: '#email',
        value: 'user@example.com',
        description: 'Fill email field',
        timestamp: new Date().toISOString(),
        url: 'https://shop.example.com/login'
      },
      {
        id: 'step-2',
        action: 'fill',
        selector: '#password',
        value: 'password123',
        description: 'Fill password field',
        timestamp: new Date().toISOString(),
        url: 'https://shop.example.com/login'
      },
      {
        id: 'step-3',
        action: 'click',
        selector: '#login-button',
        description: 'Click login button',
        timestamp: new Date().toISOString(),
        url: 'https://shop.example.com/login'
      }
    ],
    metadata: {
      author: 'Test Suite',
      version: '1.0.0',
      successRate: 0.85,
      avgDurationMs: 3000,
      usageCount: 10,
      difficulty: 'medium',
      environment: ['desktop'],
      browserCompatibility: ['chromium']
    },
    ...overrides
  });

  beforeEach(() => {
    analyzer = new JourneyAnalyzer();
  });

  describe('Rule-based Analysis', () => {
    it('should analyze a login journey', async () => {
      const journey = createTestJourney();

      const analysis = await analyzer.analyzeJourney(journey);

      expect(analysis.suggestedName).toContain('Login');
      expect(analysis.suggestedName).toContain('shop.example.com');
      expect(analysis.suggestedDescription).toContain('step');
      expect(analysis.suggestedTags).toContain('shop.example.com');
      expect(analysis.suggestedTags).toContain('authentication');
      expect(analysis.suggestedCategory).toBe('authentication');
      expect(analysis.estimatedDifficulty).toBe('easy'); // Login is typically easy
    });

    it('should analyze an e-commerce journey', async () => {
      const journey = createTestJourney({
        startingContext: {
          ...createTestJourney().startingContext,
          urlPattern: 'https://store.example.com/checkout/*',
          exactUrl: 'https://store.example.com/checkout'
        },
        steps: [
          {
            id: 'step-1',
            action: 'fill',
            selector: '#shipping-address',
            value: '123 Main St',
            description: 'Fill shipping address',
            timestamp: new Date().toISOString(),
            url: 'https://store.example.com/checkout'
          },
          {
            id: 'step-2',
            action: 'fill',
            selector: '#credit-card',
            value: '4111111111111111',
            description: 'Fill credit card number',
            timestamp: new Date().toISOString(),
            url: 'https://store.example.com/checkout'
          },
          {
            id: 'step-3',
            action: 'click',
            selector: '#complete-purchase',
            description: 'Complete purchase',
            timestamp: new Date().toISOString(),
            url: 'https://store.example.com/checkout'
          }
        ]
      });

      const analysis = await analyzer.analyzeJourney(journey);

      expect(analysis.suggestedName).toContain('Checkout');
      expect(analysis.suggestedTags).toContain('e-commerce');
      expect(analysis.suggestedCategory).toBe('e-commerce');
    });

    it('should identify potential issues in brittle selectors', async () => {
      const journey = createTestJourney({
        steps: [
          {
            id: 'step-1',
            action: 'click',
            selector: 'div > div > div:nth-child(3) > button',
            description: 'Click complex selector',
            timestamp: new Date().toISOString(),
            url: 'https://example.com'
          },
          {
            id: 'step-2',
            action: 'click',
            selector: '.class1.class2.class3.class4.class5',
            description: 'Click long class chain',
            timestamp: new Date().toISOString(),
            url: 'https://example.com'
          }
        ]
      });

      const analysis = await analyzer.analyzeJourney(journey);

      expect(analysis.potentialIssues).toContain(
        expect.stringMatching(/potentially brittle selectors/)
      );
      expect(analysis.optimizationSuggestions).toContain(
        expect.stringMatching(/data-testid/)
      );
    });

    it('should suggest optimizations for long journeys', async () => {
      const longSteps = Array.from({ length: 20 }, (_, i) => ({
        id: `step-${i + 1}`,
        action: 'fill' as const,
        selector: `#field-${i + 1}`,
        value: `value-${i + 1}`,
        description: `Fill field ${i + 1}`,
        timestamp: new Date().toISOString(),
        url: 'https://example.com'
      }));

      const journey = createTestJourney({
        steps: longSteps
      });

      const analysis = await analyzer.analyzeJourney(journey);

      expect(analysis.estimatedDifficulty).toBe('hard');
      expect(analysis.potentialIssues).toContain(
        expect.stringMatching(/Long journey without validation/)
      );
      expect(analysis.optimizationSuggestions).toContain(
        expect.stringMatching(/validation checkpoints/)
      );
    });

    it('should assess difficulty correctly', async () => {
      // Simple journey (easy)
      const simpleJourney = createTestJourney({
        steps: [
          {
            id: 'step-1',
            action: 'click',
            selector: '#simple-button',
            description: 'Click button',
            timestamp: new Date().toISOString(),
            url: 'https://example.com'
          }
        ]
      });

      const simpleAnalysis = await analyzer.analyzeJourney(simpleJourney);
      expect(simpleAnalysis.estimatedDifficulty).toBe('easy');

      // Complex journey (hard)
      const complexSteps = Array.from({ length: 25 }, (_, i) => ({
        id: `step-${i + 1}`,
        action: i % 3 === 0 ? 'upload' as const : 'fill' as const,
        selector: `div > div:nth-child(${i + 1}) > input.complex.selector`,
        description: `Complex step ${i + 1}`,
        timestamp: new Date().toISOString(),
        url: 'https://example.com'
      }));

      const complexJourney = createTestJourney({
        steps: complexSteps,
        metadata: {
          ...createTestJourney().metadata,
          successRate: 0.6
        }
      });

      const complexAnalysis = await analyzer.analyzeJourney(complexJourney);
      expect(complexAnalysis.estimatedDifficulty).toBe('hard');
    });
  });

  describe('Journey Comparison', () => {
    it('should find similar journeys', async () => {
      const journey1 = createTestJourney({
        id: 'journey-1',
        startingContext: {
          ...createTestJourney().startingContext,
          urlPattern: 'https://app.example.com/*'
        },
        tags: ['authentication', 'login']
      });

      const journey2 = createTestJourney({
        id: 'journey-2',
        startingContext: {
          ...createTestJourney().startingContext,
          urlPattern: 'https://app.example.com/*'
        },
        tags: ['authentication', 'signup']
      });

      const journey3 = createTestJourney({
        id: 'journey-3',
        startingContext: {
          ...createTestJourney().startingContext,
          urlPattern: 'https://shop.different.com/*'
        },
        tags: ['e-commerce', 'checkout']
      });

      const allJourneys = [journey1, journey2, journey3];
      const similarJourneys = await analyzer.findSimilarJourneys(journey1, allJourneys);

      expect(similarJourneys).toHaveLength(1);
      expect(similarJourneys[0].journey.id).toBe('journey-2');
      expect(similarJourneys[0].similarity).toBeGreaterThan(0.5);
      expect(similarJourneys[0].reasons).toContain('Same domain');
    });

    it('should calculate similarity correctly', async () => {
      const baseJourney = createTestJourney();

      // Very similar journey (same domain, same actions)
      const similarJourney = createTestJourney({
        id: 'similar-journey',
        tags: ['authentication']
      });

      // Different journey (different domain, different actions)
      const differentJourney = createTestJourney({
        id: 'different-journey',
        startingContext: {
          ...createTestJourney().startingContext,
          urlPattern: 'https://completely-different.com/*'
        },
        steps: [
          {
            id: 'step-1',
            action: 'upload',
            selector: '#file-upload',
            description: 'Upload file',
            timestamp: new Date().toISOString(),
            url: 'https://completely-different.com'
          }
        ],
        tags: ['file-management']
      });

      const allJourneys = [baseJourney, similarJourney, differentJourney];
      const results = await analyzer.findSimilarJourneys(baseJourney, allJourneys);

      if (results.length > 1) {
        expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
      }
    });
  });

  describe('Tag and Category Generation', () => {
    it('should generate appropriate tags for different domains', async () => {
      const ecommerceJourney = createTestJourney({
        startingContext: {
          ...createTestJourney().startingContext,
          urlPattern: 'https://shop.example.com/*'
        }
      });

      const analysis = await analyzer.analyzeJourney(ecommerceJourney);
      expect(analysis.suggestedTags).toContain('shop.example.com');
      expect(analysis.suggestedTags).toContain('e-commerce');
    });

    it('should categorize admin journeys correctly', async () => {
      const adminJourney = createTestJourney({
        startingContext: {
          ...createTestJourney().startingContext,
          urlPattern: 'https://admin.example.com/*'
        },
        steps: [
          {
            id: 'step-1',
            action: 'click',
            selector: '#create-user',
            description: 'Create new user',
            timestamp: new Date().toISOString(),
            url: 'https://admin.example.com'
          }
        ]
      });

      const analysis = await analyzer.analyzeJourney(adminJourney);
      expect(analysis.suggestedCategory).toBe('content-management');
      expect(analysis.suggestedTags).toContain('admin');
    });
  });

  describe('Error Handling', () => {
    it('should handle journeys with minimal information', async () => {
      const minimalJourney = createTestJourney({
        steps: [],
        tags: [],
        startingContext: {
          urlPattern: '',
          requiredElements: [],
          pageState: {}
        }
      });

      const analysis = await analyzer.analyzeJourney(minimalJourney);

      expect(analysis.suggestedName).toBeDefined();
      expect(analysis.suggestedDescription).toBeDefined();
      expect(analysis.suggestedTags).toEqual([]);
      expect(analysis.estimatedDifficulty).toBe('easy');
    });
  });
});