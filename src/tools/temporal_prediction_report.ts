/**
 * Temporal Prediction Report Tool
 *
 * MCP tool for monitoring temporal prediction performance and adaptive thresholds
 */

import { temporalPrediction } from '../services/TemporalPrediction.js';

/**
 * Get temporal prediction performance metrics and recommendations
 */
export function handleTemporalPredictionReport(): any {
  try {
    const metrics = temporalPrediction.getMetrics();
    const isAvailable = temporalPrediction.isPredictionAvailable();
    const report = temporalPrediction.generateReport();

    return {
      success: true,
      data: {
        metrics: {
          totalPredictions: metrics.totalPredictions,
          accuratePredictions: metrics.accuratePredictions,
          inaccuratePredictions: metrics.inaccuratePredictions,
          accuracyRate: parseFloat((metrics.accuracyRate * 100).toFixed(2)),
          avgConfidence: parseFloat(metrics.avgConfidence.toFixed(3)),
          lastUpdated: metrics.lastUpdated.toISOString()
        },
        status: {
          available: isAvailable,
          reason: isAvailable ? 'Predictions enabled' : 'Predictions disabled (cooldown or low accuracy)'
        },
        recommendations: getRecommendations(metrics, isAvailable),
        fullReport: report
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to generate temporal prediction report: ${error.message}`
    };
  }
}

/**
 * Reset temporal prediction metrics (for testing or new session)
 */
export function handleTemporalPredictionReset(): any {
  try {
    temporalPrediction.resetMetrics();

    return {
      success: true,
      data: {
        message: 'Temporal prediction metrics reset successfully',
        isAvailable: temporalPrediction.isPredictionAvailable(),
        metrics: temporalPrediction.getMetrics()
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to reset temporal prediction metrics: ${error.message}`
    };
  }
}

/**
 * Check if temporal prediction is currently available
 */
export function handleTemporalPredictionStatus(): any {
  try {
    const isAvailable = temporalPrediction.isPredictionAvailable();
    const metrics = temporalPrediction.getMetrics();

    return {
      success: true,
      data: {
        available: isAvailable,
        accuracyRate: parseFloat((metrics.accuracyRate * 100).toFixed(2)),
        totalPredictions: metrics.totalPredictions,
        status: isAvailable ? 'active' : 'disabled',
        reason: getStatusReason(metrics, isAvailable)
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to check temporal prediction status: ${error.message}`
    };
  }
}

/**
 * Get actionable recommendations based on metrics
 */
function getRecommendations(metrics: any, isAvailable: boolean): string[] {
  const recommendations: string[] = [];

  if (metrics.totalPredictions < 10) {
    recommendations.push('Insufficient data - continue gathering metrics (need 10+ predictions)');
    return recommendations;
  }

  if (!isAvailable) {
    recommendations.push('⏸️  Predictions currently disabled - waiting for accuracy to improve');
  }

  // Performance-based recommendations
  if (metrics.accuracyRate > 0.85) {
    recommendations.push('✅ Temporal predictions performing excellently - predictions are highly reliable');
  } else if (metrics.accuracyRate > 0.7) {
    recommendations.push('✅ Temporal predictions performing well - continue monitoring');
  } else if (metrics.accuracyRate > 0.5) {
    recommendations.push('⚠️  Prediction accuracy moderate - consider limiting prediction depth');
  } else {
    recommendations.push('❌ Predictions underperforming - system automatically disabled');
  }

  // Volume recommendations
  if (metrics.totalPredictions < 50) {
    recommendations.push('📊 More data needed for reliable adaptive learning - continue testing');
  } else if (metrics.totalPredictions > 200) {
    recommendations.push('📈 Sufficient data collected - prediction system well-tuned');
  }

  // Accuracy trend recommendations
  if (metrics.inaccuratePredictions > metrics.accuratePredictions) {
    recommendations.push('🔍 More inaccurate than accurate predictions - investigate workflow patterns');
  }

  return recommendations;
}

/**
 * Get status reason
 */
function getStatusReason(metrics: any, isAvailable: boolean): string {
  if (metrics.totalPredictions < 10) {
    return 'Collecting initial data';
  }

  if (!isAvailable) {
    if (metrics.accuracyRate < 0.7) {
      return `Accuracy too low (${(metrics.accuracyRate * 100).toFixed(1)}%)`;
    }
    return 'In cooldown after consecutive failures';
  }

  return 'Operating normally';
}

/**
 * Export detailed metrics as JSON (for analysis)
 */
export function handleTemporalPredictionExport(): any {
  try {
    const metrics = temporalPrediction.getMetrics();
    const isAvailable = temporalPrediction.isPredictionAvailable();

    return {
      success: true,
      data: {
        exported: new Date().toISOString(),
        metrics,
        isAvailable,
        configuration: {
          maxPredictionDepth: 3,
          minConfidenceThreshold: 0.6,
          minAccuracyForUse: 0.7,
          predictionCooldown: 5,
          maxPredictionTime: 1000
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
