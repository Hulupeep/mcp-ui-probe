# LLM Validation and Graceful Degradation

## Overview

UI-Probe now includes comprehensive LLM validation on startup and graceful degradation features. This ensures users receive clear feedback about API key issues and the system can operate in a basic mode when LLM features are unavailable.

## Key Features

### 1. Startup Validation

UI-Probe validates the LLM configuration when it starts:

```bash
# With valid API key
✅ LLM available (OPENAI) - all features enabled

# Without API key
⚠️  LLM API not configured
Status: No LLM API key configured

Some features may be degraded or unavailable.

To enable full features:
  • Get API key: https://platform.openai.com/api-keys
  • Cost: $0.01-0.10 per test
  • Set: export OPENAI_API_KEY=sk-...

To suppress this warning:
  • Set: export UI_PROBE_FALLBACK_MODE=true
```

### 2. Fallback Mode

Enable basic Playwright functionality without LLM:

```bash
export UI_PROBE_FALLBACK_MODE=true
```

When enabled:
- ✅ Basic Navigation (page.goto)
- ✅ Basic Click Operations
- ✅ Error Collection (console/network)
- ✅ Simple UI Analysis (DOM queries)
- ❌ Intelligent Workflow Decomposition
- ❌ Advanced Form Inference
- ❌ LLM-Enhanced Error Messages

### 3. Enhanced Health Check

The `health_check` tool now includes LLM status:

```json
{
  "success": true,
  "data": {
    "llm": {
      "available": false,
      "provider": "none",
      "error": "No LLM API key configured",
      "quota": {
        "used": null,
        "limit": null,
        "remaining": null
      },
      "estimatedCostPerTest": "$0.01-0.10"
    },
    "features": {
      "basicNavigation": true,
      "intelligentWorkflows": false,
      "formInference": false,
      "errorEnhancement": false
    },
    "browser": {
      "browserInstalled": true,
      "browserVersion": "120.0.6099.71",
      "canLaunchBrowser": true,
      "canAccessLocalhost": true
    },
    "recommendations": [
      "⚠️  No LLM API key configured - running with basic features only",
      "💡 Set OPENAI_API_KEY for intelligent workflows, form inference, and error enhancement",
      "📖 Get API key: https://platform.openai.com/api-keys",
      "💰 Estimated cost: $0.01-0.10 per test"
    ]
  }
}
```

### 4. Clear Error Messages

When LLM features are unavailable, users receive actionable error messages:

```typescript
// LLMError class provides structured guidance
{
  "code": "LLM_REQUIRED",
  "message": "UI-Probe requires OpenAI API access",
  "suggestions": [
    "Check API key: https://platform.openai.com/api-keys",
    "Verify billing: https://platform.openai.com/billing",
    "Check usage: https://platform.openai.com/usage",
    "Or use Playwright directly for free testing",
    "Set UI_PROBE_FALLBACK_MODE=true for basic features"
  ]
}
```

## Configuration

### Environment Variables

```bash
# Required for LLM features
export OPENAI_API_KEY=sk-...

# Optional: Anthropic support (coming soon)
export ANTHROPIC_API_KEY=sk-ant-...

# Optional: Enable fallback mode
export UI_PROBE_FALLBACK_MODE=true

# Optional: LLM provider selection
export LLM_PROVIDER=openai  # or 'anthropic'

# Optional: Model selection
export LLM_MODEL=gpt-4-turbo-preview

# Optional: Enable LLM caching
export LLM_CACHE_ENABLED=true
```

### Programmatic Usage

```typescript
import { llmValidator } from './llm/validator.js';

// Check LLM availability
const health = await llmValidator.getLLMHealth();

if (health.available) {
  console.log(`Using ${health.provider} for intelligent features`);
} else {
  console.warn(`Running in fallback mode: ${health.error}`);
}

// Ensure LLM is available (throws error if not)
await llmValidator.ensureLLMAvailable(true);
```

## API Validation Details

### OpenAI Validation

The validator makes a minimal API call to verify:
1. API key is syntactically valid
2. API key has valid authentication
3. API can be reached (network connectivity)
4. Basic model access is available

**Validation Cost**: ~$0.0001 (one model list API call)

### Error Detection

The validator detects and provides specific guidance for:

| Error Code | Meaning | User Guidance |
|------------|---------|---------------|
| 401 | Invalid API key | Check key at platform.openai.com/api-keys |
| 403 | Insufficient permissions | Verify API key has required scopes |
| 429 | Rate limit/quota exceeded | Check usage at platform.openai.com/usage |
| ENOTFOUND | Network connectivity | Check internet connection/proxy |
| No key | API key not configured | Set OPENAI_API_KEY environment variable |

## Feature Availability Matrix

| Feature | No LLM | OpenAI | Anthropic |
|---------|--------|---------|-----------|
| **Basic Navigation** | ✅ | ✅ | ✅ |
| **Click Operations** | ✅ | ✅ | ✅ |
| **Error Collection** | ✅ | ✅ | ✅ |
| **UI Analysis** | ✅ Basic | ✅ Enhanced | ✅ Enhanced |
| **Workflow Decomposition** | ❌ | ✅ | 🔄 Coming |
| **Form Inference** | ❌ | ✅ | 🔄 Coming |
| **Error Enhancement** | ❌ | ✅ | 🔄 Coming |
| **Alternative Selectors** | ✅ Basic | ✅ Intelligent | 🔄 Coming |

## Cost Estimation

### Per Test Costs (OpenAI GPT-4)

| Operation | Tokens | Cost |
|-----------|--------|------|
| Goal Parsing | ~500 | $0.005 |
| Form Inference | ~1000 | $0.010 |
| Error Enhancement | ~300 | $0.003 |
| UI Analysis | ~800 | $0.008 |
| Workflow Decomposition | ~1500 | $0.015 |

**Typical Test**: $0.01-0.10 depending on complexity

### Cost Optimization

UI-Probe includes several cost optimization features:

1. **Response Caching**: 5-minute TTL for identical requests
2. **Fallback to Regex**: Automatic fallback on LLM errors
3. **Minimal Validation**: Single API call on startup
4. **Configurable Features**: Disable expensive features via config

## Troubleshooting

### Common Issues

#### 1. "Invalid API key" Error

```bash
# Check if key is set
echo $OPENAI_API_KEY

# Verify key format (should start with sk-...)
# If invalid, generate new key:
# https://platform.openai.com/api-keys
```

#### 2. "Rate limit exceeded"

```bash
# Check usage dashboard:
# https://platform.openai.com/usage

# Wait for rate limit reset or upgrade plan
```

#### 3. "Cannot connect to OpenAI API"

```bash
# Check network connectivity
curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"

# Check proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

#### 4. Features Not Working Without LLM

```bash
# Enable fallback mode for basic features
export UI_PROBE_FALLBACK_MODE=true

# Or use Playwright directly
npm install playwright
```

### Debug Mode

Enable debug logging to troubleshoot LLM issues:

```bash
export UI_PROBE_DEBUG=true
export LOG_LEVEL=debug

# Start UI-Probe and check logs
npm run start
```

## Migration Guide

### From Earlier Versions

If you're upgrading from an earlier version of UI-Probe:

1. **No Breaking Changes**: Existing functionality remains unchanged
2. **New Warnings**: You may see LLM warnings on startup
3. **Optional Configuration**: Set `UI_PROBE_FALLBACK_MODE=true` to suppress warnings
4. **Enhanced Health Check**: Update any health check parsing to handle new LLM fields

### Example Migration

**Before:**
```typescript
// Health check returned only browser info
const health = await performHealthCheck();
console.log(health.canLaunchBrowser);
```

**After:**
```typescript
// Health check now includes LLM info
const health = await performHealthCheck();
console.log(health.canLaunchBrowser);
console.log(health.llm.available);        // NEW
console.log(health.features);             // NEW
```

## Best Practices

### Development

```bash
# Development with LLM features
export OPENAI_API_KEY=sk-...
npm run dev
```

### CI/CD

```bash
# CI/CD without LLM (faster, free)
export UI_PROBE_FALLBACK_MODE=true
npm run test
```

### Production

```bash
# Production with full features
export OPENAI_API_KEY=sk-...
# Set up monitoring for API costs
# Use caching to reduce API calls
export LLM_CACHE_ENABLED=true
```

## Security Considerations

1. **API Key Storage**: Never commit API keys to git
2. **Environment Variables**: Use secure secret management
3. **Key Rotation**: Rotate keys regularly
4. **Least Privilege**: Use keys with minimal required permissions
5. **Monitoring**: Track API usage for anomalies

## Future Enhancements

Planned features for future releases:

- [ ] Anthropic Claude support
- [ ] Azure OpenAI support
- [ ] Local LLM support (Ollama, LM Studio)
- [ ] Cost tracking and budgets
- [ ] Per-operation LLM toggling
- [ ] Custom LLM endpoints
- [ ] Quota monitoring and alerts

## Resources

- [OpenAI API Keys](https://platform.openai.com/api-keys)
- [OpenAI Pricing](https://openai.com/pricing)
- [OpenAI Usage Dashboard](https://platform.openai.com/usage)
- [Playwright Documentation](https://playwright.dev)
- [UI-Probe GitHub](https://github.com/your-org/mcp-ui-probe)

---

**Questions or Issues?**

- Open an issue on GitHub
- Check existing issues for similar problems
- Include health check output in bug reports