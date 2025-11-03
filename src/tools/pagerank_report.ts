/**
 * PageRank Performance Report Tool
 *
 * MCP tool for monitoring PageRank validator performance and adaptive thresholds
 */

import { pageRankValidator } from '../services/PageRankValidator.js';

/**
 * Get PageRank performance metrics and recommendations
 */
export function handlePageRankReport(): any {
  try {
    const metrics = pageRankValidator.getMetrics();
    const threshold = pageRankValidator.getConfidenceThreshold();
    const report = pageRankValidator.generateReport();

    return {
      success: true,
      data: {
        metrics: {
          totalAttempts: metrics.totalAttempts,
          successfulAttempts: metrics.successfulAttempts,
          failedAttempts: metrics.failedAttempts,
          successRate: parseFloat((metrics.successRate * 100).toFixed(2)),
          avgConfidence: parseFloat(metrics.avgConfidence.toFixed(3)),
          lastUpdated: metrics.lastUpdated.toISOString()
        },
        adaptiveThreshold: {
          current: parseFloat(threshold.toFixed(3)),
          status: threshold < 0.4 ? 'aggressive' : threshold < 0.6 ? 'balanced' : 'conservative'
        },
        recommendations: getRecommendations(metrics, threshold),
        fullReport: report
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to generate PageRank report: ${error.message}`
    };
  }
}

/**
 * Reset PageRank metrics (for testing or new session)
 */
export function handlePageRankReset(): any {
  try {
    pageRankValidator.resetMetrics();

    return {
      success: true,
      data: {
        message: 'PageRank metrics reset successfully',
        newThreshold: pageRankValidator.getConfidenceThreshold(),
        metrics: pageRankValidator.getMetrics()
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to reset PageRank metrics: ${error.message}`
    };
  }
}

/**
 * Manually set confidence threshold (for tuning)
 */
export function handlePageRankSetThreshold(threshold: number): any {
  try {
    if (threshold < 0 || threshold > 1) {
      return {
        success: false,
        error: 'Threshold must be between 0 and 1'
      };
    }

    pageRankValidator.setConfidenceThreshold(threshold);

    return {
      success: true,
      data: {
        message: 'Confidence threshold updated',
        newThreshold: pageRankValidator.getConfidenceThreshold(),
        warning: 'Manual threshold override - adaptive learning disabled until reset'
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to set threshold: ${error.message}`
    };
  }
}

/**
 * Get actionable recommendations based on metrics
 */
function getRecommendations(metrics: any, threshold: number): string[] {
  const recommendations: string[] = [];

  if (metrics.totalAttempts < 10) {
    recommendations.push('Insufficient data - continue gathering metrics (need 10+ attempts)');
    return recommendations;
  }

  // Performance-based recommendations
  if (metrics.successRate > 0.85) {
    recommendations.push('✅ PageRank performing excellently - consider lowering threshold for more aggressive optimization');
  } else if (metrics.successRate > 0.7) {
    recommendations.push('✅ PageRank performing well - current strategy is working');
  } else if (metrics.successRate > 0.5) {
    recommendations.push('⚠️  PageRank success rate moderate - monitor for patterns or adjust threshold');
  } else {
    recommendations.push('❌ PageRank underperforming - consider disabling or investigating failure patterns');
  }

  // Threshold recommendations
  if (threshold > 0.7 && metrics.successRate > 0.8) {
    recommendations.push('💡 Threshold is conservative despite high success rate - consider lowering to 0.5-0.6');
  } else if (threshold < 0.4 && metrics.successRate < 0.6) {
    recommendations.push('⚠️  Threshold is aggressive despite low success rate - system should auto-adjust soon');
  }

  // Volume recommendations
  if (metrics.totalAttempts < 50) {
    recommendations.push('📊 More data needed for reliable adaptive learning - continue testing');
  } else if (metrics.totalAttempts > 200) {
    recommendations.push('📈 Sufficient data collected - adaptive threshold should be well-tuned');
  }

  // Failure pattern recommendations
  if (metrics.failedAttempts > metrics.successfulAttempts) {
    recommendations.push('🔍 More failures than successes - investigate common failure patterns');
  }

  return recommendations;
}

/**
 * Export detailed metrics as JSON (for analysis)
 */
export function handlePageRankExport(): any {
  try {
    const metrics = pageRankValidator.getMetrics();
    const threshold = pageRankValidator.getConfidenceThreshold();

    return {
      success: true,
      data: {
        exported: new Date().toISOString(),
        metrics,
        threshold,
        configuration: {
          adaptiveLearningEnabled: true,
          minSuccessRateThreshold: 0.6,
          historyWindowSize: 100
        }
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to export metrics: ${error.message}`
    };
  }
}
