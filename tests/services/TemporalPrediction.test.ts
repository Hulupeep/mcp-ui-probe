/**
 * Tests for TemporalPrediction service
 */

import { TemporalPrediction } from '../../src/services/TemporalPrediction.js';
import type { PredictionContext } from '../../src/services/TemporalPrediction.js';

describe('TemporalPrediction', () => {
  let prediction: TemporalPrediction;

  beforeEach(() => {
    prediction = new TemporalPrediction();
  });

  describe('predictNextSteps', () => {
    it('should predict checkout workflow steps', async () => {
      const context: PredictionContext = {
        currentUrl: 'https://example.com/cart',
        currentStep: 'view_cart',
        previousActions: ['add_to_cart'],
        pageState: {
          title: 'Shopping Cart',
          visibleElements: {
            buttons: [{ text: 'Proceed to Checkout' }],
            inputs: []
          },
          forms: []
        },
        goal: 'complete purchase'
      };

      const result = await prediction.predictNextSteps(context, 2);

      expect(result.shouldUsePredictions).toBe(true);
      expect(result.predictions.length).toBeGreaterThan(0);
      expect(result.predictions.length).toBeLessThanOrEqual(2);
      expect(result.predictionDepth).toBeGreaterThan(0);

      // Check first prediction
      const firstPrediction = result.predictions[0];
      expect(firstPrediction).toHaveProperty('action');
      expect(firstPrediction).toHaveProperty('target');
      expect(firstPrediction).toHaveProperty('confidence');
      expect(firstPrediction.confidence).toBeGreaterThan(0.5);
      expect(firstPrediction).toHaveProperty('expectedOutcome');
    });

    it('should predict registration workflow steps', async () => {
      const context: PredictionContext = {
        currentUrl: 'https://example.com/signup',
        currentStep: 'view_signup',
        previousActions: [],
        pageState: {
          title: 'Sign Up',
          visibleElements: {
            buttons: [{ text: 'Create Account' }],
            inputs: [
              { name: 'email', type: 'email' },
              { name: 'password', type: 'password' }
            ]
          },
          forms: [{ fields: ['email', 'password'] }]
        },
        goal: 'register new account'
      };

      const result = await prediction.predictNextSteps(context, 3);

      expect(result.shouldUsePredictions).toBe(true);
      expect(result.predictions.length).toBeGreaterThan(0);

      // Should predict email, password, submit steps
      const actions = result.predictions.map(p => p.action);
      expect(actions).toContain('fill_email');
    });

    it('should respect max depth constraint', async () => {
      const context: PredictionContext = {
        currentUrl: 'https://example.com/checkout',
        currentStep: 'checkout',
        previousActions: [],
        pageState: {
          title: 'Checkout',
          visibleElements: { buttons: [], inputs: [] },
          forms: []
        },
        goal: 'complete checkout'
      };

      const result = await prediction.predictNextSteps(context, 10); // Request 10

      expect(result.predictions.length).toBeLessThanOrEqual(3); // Max is 3
      expect(result.warnings).toContain('Depth limited to 3 (requested 10)');
    });

    it('should disable predictions when in cooldown', async () => {
      const context: PredictionContext = {
        currentUrl: 'https://example.com/page',
        currentStep: 'test',
        previousActions: [],
        pageState: {
          title: 'Test Page',
          visibleElements: { buttons: [], inputs: [] },
          forms: []
        },
        goal: 'test goal'
      };

      // Simulate 5 consecutive failures to trigger cooldown
      for (let i = 0; i < 5; i++) {
        const result = await prediction.predictNextSteps(context, 1);
        if (result.predictions.length > 0) {
          await prediction.validatePrediction(result.predictions[0], {
            url: 'https://example.com/wrong',
            title: 'Wrong Page',
            success: false
          });
        }
      }

      // Next prediction should be disabled
      const result = await prediction.predictNextSteps(context, 1);
      expect(result.shouldUsePredictions).toBe(false);
      expect(result.fallbackReason).toContain('cooldown');
    });
  });

  describe('validatePrediction', () => {
    it('should mark prediction as accurate when outcome matches', async () => {
      const predicted = {
        action: 'proceed_to_checkout',
        target: 'checkout button',
        reasoning: 'Standard checkout flow',
        confidence: 0.8,
        expectedOutcome: {
          urlPattern: '/checkout',
          titlePattern: 'checkout',
          expectedElements: ['shipping', 'payment']
        }
      };

      const actual = {
        url: 'https://example.com/checkout',
        title: 'Checkout - Step 1',
        success: true,
        elements: ['shipping-form', 'payment-info']
      };

      const validation = await prediction.validatePrediction(predicted, actual);

      expect(validation.accurate).toBe(true);
      expect(validation.divergence).toBeLessThan(0.3);
      expect(validation.issues.length).toBe(0);
    });

    it('should mark prediction as inaccurate when outcome diverges', async () => {
      const predicted = {
        action: 'submit_login',
        target: 'login button',
        reasoning: 'Login flow',
        confidence: 0.8,
        expectedOutcome: {
          urlPattern: '/dashboard',
          titlePattern: 'dashboard',
          expectedElements: ['welcome', 'user-menu']
        }
      };

      const actual = {
        url: 'https://example.com/login?error=invalid',
        title: 'Login Failed',
        success: false,
        elements: ['error-message']
      };

      const validation = await prediction.validatePrediction(predicted, actual);

      expect(validation.accurate).toBe(false);
      expect(validation.divergence).toBeGreaterThan(0.3);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should detect URL mismatch', async () => {
      const predicted = {
        action: 'test',
        target: 'test',
        reasoning: 'test',
        confidence: 0.8,
        expectedOutcome: {
          urlPattern: '/success'
        }
      };

      const actual = {
        url: 'https://example.com/error',
        title: 'Error Page',
        success: false
      };

      const validation = await prediction.validatePrediction(predicted, actual);

      expect(validation.issues).toContain('URL did not match prediction');
    });

    it('should detect title mismatch', async () => {
      const predicted = {
        action: 'test',
        target: 'test',
        reasoning: 'test',
        confidence: 0.8,
        expectedOutcome: {
          titlePattern: 'success'
        }
      };

      const actual = {
        url: 'https://example.com/page',
        title: 'Failure Page',
        success: true
      };

      const validation = await prediction.validatePrediction(predicted, actual);

      expect(validation.issues).toContain('Page title did not match prediction');
    });

    it('should detect missing expected elements', async () => {
      const predicted = {
        action: 'test',
        target: 'test',
        reasoning: 'test',
        confidence: 0.8,
        expectedOutcome: {
          expectedElements: ['element1', 'element2', 'element3']
        }
      };

      const actual = {
        url: 'https://example.com/page',
        title: 'Test Page',
        success: true,
        elements: ['element1'] // Missing element2 and element3
      };

      const validation = await prediction.validatePrediction(predicted, actual);

      expect(validation.issues).toContain('Expected elements not found on page');
    });
  });

  describe('metrics and adaptive behavior', () => {
    it('should track accuracy metrics', async () => {
      const context: PredictionContext = {
        currentUrl: 'https://example.com/test',
        currentStep: 'test',
        previousActions: [],
        pageState: {
          title: 'Test',
          visibleElements: { buttons: [], inputs: [] },
          forms: []
        },
        goal: 'test'
      };

      // Make some predictions and validate them
      for (let i = 0; i < 10; i++) {
        const result = await prediction.predictNextSteps(context, 1);
        if (result.predictions.length > 0) {
          await prediction.validatePrediction(result.predictions[0], {
            url: 'https://example.com/test',
            title: 'Test',
            success: true
          });
        }
      }

      const metrics = prediction.getMetrics();
      expect(metrics.totalPredictions).toBeGreaterThan(0);
      expect(metrics.accuracyRate).toBeGreaterThanOrEqual(0);
      expect(metrics.accuracyRate).toBeLessThanOrEqual(1);
    });

    it('should disable predictions when accuracy is too low', async () => {
      const context: PredictionContext = {
        currentUrl: 'https://example.com/test',
        currentStep: 'test',
        previousActions: [],
        pageState: {
          title: 'Test',
          visibleElements: { buttons: [], inputs: [] },
          forms: []
        },
        goal: 'test'
      };

      // Simulate 20 failed predictions to lower accuracy
      for (let i = 0; i < 20; i++) {
        const result = await prediction.predictNextSteps(context, 1);
        if (result.predictions.length > 0) {
          await prediction.validatePrediction(result.predictions[0], {
            url: 'https://example.com/wrong',
            title: 'Wrong',
            success: false
          });
        }
      }

      const metrics = prediction.getMetrics();
      expect(metrics.accuracyRate).toBeLessThan(0.7);

      const available = prediction.isPredictionAvailable();
      expect(available).toBe(false);
    });

    it('should reset metrics correctly', () => {
      // Generate some history first
      const context: PredictionContext = {
        currentUrl: 'https://example.com/test',
        currentStep: 'test',
        previousActions: [],
        pageState: {
          title: 'Test',
          visibleElements: { buttons: [], inputs: [] },
          forms: []
        },
        goal: 'test'
      };

      prediction.resetMetrics();

      const metrics = prediction.getMetrics();
      expect(metrics.totalPredictions).toBe(0);
      expect(metrics.accuratePredictions).toBe(0);
      expect(metrics.inaccuratePredictions).toBe(0);
      expect(metrics.accuracyRate).toBe(1.0);
    });
  });

  describe('workflow detection', () => {
    it('should detect checkout workflow', async () => {
      const context: PredictionContext = {
        currentUrl: 'https://example.com/cart',
        currentStep: 'cart',
        previousActions: [],
        pageState: {
          title: 'Shopping Cart',
          visibleElements: { buttons: [], inputs: [] },
          forms: []
        },
        goal: 'buy product'
      };

      const result = await prediction.predictNextSteps(context, 2);
      const actions = result.predictions.map(p => p.action);

      // Should predict checkout-related actions
      expect(actions.some(a => a.includes('checkout') || a.includes('payment'))).toBe(true);
    });

    it('should detect registration workflow', async () => {
      const context: PredictionContext = {
        currentUrl: 'https://example.com/register',
        currentStep: 'register',
        previousActions: [],
        pageState: {
          title: 'Create Account',
          visibleElements: { buttons: [], inputs: [] },
          forms: [{ fields: ['email', 'password'] }]
        },
        goal: 'sign up'
      };

      const result = await prediction.predictNextSteps(context, 2);
      const actions = result.predictions.map(p => p.action);

      // Should predict registration-related actions
      expect(actions.some(a => a.includes('email') || a.includes('password'))).toBe(true);
    });

    it('should detect login workflow', async () => {
      const context: PredictionContext = {
        currentUrl: 'https://example.com/login',
        currentStep: 'login',
        previousActions: [],
        pageState: {
          title: 'Sign In',
          visibleElements: { buttons: [], inputs: [] },
          forms: []
        },
        goal: 'log in'
      };

      const result = await prediction.predictNextSteps(context, 2);
      const actions = result.predictions.map(p => p.action);

      // Should predict login-related actions
      expect(actions.some(a => a.includes('credential') || a.includes('login'))).toBe(true);
    });
  });

  describe('confidence and depth penalties', () => {
    it('should decrease confidence with prediction depth', async () => {
      const context: PredictionContext = {
        currentUrl: 'https://example.com/checkout',
        currentStep: 'checkout',
        previousActions: [],
        pageState: {
          title: 'Checkout',
          visibleElements: { buttons: [], inputs: [] },
          forms: []
        },
        goal: 'complete purchase'
      };

      const result = await prediction.predictNextSteps(context, 3);

      if (result.predictions.length > 1) {
        // Confidence should decrease with depth
        for (let i = 1; i < result.predictions.length; i++) {
          expect(result.predictions[i].confidence).toBeLessThanOrEqual(
            result.predictions[i - 1].confidence
          );
        }
      }
    });

    it('should have lower overall confidence for deeper predictions', async () => {
      const context: PredictionContext = {
        currentUrl: 'https://example.com/test',
        currentStep: 'test',
        previousActions: [],
        pageState: {
          title: 'Test',
          visibleElements: { buttons: [], inputs: [] },
          forms: []
        },
        goal: 'test'
      };

      const shallowResult = await prediction.predictNextSteps(context, 1);
      const deepResult = await prediction.predictNextSteps(context, 3);

      // Deeper predictions should have lower overall confidence
      expect(deepResult.confidence).toBeLessThanOrEqual(shallowResult.confidence);
    });
  });

  describe('report generation', () => {
    it('should generate comprehensive report', () => {
      const report = prediction.generateReport();

      expect(report).toContain('Temporal Prediction Performance Report');
      expect(report).toContain('Overall Metrics');
      expect(report).toContain('Recent Performance');
      expect(report).toContain('Status');
      expect(report).toContain('Constraints');
      expect(report).toContain('Recommendation');
    });

    it('should show correct status in report', () => {
      const report = prediction.generateReport();

      expect(report).toContain('Prediction Available:');
      expect(report).toContain('Max Depth: 3');
      expect(report).toContain('Min Confidence: 0.6');
    });
  });
});
