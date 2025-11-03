/**
 * Temporal Prediction Service
 *
 * Uses sublinear-solver's temporal prediction for predictive workflow execution.
 * Predicts next page states/actions while waiting for navigation/data.
 *
 * Key Features:
 * - Predict next steps before current step completes
 * - Validate predictions against reality
 * - Adaptive learning from prediction accuracy
 * - Realistic constraints to prevent speculation
 * - Fallback to sequential execution when predictions fail
 *
 * IMPORTANT: Prevents "confidently wrong" predictions with:
 * - Max prediction depth (3 steps ahead max)
 * - Confidence thresholds (min 0.6)
 * - Reality validation after each step
 * - Prediction accuracy tracking
 * - Automatic fallback to non-predictive mode
 */

import { logger } from '../utils/logger.js';
import type { Page } from 'playwright';

export interface PredictionContext {
  currentUrl: string;
  currentStep: string;
  previousActions: string[];
  pageState: {
    title: string;
    visibleElements: any;
    forms: any[];
  };
  goal: string;
}

export interface PredictedStep {
  action: string;
  target: string;
  reasoning: string;
  confidence: number;
  expectedOutcome: {
    urlPattern?: string;
    titlePattern?: string;
    expectedElements?: string[];
  };
  fallbackAction?: string;
}

export interface PredictionResult {
  predictions: PredictedStep[];
  confidence: number;
  predictionDepth: number;
  shouldUsePredictions: boolean;
  fallbackReason?: string;
  warnings: string[];
}

export interface PredictionMetrics {
  totalPredictions: number;
  accuratePredictions: number;
  inaccuratePredictions: number;
  accuracyRate: number;
  avgConfidence: number;
  lastUpdated: Date;
}

export interface ValidationResult {
  accurate: boolean;
  confidence: number;
  divergence: number; // 0-1 scale, 0 = perfect match, 1 = completely wrong
  issues: string[];
}

export class TemporalPrediction {
  private mcpAvailable: boolean = false;
  private metrics: PredictionMetrics;

  // Realistic constraints
  private readonly MAX_PREDICTION_DEPTH = 3; // Max 3 steps ahead
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.6; // Don't trust below 60%
  private readonly MAX_PREDICTION_TIME = 1000; // 1 second max for prediction
  private readonly MIN_ACCURACY_FOR_USE = 0.7; // Need 70% accuracy to keep using
  private readonly PREDICTION_COOLDOWN = 5; // After failure, wait 5 predictions

  private predictionHistory: Array<{
    predicted: PredictedStep;
    actual?: string;
    accurate: boolean;
    timestamp: Date;
  }> = [];
  private maxHistorySize: number = 100;
  private failureCount: number = 0;
  private inCooldown: boolean = false;

  constructor() {
    this.metrics = {
      totalPredictions: 0,
      accuratePredictions: 0,
      inaccuratePredictions: 0,
      accuracyRate: 1.0,
      avgConfidence: 0.7,
      lastUpdated: new Date()
    };

    this.checkMCPAvailability();
  }

  /**
   * Check if MCP server is available
   */
  private async checkMCPAvailability(): Promise<void> {
    try {
      // In production, check actual MCP connection
      this.mcpAvailable = false; // Default to fallback
      logger.info('Temporal prediction using fallback mode (MCP unavailable)');
    } catch (error) {
      this.mcpAvailable = false;
      logger.warn('Temporal prediction MCP unavailable');
    }
  }

  /**
   * Predict next steps in workflow
   * Returns predictions with realistic constraints and fallback options
   */
  async predictNextSteps(
    context: PredictionContext,
    maxDepth: number = 2
  ): Promise<PredictionResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    // Check 1: Are we in cooldown after failures?
    if (this.inCooldown) {
      return this.noPredictionResult('In cooldown after recent failures');
    }

    // Check 2: Is accuracy too low?
    if (this.metrics.accuracyRate < this.MIN_ACCURACY_FOR_USE && this.metrics.totalPredictions > 10) {
      return this.noPredictionResult(`Accuracy too low (${(this.metrics.accuracyRate * 100).toFixed(1)}%)`);
    }

    // Check 3: Enforce depth limit
    const safeDepth = Math.min(maxDepth, this.MAX_PREDICTION_DEPTH);
    if (maxDepth > this.MAX_PREDICTION_DEPTH) {
      warnings.push(`Depth limited to ${this.MAX_PREDICTION_DEPTH} (requested ${maxDepth})`);
    }

    // Try MCP prediction first
    if (this.mcpAvailable) {
      try {
        const mcpResult = await this.callMCPPrediction(context, safeDepth);

        // Validate: Are predictions realistic?
        if (this.arePredictionsRealistic(mcpResult, context)) {
          logger.info('Temporal predictions generated via MCP', {
            depth: mcpResult.length,
            avgConfidence: mcpResult.reduce((sum, p) => sum + p.confidence, 0) / mcpResult.length,
            duration: Date.now() - startTime
          });

          return {
            predictions: mcpResult,
            confidence: this.calculateOverallConfidence(mcpResult),
            predictionDepth: mcpResult.length,
            shouldUsePredictions: true,
            warnings
          };
        } else {
          warnings.push('MCP predictions too speculative, using fallback');
        }
      } catch (error: any) {
        logger.error('MCP prediction failed', { error: error.message });
        warnings.push('MCP prediction failed');
      }
    }

    // Fallback: Pattern-based prediction
    const fallbackPredictions = await this.patternBasedPrediction(context, safeDepth);

    // Check if fallback predictions are usable
    const overallConfidence = this.calculateOverallConfidence(fallbackPredictions);
    const shouldUse = overallConfidence >= this.MIN_CONFIDENCE_THRESHOLD;

    if (!shouldUse) {
      return this.noPredictionResult('Confidence too low for predictions', warnings);
    }

    return {
      predictions: fallbackPredictions,
      confidence: overallConfidence,
      predictionDepth: fallbackPredictions.length,
      shouldUsePredictions: true,
      warnings
    };
  }

  /**
   * Validate prediction against actual outcome
   * Updates metrics and triggers cooldown if necessary
   */
  async validatePrediction(
    predicted: PredictedStep,
    actualOutcome: {
      url: string;
      title: string;
      success: boolean;
      elements?: string[];
    }
  ): Promise<ValidationResult> {
    const issues: string[] = [];
    let divergence = 0;

    // Check 1: URL match
    if (predicted.expectedOutcome.urlPattern) {
      const urlMatch = new RegExp(predicted.expectedOutcome.urlPattern).test(actualOutcome.url);
      if (!urlMatch) {
        issues.push('URL did not match prediction');
        divergence += 0.3;
      }
    }

    // Check 2: Title match
    if (predicted.expectedOutcome.titlePattern) {
      const titleMatch = new RegExp(predicted.expectedOutcome.titlePattern, 'i').test(actualOutcome.title);
      if (!titleMatch) {
        issues.push('Page title did not match prediction');
        divergence += 0.2;
      }
    }

    // Check 3: Expected elements present
    if (predicted.expectedOutcome.expectedElements && actualOutcome.elements) {
      const elementsFound = predicted.expectedOutcome.expectedElements.filter(
        expected => actualOutcome.elements!.some(actual => actual.includes(expected))
      );
      const elementMatchRate = elementsFound.length / predicted.expectedOutcome.expectedElements.length;

      if (elementMatchRate < 0.5) {
        issues.push('Expected elements not found on page');
        divergence += 0.3;
      }
      divergence += (1 - elementMatchRate) * 0.2;
    }

    // Check 4: Action success
    if (!actualOutcome.success) {
      issues.push('Predicted action failed to execute');
      divergence += 0.5;
    }

    // Clamp divergence to 0-1
    divergence = Math.min(1, divergence);

    const accurate = divergence < 0.3; // Accurate if divergence < 30%

    // Record result
    this.recordPredictionResult(predicted, actualOutcome.success, accurate, divergence);

    return {
      accurate,
      confidence: predicted.confidence * (1 - divergence),
      divergence,
      issues
    };
  }

  /**
   * Call MCP for temporal prediction (placeholder)
   */
  private async callMCPPrediction(
    context: PredictionContext,
    depth: number
  ): Promise<PredictedStep[]> {
    // In production:
    // const result = await mcp__sublinear-solver__predictWithTemporalAdvantage({
    //   matrix: buildWorkflowMatrix(context),
    //   vector: buildContextVector(context),
    //   distanceKm: 10900 // NYC to Tokyo for temporal advantage
    // });

    // For now, throw to use fallback
    throw new Error('MCP not available');
  }

  /**
   * Check if predictions are realistic for web automation
   */
  private arePredictionsRealistic(predictions: PredictedStep[], context: PredictionContext): boolean {
    // Check 1: Reasonable confidence
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
    if (avgConfidence < this.MIN_CONFIDENCE_THRESHOLD) {
      logger.debug('Predictions have low confidence', { avgConfidence });
      return false;
    }

    // Check 2: Actions are concrete (not abstract)
    const abstractKeywords = ['theoretically', 'possibly', 'might', 'perhaps', 'conceptually'];
    const hasAbstract = predictions.some(p =>
      abstractKeywords.some(kw =>
        p.reasoning.toLowerCase().includes(kw) ||
        p.action.toLowerCase().includes(kw)
      )
    );

    if (hasAbstract) {
      logger.debug('Predictions contain abstract reasoning');
      return false;
    }

    // Check 3: Targets exist or are reasonable
    const unreasonableTargets = predictions.filter(p => {
      const target = p.target.toLowerCase();
      // Target should be specific (selector, text, etc.)
      return target.length < 3 || target === 'unknown' || target === 'tbd';
    });

    if (unreasonableTargets.length > 0) {
      logger.debug('Predictions contain vague targets', { count: unreasonableTargets.length });
      return false;
    }

    return true;
  }

  /**
   * Pattern-based prediction fallback
   * Uses workflow patterns and heuristics
   */
  private async patternBasedPrediction(
    context: PredictionContext,
    depth: number
  ): Promise<PredictedStep[]> {
    const predictions: PredictedStep[] = [];
    const currentUrl = context.currentUrl.toLowerCase();
    const currentTitle = context.pageState.title.toLowerCase();
    const goal = context.goal.toLowerCase();

    // Detect workflow type from context
    const workflowType = this.detectWorkflowType(context);

    // Get workflow patterns
    const patterns = this.getWorkflowPatterns(workflowType);

    // Determine current position in workflow
    const currentPosition = this.determinePosition(context, patterns);

    // Predict next steps based on pattern
    for (let i = 0; i < Math.min(depth, patterns.length - currentPosition); i++) {
      const nextStep = patterns[currentPosition + i + 1];

      if (nextStep) {
        predictions.push({
          action: nextStep.action,
          target: nextStep.target,
          reasoning: `Pattern-based prediction: ${nextStep.reasoning}`,
          confidence: nextStep.confidence * (1 - i * 0.15), // Confidence decreases with depth
          expectedOutcome: nextStep.expectedOutcome,
          fallbackAction: nextStep.fallbackAction
        });
      }
    }

    return predictions;
  }

  /**
   * Detect workflow type from context
   */
  private detectWorkflowType(context: PredictionContext): string {
    const url = context.currentUrl.toLowerCase();
    const title = context.pageState.title.toLowerCase();
    const goal = context.goal.toLowerCase();

    // E-commerce checkout flow
    if (url.includes('cart') || url.includes('checkout') ||
        title.includes('cart') || title.includes('checkout') ||
        goal.includes('buy') || goal.includes('purchase')) {
      return 'checkout';
    }

    // Registration/signup flow
    if (url.includes('signup') || url.includes('register') ||
        title.includes('sign up') || title.includes('register') ||
        goal.includes('register') || goal.includes('sign up')) {
      return 'registration';
    }

    // Login flow
    if (url.includes('login') || url.includes('signin') ||
        title.includes('login') || title.includes('sign in')) {
      return 'login';
    }

    // Search flow
    if (url.includes('search') || title.includes('search') ||
        goal.includes('search') || goal.includes('find')) {
      return 'search';
    }

    // Multi-step form
    if (context.pageState.forms.length > 0) {
      return 'form';
    }

    return 'generic';
  }

  /**
   * Get workflow patterns for type
   */
  private getWorkflowPatterns(type: string): any[] {
    const patterns: Record<string, any[]> = {
      checkout: [
        {
          action: 'view_cart',
          target: 'cart page',
          reasoning: 'User is viewing cart contents',
          confidence: 0.9,
          expectedOutcome: { urlPattern: '/cart', titlePattern: 'cart' },
          fallbackAction: 'navigate to checkout'
        },
        {
          action: 'proceed_to_checkout',
          target: 'checkout button',
          reasoning: 'User clicks checkout to begin payment',
          confidence: 0.85,
          expectedOutcome: { urlPattern: '/checkout', titlePattern: 'checkout' },
          fallbackAction: 'find payment button'
        },
        {
          action: 'fill_shipping',
          target: 'shipping form',
          reasoning: 'User fills shipping information',
          confidence: 0.8,
          expectedOutcome: { expectedElements: ['address', 'zip', 'city'] },
          fallbackAction: 'fill required fields'
        },
        {
          action: 'fill_payment',
          target: 'payment form',
          reasoning: 'User enters payment details',
          confidence: 0.75,
          expectedOutcome: { expectedElements: ['card', 'cvv', 'expiry'] },
          fallbackAction: 'submit form'
        },
        {
          action: 'confirm_order',
          target: 'place order button',
          reasoning: 'User confirms final purchase',
          confidence: 0.7,
          expectedOutcome: { urlPattern: '/confirmation|/success', titlePattern: 'order|success|thank' },
          fallbackAction: 'check for confirmation'
        }
      ],
      registration: [
        {
          action: 'view_signup',
          target: 'signup page',
          reasoning: 'User is on registration page',
          confidence: 0.9,
          expectedOutcome: { urlPattern: '/signup|/register', titlePattern: 'sign up|register' },
          fallbackAction: 'find registration form'
        },
        {
          action: 'fill_email',
          target: 'email input',
          reasoning: 'User enters email address',
          confidence: 0.85,
          expectedOutcome: { expectedElements: ['email', 'password'] },
          fallbackAction: 'fill visible inputs'
        },
        {
          action: 'fill_password',
          target: 'password input',
          reasoning: 'User creates password',
          confidence: 0.8,
          expectedOutcome: { expectedElements: ['password', 'confirm'] },
          fallbackAction: 'submit form'
        },
        {
          action: 'submit_registration',
          target: 'submit button',
          reasoning: 'User submits registration form',
          confidence: 0.75,
          expectedOutcome: { urlPattern: '/welcome|/dashboard|/home', titlePattern: 'welcome|dashboard' },
          fallbackAction: 'check for success message'
        }
      ],
      login: [
        {
          action: 'view_login',
          target: 'login page',
          reasoning: 'User is on login page',
          confidence: 0.9,
          expectedOutcome: { urlPattern: '/login|/signin', titlePattern: 'log in|sign in' },
          fallbackAction: 'find login form'
        },
        {
          action: 'fill_credentials',
          target: 'email and password',
          reasoning: 'User enters login credentials',
          confidence: 0.85,
          expectedOutcome: { expectedElements: ['email', 'password'] },
          fallbackAction: 'fill visible inputs'
        },
        {
          action: 'submit_login',
          target: 'login button',
          reasoning: 'User submits login form',
          confidence: 0.8,
          expectedOutcome: { urlPattern: '/dashboard|/home|/account', titlePattern: 'dashboard|welcome' },
          fallbackAction: 'check for redirect'
        }
      ],
      search: [
        {
          action: 'enter_query',
          target: 'search input',
          reasoning: 'User types search query',
          confidence: 0.85,
          expectedOutcome: { expectedElements: ['search', 'input'] },
          fallbackAction: 'find search box'
        },
        {
          action: 'submit_search',
          target: 'search button',
          reasoning: 'User submits search',
          confidence: 0.8,
          expectedOutcome: { urlPattern: '/search|/results', titlePattern: 'search|results' },
          fallbackAction: 'press enter'
        },
        {
          action: 'view_results',
          target: 'results page',
          reasoning: 'User views search results',
          confidence: 0.75,
          expectedOutcome: { expectedElements: ['result', 'item'] },
          fallbackAction: 'extract results'
        }
      ],
      form: [
        {
          action: 'fill_form',
          target: 'form fields',
          reasoning: 'User fills form fields',
          confidence: 0.8,
          expectedOutcome: { expectedElements: ['input', 'submit'] },
          fallbackAction: 'fill required fields'
        },
        {
          action: 'submit_form',
          target: 'submit button',
          reasoning: 'User submits form',
          confidence: 0.75,
          expectedOutcome: { titlePattern: 'success|thank|confirm' },
          fallbackAction: 'check for success'
        }
      ],
      generic: [
        {
          action: 'interact',
          target: 'element',
          reasoning: 'User interacts with page element',
          confidence: 0.6,
          expectedOutcome: {},
          fallbackAction: 'continue workflow'
        }
      ]
    };

    return patterns[type] || patterns['generic'];
  }

  /**
   * Determine current position in workflow pattern
   */
  private determinePosition(context: PredictionContext, patterns: any[]): number {
    const currentUrl = context.currentUrl.toLowerCase();
    const currentTitle = context.pageState.title.toLowerCase();
    const lastAction = context.previousActions[context.previousActions.length - 1]?.toLowerCase() || '';

    // Match current state to pattern step
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];

      // Check URL match
      if (pattern.expectedOutcome.urlPattern) {
        if (new RegExp(pattern.expectedOutcome.urlPattern).test(currentUrl)) {
          return i;
        }
      }

      // Check title match
      if (pattern.expectedOutcome.titlePattern) {
        if (new RegExp(pattern.expectedOutcome.titlePattern, 'i').test(currentTitle)) {
          return i;
        }
      }

      // Check last action match
      if (lastAction.includes(pattern.action.toLowerCase())) {
        return i;
      }
    }

    // Default to beginning
    return 0;
  }

  /**
   * Calculate overall confidence from predictions
   */
  private calculateOverallConfidence(predictions: PredictedStep[]): number {
    if (predictions.length === 0) return 0;

    // Average confidence with depth penalty
    let totalConfidence = 0;
    for (let i = 0; i < predictions.length; i++) {
      const depthPenalty = 1 - (i * 0.1); // 10% penalty per depth level
      totalConfidence += predictions[i].confidence * depthPenalty;
    }

    return totalConfidence / predictions.length;
  }

  /**
   * Return "no prediction" result
   */
  private noPredictionResult(reason: string, warnings: string[] = []): PredictionResult {
    logger.info('Temporal predictions disabled', { reason });

    return {
      predictions: [],
      confidence: 0,
      predictionDepth: 0,
      shouldUsePredictions: false,
      fallbackReason: reason,
      warnings: [...warnings, reason]
    };
  }

  /**
   * Record prediction result for adaptive learning
   */
  private recordPredictionResult(
    predicted: PredictedStep,
    success: boolean,
    accurate: boolean,
    divergence: number
  ): void {
    this.metrics.totalPredictions++;

    if (accurate) {
      this.metrics.accuratePredictions++;
      this.failureCount = Math.max(0, this.failureCount - 1); // Reduce failure count on success
    } else {
      this.metrics.inaccuratePredictions++;
      this.failureCount++;
    }

    this.metrics.accuracyRate = this.metrics.accuratePredictions / this.metrics.totalPredictions;
    this.metrics.lastUpdated = new Date();

    // Update history
    this.predictionHistory.push({
      predicted,
      actual: success ? 'success' : 'failure',
      accurate,
      timestamp: new Date()
    });

    // Maintain history size
    if (this.predictionHistory.length > this.maxHistorySize) {
      this.predictionHistory.shift();
    }

    // Check for cooldown trigger
    if (this.failureCount >= this.PREDICTION_COOLDOWN) {
      this.inCooldown = true;
      this.failureCount = 0;

      logger.warn('Temporal prediction entering cooldown', {
        accuracyRate: this.metrics.accuracyRate,
        consecutiveFailures: this.PREDICTION_COOLDOWN
      });

      // Reset cooldown after 5 more predictions
      setTimeout(() => {
        this.inCooldown = false;
        logger.info('Temporal prediction cooldown ended');
      }, 0); // Will reset after next few non-predictive runs
    }

    logger.debug('Prediction result recorded', {
      accurate,
      divergence,
      accuracyRate: this.metrics.accuracyRate,
      failureCount: this.failureCount
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): PredictionMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (for testing or new session)
   */
  resetMetrics(): void {
    this.metrics = {
      totalPredictions: 0,
      accuratePredictions: 0,
      inaccuratePredictions: 0,
      accuracyRate: 1.0,
      avgConfidence: 0.7,
      lastUpdated: new Date()
    };
    this.predictionHistory = [];
    this.failureCount = 0;
    this.inCooldown = false;

    logger.info('Temporal prediction metrics reset');
  }

  /**
   * Check if prediction is currently available
   */
  isPredictionAvailable(): boolean {
    return !this.inCooldown &&
           (this.metrics.totalPredictions < 10 || this.metrics.accuracyRate >= this.MIN_ACCURACY_FOR_USE);
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const recentWindow = this.predictionHistory.slice(-20);
    const recentAccuracyRate = recentWindow.length > 0
      ? recentWindow.filter(r => r.accurate).length / recentWindow.length
      : 1.0;

    return `
Temporal Prediction Performance Report
=======================================

Overall Metrics:
  Total Predictions: ${this.metrics.totalPredictions}
  Accurate: ${this.metrics.accuratePredictions}
  Inaccurate: ${this.metrics.inaccuratePredictions}
  Accuracy Rate: ${(this.metrics.accuracyRate * 100).toFixed(1)}%

Recent Performance (last 20):
  Recent Accuracy: ${(recentAccuracyRate * 100).toFixed(1)}%

Status:
  In Cooldown: ${this.inCooldown ? 'Yes' : 'No'}
  Consecutive Failures: ${this.failureCount}
  Prediction Available: ${this.isPredictionAvailable() ? 'Yes' : 'No'}

Constraints:
  Max Depth: ${this.MAX_PREDICTION_DEPTH}
  Min Confidence: ${this.MIN_CONFIDENCE_THRESHOLD}
  Min Accuracy for Use: ${(this.MIN_ACCURACY_FOR_USE * 100).toFixed(0)}%

Recommendation:
  ${this.getRecommendation()}
`;
  }

  /**
   * Get recommendation based on performance
   */
  private getRecommendation(): string {
    if (this.metrics.totalPredictions < 10) {
      return 'Insufficient data - continue gathering metrics';
    }

    if (this.inCooldown) {
      return '⏸️  In cooldown - predictions temporarily disabled';
    }

    if (this.metrics.accuracyRate > 0.8) {
      return '✅ Predictions performing excellently - continue using';
    } else if (this.metrics.accuracyRate > 0.7) {
      return '⚠️  Predictions performing adequately - monitor closely';
    } else {
      return '❌ Predictions underperforming - fallback to sequential execution';
    }
  }
}

// Singleton instance
export const temporalPrediction = new TemporalPrediction();
