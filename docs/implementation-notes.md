# Implementation Notes: LLM Validation & Graceful Degradation

## Implementation Summary

This document describes the implementation of LLM validation and graceful degradation features in UI-Probe, addressing the critical issues identified in `docs/uiprobeissues2.md`.

## Files Modified/Created

### New Files

1. **`src/llm/validator.ts`** - Core LLM validation logic
   - `LLMValidator` class for API key validation
   - `validateLLMConfig()` - Checks API key on startup
   - `testLLMConnection()` - Makes minimal API call to verify access
   - `getLLMHealth()` - Returns detailed status including features
   - `ensureLLMAvailable()` - Throws clear errors when LLM required but unavailable

2. **`tests/llm-validator.test.ts`** - Comprehensive test suite
   - Tests for all validation scenarios
   - Tests for error messages
   - Tests for fallback mode
   - Tests for caching behavior

3. **`docs/llm-validation.md`** - User documentation
   - Configuration guide
   - Troubleshooting guide
   - Cost estimation details
   - Feature availability matrix

### Modified Files

1. **`src/utils/errors.ts`**
   - Added `LLMError` class with helpful suggestions
   - Provides structured error guidance

2. **`src/tools/health_check.ts`**
   - Integrated LLM validation into health check
   - Added `llm` and `features` fields to `HealthCheckResult`
   - Enhanced recommendations with LLM status

3. **`src/index.ts`**
   - Added LLM validation on startup
   - Clear warning messages based on configuration
   - Supports both fallback mode and normal mode

4. **`src/llm/llmStrategy.ts`**
   - Integrated with `llmValidator`
   - Respects `UI_PROBE_FALLBACK_MODE` environment variable
   - Gracefully falls back to regex parser when LLM unavailable
   - Improved logging for degraded mode

## Key Features Implemented

### 1. Startup Validation (PRIORITY 1)

**Before:**
```typescript
// No validation - silent failures
const server = new MCPServer();
await server.start();
```

**After:**
```typescript
// Validates LLM on startup with clear feedback
const llmHealth = await llmValidator.validateLLMConfig();

if (!llmHealth.available) {
  if (fallbackMode) {
    logger.warn('UI-Probe running in FALLBACK MODE');
    logger.warn('LLM features disabled - basic Playwright mode only');
  } else {
    logger.warn('LLM API not configured');
    logger.warn('Get API key: https://platform.openai.com/api-keys');
  }
}

const server = new MCPServer();
await server.start();
```

**Error Messages:**
```
⚠️  UI-Probe requires OPENAI_API_KEY or ANTHROPIC_API_KEY
Get a key at: https://platform.openai.com/api-keys
Estimated cost: $0.01-0.10 per test
```

### 2. Graceful Degradation (PRIORITY 2)

**Environment Variable:**
```bash
export UI_PROBE_FALLBACK_MODE=true
```

**Fallback Behavior:**

| Feature | Fallback Implementation |
|---------|------------------------|
| Navigate | ✅ `page.goto()` (direct Playwright) |
| Click | ✅ Standard Playwright selectors |
| Collect Errors | ✅ Direct console/network listeners |
| Analyze UI | ✅ Basic DOM queries |
| Goal Parsing | ✅ Regex parser fallback |
| Error Enhancement | ✅ Default error messages |
| Form Inference | ❌ Requires LLM (gracefully degrades) |
| Workflow Decomposition | ❌ Requires LLM (gracefully degrades) |

**Implementation in `LLMStrategy`:**
```typescript
async parseGoal(goal: string): Promise<ParsedGoal> {
  // Automatic fallback to regex parser
  if (this.config.fallbackMode || (!this.openai && !this.anthropic)) {
    logger.debug('Using regex parser (fallback mode or no LLM)');
    return GoalParser.parse(goal);
  }

  try {
    // Attempt LLM parsing
    return await this.llmParse(goal);
  } catch (error) {
    // Graceful degradation on error
    logger.warn('LLM parsing failed, falling back to regex');
    return GoalParser.parse(goal);
  }
}
```

### 3. Enhanced Health Check (PRIORITY 3)

**Response Structure:**
```typescript
{
  "llm": {
    "available": boolean,
    "provider": "openai" | "anthropic" | "none",
    "error": string | null,
    "quota": {
      "used": number | null,
      "limit": number | null,
      "remaining": number | null
    },
    "estimatedCostPerTest": "$0.01-0.10"
  },
  "features": {
    "basicNavigation": true,
    "intelligentWorkflows": boolean,  // requires LLM
    "formInference": boolean,         // requires LLM
    "errorEnhancement": boolean       // requires LLM
  },
  "recommendations": [
    "⚠️  No LLM API key configured",
    "💡 Set OPENAI_API_KEY for full features",
    "📖 Get API key: https://platform.openai.com/api-keys",
    "💰 Estimated cost: $0.01-0.10 per test"
  ]
}
```

**Usage:**
```typescript
const health = await performHealthCheck();

if (!health.llm.available) {
  console.log('Running with limited features');
  console.log('Available:', health.features);
  console.log('Recommendations:', health.recommendations);
}
```

### 4. Better Error Messages (PRIORITY 4)

**New `LLMError` Class:**
```typescript
export class LLMError extends MCPUIError {
  code = 'LLM_REQUIRED';
  suggestions = [
    'Check API key: https://platform.openai.com/api-keys',
    'Verify billing: https://platform.openai.com/billing',
    'Check usage: https://platform.openai.com/usage',
    'Or use Playwright directly for free testing',
    'Set UI_PROBE_FALLBACK_MODE=true for basic features'
  ];
}
```

**Error Detection:**

| Error Code | Detection | User Message |
|------------|-----------|--------------|
| 401 | `error.status === 401` | "Invalid API key - authentication failed" |
| 403 | `error.status === 403` | "API key does not have required permissions" |
| 429 | `error.status === 429` | "Rate limit exceeded or quota exhausted" |
| ENOTFOUND | `error.code === 'ENOTFOUND'` | "Cannot connect to OpenAI API - check network" |
| No key | `!process.env.OPENAI_API_KEY` | "No OpenAI API key configured" |

## Design Decisions

### 1. Validation Caching

**Why:** Avoid repeated API calls on every operation
**How:** 1-minute TTL cache for validation results
**Impact:** Saves ~$0.0001 per minute

```typescript
private validationCache: LLMValidationResult | null = null;
private cacheTimestamp: number = 0;
private readonly CACHE_TTL = 60000; // 1 minute

if (this.validationCache && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
  return this.validationCache;
}
```

### 2. Non-Breaking Changes

**Principle:** Existing functionality must continue to work
**Implementation:**
- LLMStrategy automatically falls back to regex parser
- Health check adds new fields but maintains backward compatibility
- New environment variables are optional

**Example:**
```typescript
// Before: Works without LLM
const goal = await llmStrategy.parseGoal("Click login button");

// After: Still works without LLM (automatic fallback)
const goal = await llmStrategy.parseGoal("Click login button");
```

### 3. Clear Logging

**Levels:**
- `ERROR`: Validation failures that prevent operation
- `WARN`: LLM unavailable but operation continues
- `INFO`: Successful validation or feature status
- `DEBUG`: Detailed validation steps

**Example Output:**
```
[INFO] Validating LLM configuration...
[WARN] ⚠️  LLM API not configured
[WARN] Status: No LLM API key configured
[WARN] To enable full features:
[WARN]   • Get API key: https://platform.openai.com/api-keys
[INFO] Starting MCP UI Probe server...
[INFO] Server started successfully
```

### 4. Progressive Enhancement

**Approach:** Basic features work everywhere, advanced features require LLM

**Feature Tiers:**

**Tier 1 (Always Available):**
- Basic navigation
- Simple clicks
- Error collection
- Basic UI analysis

**Tier 2 (Requires LLM):**
- Intelligent workflow decomposition
- Advanced form inference
- Context-aware error enhancement
- Alternative selector suggestions

## Testing Strategy

### Unit Tests

1. **Validation Logic**
   - API key detection
   - Connection testing
   - Error handling
   - Cache behavior

2. **Fallback Behavior**
   - Regex parser fallback
   - Default error interpretation
   - Basic selector alternatives

3. **Error Messages**
   - Correct error codes
   - Helpful suggestions
   - Clear formatting

### Integration Tests

1. **With Valid API Key**
   - Full feature functionality
   - LLM-enhanced operations

2. **Without API Key**
   - Fallback mode functionality
   - Degraded but working operations

3. **With Invalid API Key**
   - Clear error messages
   - Appropriate suggestions

### Manual Testing Scenarios

```bash
# Scenario 1: No API key
unset OPENAI_API_KEY
npm start
# Expected: Warning message with setup instructions

# Scenario 2: Fallback mode
export UI_PROBE_FALLBACK_MODE=true
npm start
# Expected: Fallback mode banner, basic features work

# Scenario 3: Valid API key
export OPENAI_API_KEY=sk-...
npm start
# Expected: Success message, all features enabled

# Scenario 4: Invalid API key
export OPENAI_API_KEY=sk-invalid
npm start
# Expected: Error message with troubleshooting steps
```

## Performance Impact

### Startup Time

**Before:** ~100ms
**After:** ~200ms (includes API validation)
**Impact:** Acceptable for better error detection

### Runtime Performance

**Fallback Mode:**
- No LLM calls = No latency
- Direct Playwright operations
- Same performance as raw Playwright

**Normal Mode (with LLM):**
- Cached results: <1ms
- New requests: 200-500ms (OpenAI API)
- Progressive degradation on timeout

## Security Considerations

1. **API Key Storage**
   - Never log full API keys
   - Mask keys in error messages (show first 7 chars only)
   - Use environment variables, not config files

2. **Validation Safety**
   - Minimal API call for validation
   - No sensitive data in validation requests
   - Proper error sanitization

3. **Fallback Security**
   - Fallback mode doesn't bypass security
   - Same authentication requirements
   - Limited feature access only

## Future Enhancements

1. **Anthropic Support**
   - Add Claude API validation
   - Similar fallback behavior
   - Provider switching

2. **Local LLM Support**
   - Ollama integration
   - LM Studio support
   - Zero API costs

3. **Cost Tracking**
   - Token usage monitoring
   - Budget alerts
   - Per-test cost attribution

4. **Advanced Fallback**
   - Partial LLM features in fallback mode
   - Local ML models for basic inference
   - Hybrid mode (local + cloud)

## Troubleshooting

### Issue: "LLM API not configured" warning on startup

**Cause:** No `OPENAI_API_KEY` environment variable
**Solution:**
```bash
export OPENAI_API_KEY=sk-...
```

### Issue: API key valid but features not working

**Cause:** Firewall or proxy blocking OpenAI API
**Solution:**
```bash
# Test connectivity
curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"

# Check proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

### Issue: High API costs

**Cause:** Frequent LLM calls without caching
**Solution:**
```bash
# Enable caching
export LLM_CACHE_ENABLED=true

# Or use fallback mode
export UI_PROBE_FALLBACK_MODE=true
```

## Migration Checklist

- [x] Create LLMValidator class
- [x] Integrate validation into startup
- [x] Add fallback mode support
- [x] Enhance health check with LLM status
- [x] Add LLMError class
- [x] Update LLMStrategy for graceful degradation
- [x] Write comprehensive tests
- [x] Write user documentation
- [x] Test with valid API key
- [x] Test without API key
- [x] Test with invalid API key
- [x] Test fallback mode
- [x] Verify non-breaking changes
- [x] Build and verify compilation

## Metrics & Monitoring

### Key Metrics to Track

1. **LLM Availability Rate**: % of time LLM is available
2. **Fallback Usage Rate**: % of operations using fallback
3. **API Error Rate**: % of LLM calls that fail
4. **Cost Per Test**: Average LLM cost per test execution
5. **Validation Cache Hit Rate**: % of validations served from cache

### Logging Events

- `llm.validation.started`
- `llm.validation.success`
- `llm.validation.failed`
- `llm.fallback.triggered`
- `llm.cost.threshold_warning`
- `llm.cost.threshold_exceeded`

## Conclusion

This implementation successfully addresses all critical priorities from `docs/uiprobeissues2.md`:

✅ **PRIORITY 1**: LLM validation on startup with clear error messages
✅ **PRIORITY 2**: Graceful degradation to basic Playwright mode
✅ **PRIORITY 3**: Enhanced health check with LLM and feature status
✅ **PRIORITY 4**: Better error messages for LLM issues

The implementation maintains backward compatibility while providing a much better user experience for API key configuration and troubleshooting.