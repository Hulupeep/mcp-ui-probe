/**
 * PageRank Validator - Ensures PageRank suggestions are reliable
 *
 * Implements validation, cross-checking, and adaptive confidence scoring
 * to prevent "confidently wrong" PageRank suggestions from causing failures.
 *
 * Key Features:
 * - Cross-validation with LLM suggestions
 * - Historical success/failure tracking
 * - Adaptive confidence thresholds
 * - Multi-strategy fallback system
 */

import { logger } from '../utils/logger.js';
import { RankedElement } from './SublinearSolverIntegration.js';

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  reasoning: string;
  warnings: string[];
  shouldUseFallback: boolean;
}

export interface PageRankMetrics {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  successRate: number;
  avgConfidence: number;
  lastUpdated: Date;
}

export interface FallbackStrategy {
  strategy: 'pagerank' | 'llm' | 'heuristic' | 'hybrid';
  confidence: number;
  reasoning: string;
}

export class PageRankValidator {
  private metrics: PageRankMetrics;
  private confidenceThreshold: number = 0.5; // Adaptive threshold
  private minSuccessRateThreshold: number = 0.6; // Disable PageRank if below this
  private historyWindow: Array<{ success: boolean; confidence: number; timestamp: Date }> = [];
  private maxHistorySize: number = 100;

  constructor() {
    this.metrics = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      successRate: 1.0, // Start optimistic
      avgConfidence: 0.7,
      lastUpdated: new Date()
    };
  }

  /**
   * Validate PageRank results before using them
   * Checks for common failure patterns and confidence issues
   */
  validatePageRankResults(
    ranked: RankedElement[],
    llmSelectors?: string[],
    goal?: string
  ): ValidationResult {
    const warnings: string[] = [];
    let confidence = 0.7; // Base confidence

    // Check 1: No results
    if (ranked.length === 0) {
      return {
        isValid: false,
        confidence: 0,
        reasoning: 'No ranked elements found',
        warnings: ['PageRank returned empty results'],
        shouldUseFallback: true
      };
    }

    // Check 2: Very low top rank (all elements scored poorly)
    const topRank = ranked[0].rank;
    if (topRank < 0.15) {
      warnings.push(`Top rank very low (${topRank.toFixed(3)}), PageRank may be unreliable`);
      confidence *= 0.7;
    }

    // Check 3: All ranks are similar (no clear winner)
    const ranks = ranked.slice(0, 5).map(r => r.rank);
    const rankVariance = this.calculateVariance(ranks);
    if (rankVariance < 0.01) {
      warnings.push('Ranks are too similar, no clear winner');
      confidence *= 0.8;
    }

    // Check 4: Cross-validate with LLM suggestions if available
    if (llmSelectors && llmSelectors.length > 0) {
      const agreement = this.checkLLMAgreement(ranked, llmSelectors);
      if (agreement < 0.3) {
        warnings.push('Low agreement with LLM suggestions');
        confidence *= 0.6;
      } else if (agreement > 0.7) {
        confidence *= 1.2; // Boost confidence when LLM agrees
      }
    }

    // Check 5: Historical performance
    if (this.metrics.successRate < this.minSuccessRateThreshold) {
      warnings.push(`PageRank success rate too low (${(this.metrics.successRate * 100).toFixed(1)}%)`);
      confidence *= 0.5;
    }

    // Check 6: Goal relevance (if goal provided)
    if (goal) {
      const relevance = this.checkGoalRelevance(ranked[0], goal);
      if (relevance < 0.3) {
        warnings.push('Top element may not match goal');
        confidence *= 0.7;
      }
    }

    // Check 7: Adaptive threshold
    const shouldUseFallback = confidence < this.confidenceThreshold;

    return {
      isValid: !shouldUseFallback,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasoning: warnings.length > 0
        ? `Validation concerns: ${warnings.join('; ')}`
        : 'PageRank results validated',
      warnings,
      shouldUseFallback
    };
  }

  /**
   * Check agreement between PageRank and LLM suggestions
   * Returns 0-1 score (higher = better agreement)
   */
  private checkLLMAgreement(ranked: RankedElement[], llmSelectors: string[]): number {
    if (llmSelectors.length === 0) return 0.5; // Neutral if no LLM data

    const topRankedSelectors = ranked.slice(0, 5).map(r => r.element.selector);
    let matches = 0;

    for (const llmSel of llmSelectors) {
      if (topRankedSelectors.some(sel => this.selectorsMatch(sel, llmSel))) {
        matches++;
      }
    }

    return matches / Math.max(llmSelectors.length, 1);
  }

  /**
   * Check if two selectors are similar/equivalent
   */
  private selectorsMatch(sel1: string, sel2: string): boolean {
    // Exact match
    if (sel1 === sel2) return true;

    // Normalize and compare
    const norm1 = sel1.toLowerCase().replace(/\s+/g, '');
    const norm2 = sel2.toLowerCase().replace(/\s+/g, '');

    // Contains match (one is substring of other)
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

    // ID/class match
    const id1 = sel1.match(/#([\w-]+)/)?.[1];
    const id2 = sel2.match(/#([\w-]+)/)?.[1];
    if (id1 && id2 && id1 === id2) return true;

    return false;
  }

  /**
   * Check if top ranked element is relevant to goal
   */
  private checkGoalRelevance(element: RankedElement, goal: string): number {
    const goalLower = goal.toLowerCase();
    const text = element.element.text?.toLowerCase() || '';
    const selector = element.element.selector.toLowerCase();
    const ariaLabel = element.element.attributes['aria-label']?.toLowerCase() || '';

    let relevance = 0;

    // Text similarity
    const goalWords = goalLower.split(/\s+/);
    const textWords = text.split(/\s+/);
    const overlap = goalWords.filter(w => textWords.includes(w)).length;
    relevance += overlap / Math.max(goalWords.length, 1) * 0.5;

    // Aria label similarity
    if (ariaLabel.includes(goalLower)) relevance += 0.3;

    // Selector hints
    if (selector.includes(goalLower.replace(/\s+/g, '-'))) relevance += 0.2;

    return Math.min(1, relevance);
  }

  /**
   * Calculate variance of ranks
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    return variance;
  }

  /**
   * Record success or failure of PageRank suggestion
   * Used to adapt confidence thresholds over time
   */
  recordResult(success: boolean, confidence: number): void {
    this.metrics.totalAttempts++;

    if (success) {
      this.metrics.successfulAttempts++;
    } else {
      this.metrics.failedAttempts++;
    }

    this.metrics.successRate = this.metrics.successfulAttempts / this.metrics.totalAttempts;
    this.metrics.lastUpdated = new Date();

    // Update history
    this.historyWindow.push({
      success,
      confidence,
      timestamp: new Date()
    });

    // Maintain window size
    if (this.historyWindow.length > this.maxHistorySize) {
      this.historyWindow.shift();
    }

    // Adapt confidence threshold based on recent performance
    this.adaptConfidenceThreshold();

    logger.debug('PageRank result recorded', {
      success,
      confidence,
      successRate: this.metrics.successRate,
      threshold: this.confidenceThreshold
    });
  }

  /**
   * Adaptively adjust confidence threshold based on historical performance
   *
   * Logic:
   * - If success rate is high (>80%), lower threshold (be more aggressive)
   * - If success rate is low (<60%), raise threshold (be more conservative)
   * - If failures cluster at certain confidence levels, avoid those
   */
  private adaptConfidenceThreshold(): void {
    if (this.metrics.totalAttempts < 10) return; // Need enough data

    const recentWindow = this.historyWindow.slice(-20); // Last 20 attempts
    const recentSuccessRate = recentWindow.filter(r => r.success).length / recentWindow.length;

    // Adjust threshold based on recent performance
    if (recentSuccessRate > 0.8) {
      // Performing well, can be more aggressive
      this.confidenceThreshold = Math.max(0.3, this.confidenceThreshold - 0.05);
      logger.info('Lowering confidence threshold (performing well)', {
        newThreshold: this.confidenceThreshold,
        recentSuccessRate
      });
    } else if (recentSuccessRate < 0.5) {
      // Performing poorly, be more conservative
      this.confidenceThreshold = Math.min(0.8, this.confidenceThreshold + 0.1);
      logger.warn('Raising confidence threshold (poor performance)', {
        newThreshold: this.confidenceThreshold,
        recentSuccessRate
      });
    }

    // Analyze failure patterns
    const failedAttempts = recentWindow.filter(r => !r.success);
    if (failedAttempts.length > 0) {
      const avgFailedConfidence = failedAttempts.reduce((sum, r) => sum + r.confidence, 0) / failedAttempts.length;

      // If failures happen at high confidence, raise threshold significantly
      if (avgFailedConfidence > 0.7) {
        this.confidenceThreshold = Math.max(0.75, this.confidenceThreshold);
        logger.warn('High-confidence failures detected, raising threshold', {
          avgFailedConfidence,
          newThreshold: this.confidenceThreshold
        });
      }
    }
  }

  /**
   * Determine best fallback strategy based on current state
   */
  selectFallbackStrategy(
    pageRankValid: boolean,
    pageRankConfidence: number,
    llmAvailable: boolean
  ): FallbackStrategy {
    // Strategy 1: PageRank + LLM Hybrid (best of both)
    if (pageRankValid && llmAvailable && pageRankConfidence > 0.6) {
      return {
        strategy: 'hybrid',
        confidence: 0.85,
        reasoning: 'Combining PageRank with LLM validation'
      };
    }

    // Strategy 2: Pure PageRank (high confidence)
    if (pageRankValid && pageRankConfidence > 0.7) {
      return {
        strategy: 'pagerank',
        confidence: pageRankConfidence,
        reasoning: 'High-confidence PageRank results'
      };
    }

    // Strategy 3: LLM-first (PageRank unreliable or unavailable)
    if (llmAvailable && (!pageRankValid || pageRankConfidence < 0.5)) {
      return {
        strategy: 'llm',
        confidence: 0.7,
        reasoning: 'PageRank confidence too low, using LLM'
      };
    }

    // Strategy 4: PageRank (moderate confidence, no LLM)
    if (pageRankValid && pageRankConfidence > 0.4) {
      return {
        strategy: 'pagerank',
        confidence: pageRankConfidence * 0.8, // Penalize for no LLM validation
        reasoning: 'Using PageRank without LLM validation'
      };
    }

    // Strategy 5: Heuristic fallback (last resort)
    return {
      strategy: 'heuristic',
      confidence: 0.4,
      reasoning: 'PageRank and LLM unavailable or unreliable'
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): PageRankMetrics {
    return { ...this.metrics };
  }

  /**
   * Get confidence threshold
   */
  getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }

  /**
   * Manually override confidence threshold (for testing/tuning)
   */
  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
    logger.info('Confidence threshold manually set', { threshold: this.confidenceThreshold });
  }

  /**
   * Reset metrics (for testing or new session)
   */
  resetMetrics(): void {
    this.metrics = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      successRate: 1.0,
      avgConfidence: 0.7,
      lastUpdated: new Date()
    };
    this.historyWindow = [];
    this.confidenceThreshold = 0.5;
    logger.info('PageRank metrics reset');
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const recentWindow = this.historyWindow.slice(-20);
    const recentSuccessRate = recentWindow.length > 0
      ? recentWindow.filter(r => r.success).length / recentWindow.length
      : 1.0;

    return `
PageRank Validator Performance Report
======================================

Overall Metrics:
  Total Attempts: ${this.metrics.totalAttempts}
  Successful: ${this.metrics.successfulAttempts}
  Failed: ${this.metrics.failedAttempts}
  Success Rate: ${(this.metrics.successRate * 100).toFixed(1)}%

Recent Performance (last 20):
  Recent Success Rate: ${(recentSuccessRate * 100).toFixed(1)}%

Adaptive Threshold:
  Current Threshold: ${this.confidenceThreshold.toFixed(3)}
  Min Success Rate: ${(this.minSuccessRateThreshold * 100).toFixed(1)}%

Recommendation:
  ${this.getRecommendation()}
`;
  }

  /**
   * Get recommendation based on current performance
   */
  private getRecommendation(): string {
    if (this.metrics.totalAttempts < 10) {
      return 'Insufficient data - continue gathering metrics';
    }

    if (this.metrics.successRate > 0.8) {
      return '✅ PageRank performing excellently - continue current strategy';
    } else if (this.metrics.successRate > 0.6) {
      return '⚠️  PageRank performing adequately - monitor for improvements';
    } else {
      return '❌ PageRank underperforming - consider disabling or adjusting strategy';
    }
  }
}

// Singleton instance
export const pageRankValidator = new PageRankValidator();
