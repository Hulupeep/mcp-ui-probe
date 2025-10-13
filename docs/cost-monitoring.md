# LLM Cost Monitoring & Estimation

**Version**: 1.0.0
**Date**: 2025-09-29
**Status**: ✅ Implemented

## Overview

The UI-Probe cost monitoring system provides comprehensive tracking of LLM API usage, real-time cost estimation, configurable spending limits, and actionable recommendations for cost optimization.

## Features

### ✅ Implemented Features

1. **Token Counting** - Accurate token tracking for all LLM operations
2. **Cost Estimation** - Real-time cost calculation based on current model pricing
3. **Usage Statistics** - Detailed breakdown by operation type
4. **Cost Warnings** - Configurable thresholds with automatic alerts
5. **Cost Limits** - Maximum spending caps with automatic blocking
6. **Export Reports** - JSON, CSV, and Markdown export formats
7. **Recommendations** - AI-powered cost optimization suggestions
8. **MCP Tool Integration** - New `usage_stats` tool for Claude Desktop

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    LLMStrategy                          │
│  (Intercepts all LLM API calls)                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │    UsageTracker        │
        │  - Records usage       │
        │  - Checks thresholds   │
        │  - Generates stats     │
        └────────┬───────────────┘
                 │
                 ▼
        ┌────────────────────────┐
        │    TokenCounter        │
        │  - Counts tokens       │
        │  - Calculates costs    │
        │  - Stores history      │
        └────────────────────────┘
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Enable/disable cost monitoring (default: true)
UI_PROBE_COST_LIMITS=true

# Warn when session cost exceeds this amount (default: $10)
UI_PROBE_WARN_COST=10

# Block operations when session cost exceeds this amount (default: $100)
UI_PROBE_MAX_COST=100

# Use fallback mode (regex parsing) instead of LLM when limits exceeded
UI_PROBE_FALLBACK_MODE=false
```

### Model Pricing

The system includes up-to-date pricing for common models:

| Model | Provider | Input (per 1K) | Output (per 1K) |
|-------|----------|----------------|-----------------|
| GPT-4 Turbo | OpenAI | $0.01 | $0.03 |
| GPT-4 | OpenAI | $0.03 | $0.06 |
| GPT-3.5 Turbo | OpenAI | $0.0005 | $0.0015 |
| Claude 3 Opus | Anthropic | $0.015 | $0.075 |
| Claude 3 Sonnet | Anthropic | $0.003 | $0.015 |
| Claude 3 Haiku | Anthropic | $0.00025 | $0.00125 |

## Usage

### 1. MCP Tool: `usage_stats`

Get current usage statistics via Claude Desktop:

```javascript
// Basic usage stats
mcp__ui-probe__usage_stats()

// Export detailed report to JSON
mcp__ui-probe__usage_stats({
  export: true,
  format: "json"
})

// Export to CSV with custom filename
mcp__ui-probe__usage_stats({
  export: true,
  format: "csv",
  filename: "my-usage-report.csv"
})

// Export to Markdown
mcp__ui-probe__usage_stats({
  export: true,
  format: "markdown"
})
```

### 2. Programmatic Access

```typescript
import { LLMStrategy } from './llm/llmStrategy.js';
import { getUsageStats, exportUsageStats } from './tools/usage_stats.js';

// Initialize LLM strategy (cost tracking enabled automatically)
const llmStrategy = new LLMStrategy();

// Get usage tracker
const usageTracker = llmStrategy.getUsageTracker();

// Get current statistics
const stats = usageTracker?.getStats();
console.log(`Total cost: $${stats.totalCost.toFixed(4)}`);
console.log(`Total tokens: ${stats.totalTokens.toLocaleString()}`);

// Get breakdown by operation
const breakdown = usageTracker?.getBreakdown();
for (const [operation, opStats] of Object.entries(breakdown)) {
  console.log(`${operation}: ${opStats.count} calls, ${opStats.cost}`);
}

// Get recommendations
const recommendations = usageTracker?.getRecommendations();
for (const rec of recommendations) {
  console.log(`[${rec.priority}] ${rec.title}: ${rec.description}`);
}

// Export to file
const filepath = await usageTracker?.exportToFile('json');
console.log(`Report saved to: ${filepath}`);
```

## Response Format

### Usage Stats Response

```json
{
  "success": true,
  "currentSession": {
    "tokens": 12500,
    "cost": "$0.125",
    "operations": 15,
    "duration": "5m 32s",
    "startTime": "2025-09-29T10:00:00.000Z",
    "lastUpdate": "2025-09-29T10:05:32.000Z"
  },
  "breakdown": {
    "parseGoal": {
      "count": 5,
      "tokens": 2500,
      "cost": "$0.025",
      "avgTokensPerCall": 500,
      "avgCostPerCall": "$0.0050"
    },
    "interpretError": {
      "count": 3,
      "tokens": 4000,
      "cost": "$0.040",
      "avgTokensPerCall": 1333,
      "avgCostPerCall": "$0.0133"
    },
    "suggestAlternatives": {
      "count": 2,
      "tokens": 3000,
      "cost": "$0.030",
      "avgTokensPerCall": 1500,
      "avgCostPerCall": "$0.0150"
    },
    "complete": {
      "count": 5,
      "tokens": 3000,
      "cost": "$0.030",
      "avgTokensPerCall": 600,
      "avgCostPerCall": "$0.0060"
    }
  },
  "estimatedMonthly": "$7.50",
  "thresholds": {
    "warnAt": "$10.00",
    "maxCost": "$100.00",
    "warningTriggered": false,
    "maxExceeded": false
  },
  "recommendations": [
    {
      "type": "cost_saving",
      "priority": "high",
      "title": "Enable LLM Response Caching",
      "description": "Your application makes many LLM calls. Enabling cache could reduce costs by up to 70% for repeated queries.",
      "estimatedSavings": "$0.06/session"
    },
    {
      "type": "configuration",
      "priority": "medium",
      "title": "Use GPT-3.5-Turbo for \"parseGoal\"",
      "description": "This operation doesn't require GPT-4's advanced capabilities. Switching to GPT-3.5-Turbo could reduce costs by 90%.",
      "estimatedSavings": "$0.0225/session"
    }
  ]
}
```

## Cost Warnings

### Warning Threshold

When the session cost reaches the warning threshold (`UI_PROBE_WARN_COST`):

```
⚠️  Cost warning threshold reached
{
  currentCost: '$10.50',
  threshold: '$10.00',
  maxCost: '$100.00'
}
```

### Maximum Threshold

When the session cost exceeds the maximum threshold (`UI_PROBE_MAX_COST`):

```
🚨 Maximum cost threshold exceeded!
{
  currentCost: '$100.25',
  maxCost: '$100.00',
  action: 'Further LLM operations are blocked'
}
```

All subsequent LLM calls will throw an error:

```
Error: Maximum LLM cost threshold exceeded ($100.25).
Further LLM operations are blocked. Set UI_PROBE_MAX_COST
higher or reset usage tracking.
```

## Export Formats

### JSON Export

```json
{
  "summary": {
    "totalTokens": 12500,
    "totalCost": "$0.1250",
    "sessionDuration": "5m 32s",
    "estimatedMonthly": "$7.50",
    "startTime": "2025-09-29T10:00:00.000Z",
    "lastUpdate": "2025-09-29T10:05:32.000Z"
  },
  "breakdown": { ... },
  "recommendations": [ ... ],
  "detailedUsage": [
    {
      "operation": "parseGoal",
      "tokens": 500,
      "cost": "$0.005000",
      "timestamp": "2025-09-29T10:00:05.123Z",
      "model": "gpt-4-turbo-preview",
      "provider": "openai"
    }
  ]
}
```

### CSV Export

```csv
Timestamp,Operation,Model,Provider,Prompt Tokens,Completion Tokens,Total Tokens,Cost (USD)
2025-09-29T10:00:05.123Z,parseGoal,gpt-4-turbo-preview,openai,400,100,500,0.005000
2025-09-29T10:00:12.456Z,interpretError,gpt-4-turbo-preview,openai,1100,233,1333,0.013300
```

### Markdown Export

```markdown
# LLM Usage Report

**Generated**: 2025-09-29T10:05:32.000Z

## Summary

- **Session Duration**: 5m 32s
- **Total Tokens**: 12,500
- **Total Cost**: $0.1250
- **Estimated Monthly**: $7.50

## Breakdown by Operation

| Operation | Calls | Tokens | Cost | Avg Tokens/Call | Avg Cost/Call |
|-----------|-------|--------|------|-----------------|---------------|
| parseGoal | 5 | 2,500 | $0.0250 | 500 | $0.0050 |
| interpretError | 3 | 4,000 | $0.0400 | 1,333 | $0.0133 |
```

## Recommendations Engine

The system analyzes usage patterns and provides actionable recommendations:

### 1. Cache Optimization

**Trigger**: Many repeated LLM calls with `LLM_CACHE_ENABLED=false`

```
🔴 Enable LLM Response Caching
Your application makes many LLM calls. Enabling cache could reduce costs
by up to 70% for repeated queries.
Estimated Savings: $0.50/session
```

### 2. Model Optimization

**Trigger**: Simple operations using expensive models

```
🟡 Use GPT-3.5-Turbo for "parseGoal"
This operation doesn't require GPT-4's advanced capabilities.
Switching to GPT-3.5-Turbo could reduce costs by 90%.
Estimated Savings: $0.0225/session
```

### 3. High Monthly Projection

**Trigger**: Projected monthly cost > $50

```
🔴 High Monthly Cost Projection
Based on current usage, estimated monthly cost is $75.00.
Consider implementing request throttling or using cheaper models
for non-critical operations.
Estimated Savings: $30.00/month
```

### 4. Batch Processing

**Trigger**: High call rate (>10 calls/minute)

```
🟢 Consider Batch Processing
You're making 12.5 LLM calls per minute. Batching related requests
could improve performance and reduce costs.
```

## Best Practices

### 1. Set Appropriate Thresholds

```bash
# For development/testing
UI_PROBE_WARN_COST=5
UI_PROBE_MAX_COST=20

# For production
UI_PROBE_WARN_COST=50
UI_PROBE_MAX_COST=200
```

### 2. Enable Caching

```bash
LLM_CACHE_ENABLED=true
LLM_CACHE_TTL=300000  # 5 minutes
```

### 3. Use Appropriate Models

- **Simple operations** (parsing, simple analysis): `gpt-3.5-turbo`
- **Complex operations** (workflow decomposition): `gpt-4-turbo-preview`
- **Error analysis**: `gpt-3.5-turbo`

### 4. Monitor Regularly

```bash
# Export daily reports
mcp__ui-probe__usage_stats({
  export: true,
  format: "json",
  filename: "daily-usage-2025-09-29.json"
})
```

### 5. Enable Fallback Mode

```bash
# Use regex parsing when LLM is unavailable/expensive
UI_PROBE_FALLBACK_MODE=true
```

## Troubleshooting

### Cost Tracking Not Working

**Problem**: Usage stats show 0 tokens/cost

**Solution**:
1. Ensure `UI_PROBE_COST_LIMITS=true` in `.env`
2. Check that LLM API key is valid
3. Verify LLM operations are actually being called
4. Check logs for initialization errors

### Maximum Cost Exceeded

**Problem**: Operations blocked after reaching limit

**Solutions**:
1. **Temporary**: Increase `UI_PROBE_MAX_COST` in `.env`
2. **Permanent**: Optimize usage based on recommendations
3. **Reset**: Restart the server to reset session tracking

### Inaccurate Cost Estimates

**Problem**: Costs don't match actual API bills

**Causes**:
1. Model pricing changed (update `tokenCounter.ts`)
2. Using unsupported model (falls back to GPT-4 pricing)
3. Token estimation used instead of exact counts

**Solution**: Update pricing in `src/monitoring/tokenCounter.ts`

## API Reference

### TokenCounter

```typescript
class TokenCounter {
  // Record OpenAI usage
  recordOpenAIUsage(operation: string, response: any, model: string): TokenUsage

  // Record Anthropic usage
  recordAnthropicUsage(operation: string, response: any, model: string): TokenUsage

  // Estimate tokens from text
  estimateTokens(text: string): number

  // Get totals
  getTotalTokens(): number
  getTotalCost(): number

  // Get breakdown
  getUsageByOperation(): Record<string, { count, tokens, cost }>

  // Projections
  estimateMonthlyProjection(): number
}
```

### UsageTracker

```typescript
class UsageTracker {
  // Record usage
  recordUsage(operation: string, response: any, model: string, provider: string): TokenUsage

  // Check limits
  hasExceededMaxCost(): boolean

  // Get statistics
  getStats(): UsageStats
  getBreakdown(): Record<string, { count, tokens, cost, avgTokensPerCall, avgCostPerCall }>

  // Recommendations
  getRecommendations(): UsageRecommendation[]

  // Export
  exportToFile(format: ExportFormat, filename?: string): Promise<string>

  // Reset
  reset(): void
}
```

## Future Enhancements

### Planned Features

1. **Per-Operation Limits** - Set different limits for different operation types
2. **Time-Based Limits** - Daily/weekly/monthly caps
3. **Cost Alerts** - Email/Slack notifications when thresholds reached
4. **Historical Analysis** - Long-term cost trends and patterns
5. **Budget Forecasting** - AI-powered budget predictions
6. **Real-Time Dashboard** - Live cost monitoring UI
7. **Cost Allocation** - Track costs by project/user/feature
8. **A/B Testing** - Compare costs across different LLM strategies

### Potential Integrations

1. **Prometheus Metrics** - Cost metrics for monitoring systems
2. **DataDog/New Relic** - APM integration
3. **Stripe/Billing Systems** - Automatic charge allocation
4. **Slack/Discord Bots** - Real-time cost notifications

## Support

For questions or issues related to cost monitoring:

1. Check logs: `UI_PROBE_DEBUG=true`
2. Review documentation: `/docs/cost-monitoring.md`
3. Report issues: [GitHub Issues](https://github.com/Hulupeep/mcp-ui-probe/issues)

---

**Last Updated**: 2025-09-29
**Maintained By**: MCP UI-Probe Team