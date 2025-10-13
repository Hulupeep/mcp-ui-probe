/**
 * Usage Tracker - Comprehensive LLM usage statistics and cost monitoring
 *
 * Tracks all LLM API calls with detailed metadata, provides cost warnings,
 * and generates usage reports.
 */

import { TokenCounter, TokenUsage } from './tokenCounter.js';
import logger from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Complete usage statistics for a session
 */
export interface UsageStats {
  totalTokens: number;
  totalCost: number;
  operationCounts: Record<string, number>;
  operationCosts: Record<string, number>;
  operationTokens: Record<string, number>;
  startTime: Date;
  lastUpdate: Date;
  sessionDuration: number; // milliseconds
  estimatedMonthly: number;
}

/**
 * Usage recommendations based on current patterns
 */
export interface UsageRecommendation {
  type: 'cost_saving' | 'performance' | 'configuration';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  estimatedSavings?: string;
}

/**
 * Cost threshold configuration
 */
export interface CostThresholds {
  warnAt: number;    // Warning threshold in USD
  maxCost: number;   // Maximum allowed cost in USD
  enabled: boolean;
}

/**
 * Export format for usage reports
 */
export type ExportFormat = 'json' | 'csv' | 'markdown';

export class UsageTracker {
  private tokenCounter: TokenCounter;
  private thresholds: CostThresholds;
  private warnings: Set<string> = new Set();
  private hasReachedMax: boolean = false;
  private dataDir: string;

  constructor(thresholds?: Partial<CostThresholds>, dataDir: string = './data/usage') {
    this.tokenCounter = new TokenCounter();
    this.thresholds = {
      warnAt: thresholds?.warnAt ?? parseFloat(process.env.UI_PROBE_WARN_COST || '10'),
      maxCost: thresholds?.maxCost ?? parseFloat(process.env.UI_PROBE_MAX_COST || '100'),
      enabled: thresholds?.enabled ?? (process.env.UI_PROBE_COST_LIMITS !== 'false')
    };
    this.dataDir = dataDir;

    logger.info('Usage tracker initialized', {
      thresholds: this.thresholds,
      dataDir
    });
  }

  /**
   * Record LLM usage and check thresholds
   */
  recordUsage(
    operation: string,
    response: any,
    model: string,
    provider: 'openai' | 'anthropic'
  ): TokenUsage {
    let usage: TokenUsage;

    if (provider === 'openai') {
      usage = this.tokenCounter.recordOpenAIUsage(operation, response, model);
    } else {
      usage = this.tokenCounter.recordAnthropicUsage(operation, response, model);
    }

    // Check thresholds after recording
    if (this.thresholds.enabled) {
      this.checkThresholds();
    }

    return usage;
  }

  /**
   * Record estimated usage when exact tokens are not available
   */
  recordEstimatedUsage(
    operation: string,
    promptText: string,
    responseText: string,
    model: string,
    provider: 'openai' | 'anthropic'
  ): TokenUsage {
    const usage = this.tokenCounter.recordEstimatedUsage(
      operation,
      promptText,
      responseText,
      model
    );

    if (this.thresholds.enabled) {
      this.checkThresholds();
    }

    return usage;
  }

  /**
   * Check if cost thresholds have been exceeded
   */
  private checkThresholds(): void {
    const currentCost = this.tokenCounter.getTotalCost();

    // Check warning threshold
    if (currentCost >= this.thresholds.warnAt && !this.warnings.has('warn')) {
      this.warnings.add('warn');
      logger.warn('⚠️  Cost warning threshold reached', {
        currentCost: `$${currentCost.toFixed(2)}`,
        threshold: `$${this.thresholds.warnAt.toFixed(2)}`,
        maxCost: `$${this.thresholds.maxCost.toFixed(2)}`
      });
    }

    // Check maximum threshold
    if (currentCost >= this.thresholds.maxCost && !this.hasReachedMax) {
      this.hasReachedMax = true;
      logger.error('🚨 Maximum cost threshold exceeded!', {
        currentCost: `$${currentCost.toFixed(2)}`,
        maxCost: `$${this.thresholds.maxCost.toFixed(2)}`,
        action: 'Further LLM operations should be blocked'
      });
    }
  }

  /**
   * Check if we've exceeded the maximum cost threshold
   */
  hasExceededMaxCost(): boolean {
    return this.hasReachedMax;
  }

  /**
   * Get current usage statistics
   */
  getStats(): UsageStats {
    const breakdown = this.tokenCounter.getUsageByOperation();
    const operationCounts: Record<string, number> = {};
    const operationCosts: Record<string, number> = {};
    const operationTokens: Record<string, number> = {};

    for (const [operation, stats] of Object.entries(breakdown)) {
      operationCounts[operation] = stats.count;
      operationCosts[operation] = stats.cost;
      operationTokens[operation] = stats.tokens;
    }

    const allUsage = this.tokenCounter.getAllUsage();
    const startTime = allUsage.length > 0 ? allUsage[0].timestamp : new Date();
    const lastUpdate = allUsage.length > 0 ? allUsage[allUsage.length - 1].timestamp : new Date();

    return {
      totalTokens: this.tokenCounter.getTotalTokens(),
      totalCost: this.tokenCounter.getTotalCost(),
      operationCounts,
      operationCosts,
      operationTokens,
      startTime,
      lastUpdate,
      sessionDuration: this.tokenCounter.getSessionDuration(),
      estimatedMonthly: this.tokenCounter.estimateMonthlyProjection()
    };
  }

  /**
   * Get usage breakdown by operation
   */
  getBreakdown(): Record<string, {
    count: number;
    tokens: number;
    cost: string;
    avgTokensPerCall: number;
    avgCostPerCall: string;
  }> {
    const rawBreakdown = this.tokenCounter.getUsageByOperation();
    const breakdown: Record<string, any> = {};

    for (const [operation, stats] of Object.entries(rawBreakdown)) {
      breakdown[operation] = {
        count: stats.count,
        tokens: stats.tokens,
        cost: `$${stats.cost.toFixed(4)}`,
        avgTokensPerCall: Math.round(stats.tokens / stats.count),
        avgCostPerCall: `$${(stats.cost / stats.count).toFixed(4)}`
      };
    }

    return breakdown;
  }

  /**
   * Generate recommendations based on usage patterns
   */
  getRecommendations(): UsageRecommendation[] {
    const recommendations: UsageRecommendation[] = [];
    const stats = this.getStats();
    const breakdown = this.tokenCounter.getUsageByOperation();

    // Check if caching could help
    const totalCalls = Object.values(breakdown).reduce((sum, b) => sum + b.count, 0);
    if (totalCalls > 20 && !process.env.LLM_CACHE_ENABLED) {
      recommendations.push({
        type: 'cost_saving',
        priority: 'high',
        title: 'Enable LLM Response Caching',
        description: 'Your application makes many LLM calls. Enabling cache could reduce costs by up to 70% for repeated queries.',
        estimatedSavings: `$${(stats.totalCost * 0.5).toFixed(2)}/session`
      });
    }

    // Check for expensive operations
    for (const [operation, opStats] of Object.entries(breakdown)) {
      const avgCost = opStats.cost / opStats.count;
      if (avgCost > 0.05) { // More than 5 cents per call
        recommendations.push({
          type: 'cost_saving',
          priority: 'medium',
          title: `Optimize "${operation}" Operation`,
          description: `This operation averages $${avgCost.toFixed(4)} per call. Consider using a smaller model or reducing prompt size.`,
          estimatedSavings: `$${(avgCost * 0.3 * opStats.count).toFixed(2)}/session`
        });
      }
    }

    // Check monthly projection
    if (stats.estimatedMonthly > 50) {
      recommendations.push({
        type: 'cost_saving',
        priority: 'high',
        title: 'High Monthly Cost Projection',
        description: `Based on current usage, estimated monthly cost is $${stats.estimatedMonthly.toFixed(2)}. Consider implementing request throttling or using cheaper models for non-critical operations.`,
        estimatedSavings: `$${(stats.estimatedMonthly * 0.4).toFixed(2)}/month`
      });
    }

    // Recommend cheaper models for simple operations
    const simpleOperations = ['parseGoal', 'interpretError', 'suggestAlternatives'];
    for (const op of simpleOperations) {
      if (breakdown[op] && breakdown[op].count > 5) {
        recommendations.push({
          type: 'configuration',
          priority: 'medium',
          title: `Use GPT-3.5-Turbo for "${op}"`,
          description: 'This operation doesn\'t require GPT-4\'s advanced capabilities. Switching to GPT-3.5-Turbo could reduce costs by 90%.',
          estimatedSavings: `$${(breakdown[op].cost * 0.9).toFixed(4)}/session`
        });
      }
    }

    // Performance recommendations
    if (stats.sessionDuration > 300000) { // More than 5 minutes
      const callsPerMinute = (totalCalls / (stats.sessionDuration / 60000)).toFixed(1);
      recommendations.push({
        type: 'performance',
        priority: 'low',
        title: 'Consider Batch Processing',
        description: `You're making ${callsPerMinute} LLM calls per minute. Batching related requests could improve performance and reduce costs.`
      });
    }

    return recommendations;
  }

  /**
   * Format usage statistics for display
   */
  formatStats(): string {
    const stats = this.getStats();
    const breakdown = this.getBreakdown();
    const duration = this.formatDuration(stats.sessionDuration);

    let output = '=== LLM Usage Statistics ===\n\n';
    output += `Session Duration: ${duration}\n`;
    output += `Total Tokens: ${stats.totalTokens.toLocaleString()}\n`;
    output += `Total Cost: $${stats.totalCost.toFixed(4)}\n`;
    output += `Estimated Monthly: $${stats.estimatedMonthly.toFixed(2)}\n\n`;

    output += '--- Breakdown by Operation ---\n';
    for (const [operation, opStats] of Object.entries(breakdown)) {
      output += `\n${operation}:\n`;
      output += `  Calls: ${opStats.count}\n`;
      output += `  Tokens: ${opStats.tokens.toLocaleString()}\n`;
      output += `  Cost: ${opStats.cost}\n`;
      output += `  Avg: ${opStats.avgTokensPerCall} tokens, ${opStats.avgCostPerCall}/call\n`;
    }

    // Add warnings
    if (this.warnings.size > 0) {
      output += '\n⚠️  WARNINGS:\n';
      if (this.warnings.has('warn')) {
        output += `  - Cost threshold reached ($${this.thresholds.warnAt})\n`;
      }
      if (this.hasReachedMax) {
        output += `  - Maximum cost exceeded ($${this.thresholds.maxCost})\n`;
      }
    }

    return output;
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
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
   * Export usage data to file
   */
  async exportToFile(format: ExportFormat = 'json', filename?: string): Promise<string> {
    await fs.mkdir(this.dataDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilename = `usage-${timestamp}.${format}`;
    const filepath = path.join(this.dataDir, filename || defaultFilename);

    let content: string;

    switch (format) {
      case 'json':
        content = this.exportAsJSON();
        break;
      case 'csv':
        content = this.exportAsCSV();
        break;
      case 'markdown':
        content = this.exportAsMarkdown();
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    await fs.writeFile(filepath, content, 'utf-8');
    logger.info('Usage data exported', { filepath, format });

    return filepath;
  }

  /**
   * Export as JSON
   */
  private exportAsJSON(): string {
    const stats = this.getStats();
    const breakdown = this.getBreakdown();
    const recommendations = this.getRecommendations();
    const allUsage = this.tokenCounter.getAllUsage();

    return JSON.stringify({
      summary: {
        totalTokens: stats.totalTokens,
        totalCost: `$${stats.totalCost.toFixed(4)}`,
        sessionDuration: this.formatDuration(stats.sessionDuration),
        estimatedMonthly: `$${stats.estimatedMonthly.toFixed(2)}`,
        startTime: stats.startTime.toISOString(),
        lastUpdate: stats.lastUpdate.toISOString()
      },
      breakdown,
      recommendations,
      thresholds: {
        warnAt: `$${this.thresholds.warnAt}`,
        maxCost: `$${this.thresholds.maxCost}`,
        warningTriggered: this.warnings.has('warn'),
        maxExceeded: this.hasReachedMax
      },
      detailedUsage: allUsage.map(u => ({
        operation: u.operation,
        tokens: u.totalTokens,
        cost: `$${u.estimatedCost.toFixed(6)}`,
        timestamp: u.timestamp.toISOString(),
        model: u.model,
        provider: u.provider
      }))
    }, null, 2);
  }

  /**
   * Export as CSV
   */
  private exportAsCSV(): string {
    const allUsage = this.tokenCounter.getAllUsage();

    let csv = 'Timestamp,Operation,Model,Provider,Prompt Tokens,Completion Tokens,Total Tokens,Cost (USD)\n';

    for (const usage of allUsage) {
      csv += `${usage.timestamp.toISOString()},`;
      csv += `${usage.operation},`;
      csv += `${usage.model},`;
      csv += `${usage.provider},`;
      csv += `${usage.promptTokens},`;
      csv += `${usage.completionTokens},`;
      csv += `${usage.totalTokens},`;
      csv += `${usage.estimatedCost.toFixed(6)}\n`;
    }

    return csv;
  }

  /**
   * Export as Markdown
   */
  private exportAsMarkdown(): string {
    const stats = this.getStats();
    const breakdown = this.getBreakdown();
    const recommendations = this.getRecommendations();

    let md = '# LLM Usage Report\n\n';
    md += `**Generated**: ${new Date().toISOString()}\n\n`;

    md += '## Summary\n\n';
    md += `- **Session Duration**: ${this.formatDuration(stats.sessionDuration)}\n`;
    md += `- **Total Tokens**: ${stats.totalTokens.toLocaleString()}\n`;
    md += `- **Total Cost**: $${stats.totalCost.toFixed(4)}\n`;
    md += `- **Estimated Monthly**: $${stats.estimatedMonthly.toFixed(2)}\n\n`;

    md += '## Breakdown by Operation\n\n';
    md += '| Operation | Calls | Tokens | Cost | Avg Tokens/Call | Avg Cost/Call |\n';
    md += '|-----------|-------|--------|------|-----------------|---------------|\n';

    for (const [operation, opStats] of Object.entries(breakdown)) {
      md += `| ${operation} | ${opStats.count} | ${opStats.tokens.toLocaleString()} | ${opStats.cost} | ${opStats.avgTokensPerCall} | ${opStats.avgCostPerCall} |\n`;
    }

    if (recommendations.length > 0) {
      md += '\n## Recommendations\n\n';
      for (const rec of recommendations) {
        const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        md += `### ${icon} ${rec.title}\n\n`;
        md += `${rec.description}\n`;
        if (rec.estimatedSavings) {
          md += `\n**Estimated Savings**: ${rec.estimatedSavings}\n`;
        }
        md += '\n';
      }
    }

    return md;
  }

  /**
   * Reset all usage statistics
   */
  reset(): void {
    this.tokenCounter.reset();
    this.warnings.clear();
    this.hasReachedMax = false;
    logger.info('Usage tracker reset');
  }

  /**
   * Get the underlying token counter (for advanced usage)
   */
  getTokenCounter(): TokenCounter {
    return this.tokenCounter;
  }
}