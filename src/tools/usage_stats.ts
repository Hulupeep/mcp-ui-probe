/**
 * Usage Stats Tool - MCP tool for retrieving LLM usage statistics and cost information
 */

import logger from '../utils/logger.js';
import { UsageTracker } from '../monitoring/usageTracker.js';
import type { LLMStrategy } from '../llm/llmStrategy.js';

export interface UsageStatsResult {
  success: boolean;
  currentSession: {
    tokens: number;
    cost: string;
    operations: number;
    duration: string;
    startTime: string;
    lastUpdate: string;
  };
  breakdown: Record<string, {
    count: number;
    tokens: number;
    cost: string;
    avgTokensPerCall: number;
    avgCostPerCall: string;
  }>;
  estimatedMonthly: string;
  thresholds: {
    warnAt: string;
    maxCost: string;
    warningTriggered: boolean;
    maxExceeded: boolean;
  };
  recommendations: Array<{
    type: string;
    priority: string;
    title: string;
    description: string;
    estimatedSavings?: string;
  }>;
  error?: string;
  warning?: string;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Get usage statistics from the LLM strategy
 */
export async function getUsageStats(llmStrategy?: LLMStrategy): Promise<UsageStatsResult> {
  try {
    // Check if LLM strategy is available
    if (!llmStrategy) {
      return {
        success: false,
        currentSession: {
          tokens: 0,
          cost: '$0.00',
          operations: 0,
          duration: '0s',
          startTime: new Date().toISOString(),
          lastUpdate: new Date().toISOString()
        },
        breakdown: {},
        estimatedMonthly: '$0.00',
        thresholds: {
          warnAt: process.env.UI_PROBE_WARN_COST || '$10',
          maxCost: process.env.UI_PROBE_MAX_COST || '$100',
          warningTriggered: false,
          maxExceeded: false
        },
        recommendations: [],
        warning: 'LLM strategy not initialized - usage tracking unavailable'
      };
    }

    const usageTracker = llmStrategy.getUsageTracker();

    if (!usageTracker) {
      return {
        success: false,
        currentSession: {
          tokens: 0,
          cost: '$0.00',
          operations: 0,
          duration: '0s',
          startTime: new Date().toISOString(),
          lastUpdate: new Date().toISOString()
        },
        breakdown: {},
        estimatedMonthly: '$0.00',
        thresholds: {
          warnAt: process.env.UI_PROBE_WARN_COST || '$10',
          maxCost: process.env.UI_PROBE_MAX_COST || '$100',
          warningTriggered: false,
          maxExceeded: false
        },
        recommendations: [
          {
            type: 'configuration',
            priority: 'medium',
            title: 'Enable Cost Monitoring',
            description: 'Usage tracking is disabled. Set UI_PROBE_COST_LIMITS=true to enable cost monitoring and warnings.'
          }
        ],
        warning: 'Usage tracking is disabled. Set UI_PROBE_COST_LIMITS=true to enable.'
      };
    }

    // Get statistics from usage tracker
    const stats = usageTracker.getStats();
    const breakdown = usageTracker.getBreakdown();
    const recommendations = usageTracker.getRecommendations();

    const totalOperations = Object.values(breakdown).reduce(
      (sum, b) => sum + b.count,
      0
    );

    const result: UsageStatsResult = {
      success: true,
      currentSession: {
        tokens: stats.totalTokens,
        cost: `$${stats.totalCost.toFixed(4)}`,
        operations: totalOperations,
        duration: formatDuration(stats.sessionDuration),
        startTime: stats.startTime.toISOString(),
        lastUpdate: stats.lastUpdate.toISOString()
      },
      breakdown,
      estimatedMonthly: `$${stats.estimatedMonthly.toFixed(2)}`,
      thresholds: {
        warnAt: `$${parseFloat(process.env.UI_PROBE_WARN_COST || '10').toFixed(2)}`,
        maxCost: `$${parseFloat(process.env.UI_PROBE_MAX_COST || '100').toFixed(2)}`,
        warningTriggered: stats.totalCost >= parseFloat(process.env.UI_PROBE_WARN_COST || '10'),
        maxExceeded: usageTracker.hasExceededMaxCost()
      },
      recommendations: recommendations.map(rec => ({
        type: rec.type,
        priority: rec.priority,
        title: rec.title,
        description: rec.description,
        estimatedSavings: rec.estimatedSavings
      }))
    };

    logger.debug('Usage stats retrieved', {
      tokens: result.currentSession.tokens,
      cost: result.currentSession.cost,
      operations: result.currentSession.operations
    });

    return result;
  } catch (error: any) {
    logger.error('Failed to retrieve usage stats', {
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      currentSession: {
        tokens: 0,
        cost: '$0.00',
        operations: 0,
        duration: '0s',
        startTime: new Date().toISOString(),
        lastUpdate: new Date().toISOString()
      },
      breakdown: {},
      estimatedMonthly: '$0.00',
      thresholds: {
        warnAt: '$10',
        maxCost: '$100',
        warningTriggered: false,
        maxExceeded: false
      },
      recommendations: [],
      error: `Failed to retrieve usage stats: ${error.message}`
    };
  }
}

/**
 * Export usage statistics to file
 */
export async function exportUsageStats(
  llmStrategy: LLMStrategy | undefined,
  format: 'json' | 'csv' | 'markdown' = 'json',
  filename?: string
): Promise<{ success: boolean; filepath?: string; error?: string }> {
  try {
    if (!llmStrategy) {
      return {
        success: false,
        error: 'LLM strategy not initialized'
      };
    }

    const usageTracker = llmStrategy.getUsageTracker();

    if (!usageTracker) {
      return {
        success: false,
        error: 'Usage tracking is not enabled'
      };
    }

    const filepath = await usageTracker.exportToFile(format, filename);

    logger.info('Usage stats exported', { filepath, format });

    return {
      success: true,
      filepath
    };
  } catch (error: any) {
    logger.error('Failed to export usage stats', {
      error: error.message,
      stack: error.stack
    });

    return {
      success: false,
      error: `Failed to export: ${error.message}`
    };
  }
}

/**
 * Format usage stats for console output
 */
export function formatUsageStatsForConsole(stats: UsageStatsResult): string {
  let output = '\n';
  output += '═══════════════════════════════════════════════════════\n';
  output += '           LLM USAGE STATISTICS REPORT                 \n';
  output += '═══════════════════════════════════════════════════════\n\n';

  if (!stats.success) {
    output += `⚠️  ${stats.warning || stats.error}\n\n`;
    if (stats.recommendations.length > 0) {
      output += 'Recommendations:\n';
      for (const rec of stats.recommendations) {
        output += `  • ${rec.title}: ${rec.description}\n`;
      }
    }
    return output;
  }

  // Current Session
  output += '📊 CURRENT SESSION\n';
  output += '───────────────────────────────────────────────────────\n';
  output += `Duration:       ${stats.currentSession.duration}\n`;
  output += `Total Tokens:   ${stats.currentSession.tokens.toLocaleString()}\n`;
  output += `Total Cost:     ${stats.currentSession.cost}\n`;
  output += `Operations:     ${stats.currentSession.operations}\n`;
  output += `Started:        ${new Date(stats.currentSession.startTime).toLocaleString()}\n`;
  output += `Last Update:    ${new Date(stats.currentSession.lastUpdate).toLocaleString()}\n\n`;

  // Breakdown
  if (Object.keys(stats.breakdown).length > 0) {
    output += '📈 BREAKDOWN BY OPERATION\n';
    output += '───────────────────────────────────────────────────────\n';

    for (const [operation, opStats] of Object.entries(stats.breakdown)) {
      output += `\n${operation}:\n`;
      output += `  Calls:       ${opStats.count}\n`;
      output += `  Tokens:      ${opStats.tokens.toLocaleString()}\n`;
      output += `  Cost:        ${opStats.cost}\n`;
      output += `  Avg/Call:    ${opStats.avgTokensPerCall} tokens, ${opStats.avgCostPerCall}\n`;
    }
    output += '\n';
  }

  // Thresholds
  output += '⚠️  COST THRESHOLDS\n';
  output += '───────────────────────────────────────────────────────\n';
  output += `Warning At:     ${stats.thresholds.warnAt}\n`;
  output += `Maximum Cost:   ${stats.thresholds.maxCost}\n`;
  output += `Warning Status: ${stats.thresholds.warningTriggered ? '⚠️  TRIGGERED' : '✅ OK'}\n`;
  output += `Max Exceeded:   ${stats.thresholds.maxExceeded ? '🚨 YES - OPERATIONS BLOCKED' : '✅ NO'}\n\n`;

  // Projection
  output += '💰 COST PROJECTION\n';
  output += '───────────────────────────────────────────────────────\n';
  output += `Estimated Monthly: ${stats.estimatedMonthly}\n\n`;

  // Recommendations
  if (stats.recommendations.length > 0) {
    output += '💡 RECOMMENDATIONS\n';
    output += '───────────────────────────────────────────────────────\n';

    for (const rec of stats.recommendations) {
      const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      output += `\n${icon} ${rec.title}\n`;
      output += `   ${rec.description}\n`;
      if (rec.estimatedSavings) {
        output += `   💵 Potential Savings: ${rec.estimatedSavings}\n`;
      }
    }
    output += '\n';
  }

  output += '═══════════════════════════════════════════════════════\n';

  return output;
}