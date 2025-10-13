# LLM Requirements for UI-Probe

## Overview

UI-Probe is an **LLM-powered intelligent testing system** that uses AI to understand web pages, infer form structures, and execute natural language workflows. This document explains why LLM is needed, how to configure it, and how to manage costs.

## Why LLM is Required

UI-Probe is fundamentally different from standard browser automation tools. It provides **intelligent understanding** rather than just mechanical execution:

### 🧠 Intelligent Features That Require LLM:

1. **Form Inference Engine**
   - Automatically understands form structure without explicit selectors
   - Detects field types, validation rules, and relationships
   - Generates appropriate test data that passes validation

2. **Natural Language Workflow Decomposition**
   - Converts "Sign up as a new user" into a sequence of actions
   - Understands context and intent
   - Adapts to different website structures

3. **Smart Element Detection**
   - Finds elements using semantic understanding, not just CSS selectors
   - Self-heals when UI changes (button class renamed, ID changed)
   - Understands visual and contextual relationships

4. **Error Enhancement**
   - Provides actionable, human-friendly error messages
   - Analyzes failure context and suggests solutions
   - Identifies root causes beyond generic selector failures

5. **Journey Analysis & Optimization**
   - Identifies patterns in recorded workflows
   - Suggests improvements and alternative paths
   - Validates journeys remain compatible with current page state

## Getting API Keys

### OpenAI API Key (Recommended)

1. **Create an OpenAI account**: https://platform.openai.com/signup
2. **Set up billing**: https://platform.openai.com/account/billing
   - Add payment method
   - Purchase credits ($5 minimum recommended for testing)
3. **Generate API key**: https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Name it (e.g., "ui-probe-testing")
   - **Copy immediately** - you won't see it again
   - Store securely (never commit to git)

### Anthropic API Key (Alternative)

1. **Create an Anthropic account**: https://console.anthropic.com/
2. **Add billing**: https://console.anthropic.com/account/billing
   - Add payment method
   - Set usage limits
3. **Generate API key**: https://console.anthropic.com/account/keys
   - Click "Create Key"
   - Name it descriptively
   - Copy and store securely

## Configuration

### Basic Setup

```bash
# In your project directory, create .env file:
echo "OPENAI_API_KEY=sk-proj-..." > .env

# OR for Anthropic:
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Optional: Specify provider explicitly (defaults to OpenAI)
echo "LLM_PROVIDER=openai" >> .env  # or 'anthropic'

# Optional: Specify model (defaults to gpt-4-turbo-preview)
echo "LLM_MODEL=gpt-4-turbo-preview" >> .env
```

### Security Best Practices

**NEVER commit API keys to version control:**

```bash
# Add to .gitignore:
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore
echo "*.key" >> .gitignore
```

**Use environment variables in CI/CD:**

```yaml
# GitHub Actions example:
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## Cost Estimation and Monitoring

### Typical API Usage Costs

UI-Probe uses GPT-4 Turbo for intelligent features. Costs per operation:

| Operation Type | Tokens Used | Cost per Call | When Used |
|----------------|-------------|---------------|-----------|
| Basic navigation | 0 | $0.000 | Always available |
| Page analysis (LLM) | ~500 | $0.005 | `analyze_ui` with intelligence |
| Form inference | ~1000 | $0.010 | `infer_form` |
| Workflow decomposition | ~800 | $0.008 | `run_flow` goal parsing |
| Error enhancement | ~300 | $0.003 | When tests fail |
| Journey analysis | ~600 | $0.006 | `journey_analyze` |
| Element detection | ~400 | $0.004 | Smart selectors |

### Real-World Cost Examples

**Small Project** (50 tests/day):
- Basic tests (50% no LLM): $0.00
- Simple forms (30% with LLM): ~$0.15/day = **$4.50/month**
- Complex workflows (20%): ~$0.20/day = **$6.00/month**
- **Total: ~$10.50/month**

**Medium Project** (500 tests/day):
- Mixed usage: **$50-80/month**

**Large CI/CD Pipeline** (5000 tests/day):
- Optimized with caching: **$300-500/month**

### Cost Optimization Strategies

#### 1. Use Fallback Mode for Simple Operations

```bash
# Enable fallback mode in .env
UI_PROBE_FALLBACK_MODE=true
```

This disables LLM for:
- Basic navigation
- Explicit element clicking
- Simple form filling with known field names

**Savings**: 50-70% cost reduction for simple test suites

#### 2. Enable LLM Response Caching

```bash
# In .env:
LLM_CACHE_ENABLED=true
LLM_CACHE_TTL=3600  # Cache for 1 hour
```

Caching prevents repeated API calls for:
- Same pages analyzed multiple times
- Repeated form inferences
- Identical workflow decompositions

**Savings**: 30-40% cost reduction on repeated tests

#### 3. Use Explicit Selectors When Possible

```javascript
// ❌ Expensive - requires LLM
await ui_probe.click_button({ text: "submit button near the bottom" });

// ✅ Free - direct Playwright selector
await ui_probe.click_button({ selector: "button[type='submit']" });
```

#### 4. Batch Similar Tests Together

UI-Probe reuses context when tests run sequentially on the same site:

```javascript
// ✅ Efficient - context reused
test('User Flows', async () => {
  await ui_probe.navigate('https://myapp.com');
  // First test - pays for analysis
  await ui_probe.run_flow({ goal: 'Sign up' });

  // Subsequent tests - context cached
  await ui_probe.run_flow({ goal: 'Update profile' });
  await ui_probe.run_flow({ goal: 'Change password' });
});

// ❌ Inefficient - separate context each time
test('Signup', async () => { /* pays for analysis */ });
test('Profile', async () => { /* pays again */ });
test('Password', async () => { /* pays again */ });
```

#### 5. Monitor Usage in Real-Time

```bash
# Check OpenAI usage:
curl https://api.openai.com/v1/usage \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Or visit dashboard:
open https://platform.openai.com/usage
```

Set up billing alerts to avoid surprises:
- OpenAI: https://platform.openai.com/account/billing/limits
- Anthropic: https://console.anthropic.com/account/limits

## Fallback Mode (No LLM Required)

When you don't need intelligent features, UI-Probe can operate without LLM:

### Enabling Fallback Mode

```bash
# In .env:
UI_PROBE_FALLBACK_MODE=true

# No API key needed in this mode
```

### What Works in Fallback Mode

Fallback mode provides standard Playwright functionality:

```javascript
// ✅ Works without LLM - basic Playwright operations
await ui_probe.navigate({ url: 'https://example.com' });
await ui_probe.click_button({ selector: '#submit-btn' });
await ui_probe.fill_form({
  formSchema: {
    fields: [
      { name: 'email', selector: '#email-input' },
      { name: 'password', selector: '#password-input' }
    ]
  },
  overrides: {
    email: 'test@example.com',
    password: 'Test123!'
  }
});
```

### What Requires LLM

```javascript
// ❌ Requires LLM - will fail in fallback mode
await ui_probe.run_flow({
  goal: 'Sign up as a new user'  // Natural language requires LLM
});

await ui_probe.infer_form({
  goal: 'signup'  // Form inference requires LLM
});

// ❌ Smart element detection requires LLM
await ui_probe.click_button({
  text: 'the blue button near the top'  // Semantic understanding
});
```

### When to Use Fallback Mode

**Use Fallback Mode When:**
- Running simple, scripted tests with known selectors
- Testing in CI/CD where cost is a concern
- Working with stable UI that rarely changes
- Prototyping before committing to API costs

**Use LLM Mode When:**
- Testing unfamiliar websites or applications
- UI changes frequently and tests need self-healing
- Natural language test descriptions are valuable
- Form structures are complex or dynamic
- Team includes non-technical testers (PM, designers, QA)

## Troubleshooting LLM Issues

### Invalid API Key

**Symptoms:**
```
Error: Invalid API key provided
401 Unauthorized
```

**Solutions:**
1. Verify key format:
   - OpenAI: Should start with `sk-proj-` or `sk-`
   - Anthropic: Should start with `sk-ant-`
2. Check key hasn't expired
3. Regenerate key if necessary
4. Ensure `.env` file is in correct directory
5. Restart UI-Probe after updating `.env`

### Quota Exceeded

**Symptoms:**
```
Error: You exceeded your current quota
429 Too Many Requests
```

**Solutions:**
1. Check usage dashboard:
   - OpenAI: https://platform.openai.com/usage
   - Anthropic: https://console.anthropic.com/usage
2. Purchase more credits or upgrade tier
3. Enable `UI_PROBE_FALLBACK_MODE=true` temporarily
4. Implement cost optimization strategies (see above)

### Rate Limit Errors

**Symptoms:**
```
Error: Rate limit reached
429 Too Many Requests (rate limit)
```

**Solutions:**
1. Add delays between tests:
```javascript
// Add 1 second between tests
await new Promise(resolve => setTimeout(resolve, 1000));
```

2. Upgrade API tier for higher limits
3. Use caching to reduce API calls
4. Distribute tests across multiple API keys (advanced)

### Network Connectivity Issues

**Symptoms:**
```
Error: Failed to connect to OpenAI/Anthropic
ECONNREFUSED, ETIMEDOUT
```

**Solutions:**
1. Check internet connectivity:
```bash
ping api.openai.com
curl https://api.openai.com/v1/models -I
```

2. Check firewall/proxy settings
3. Verify no VPN blocking API access
4. Check API status pages:
   - OpenAI: https://status.openai.com/
   - Anthropic: https://status.anthropic.com/

### Model Not Found

**Symptoms:**
```
Error: The model 'gpt-4' does not exist
404 Not Found
```

**Solutions:**
1. Verify model name in `.env`:
```bash
# Correct model names:
LLM_MODEL=gpt-4-turbo-preview  # OpenAI
LLM_MODEL=claude-3-opus-20240229  # Anthropic
```

2. Check account has access to model:
   - GPT-4 requires paid account
   - Claude Opus requires higher tier

3. Use fallback models:
```bash
LLM_MODEL=gpt-3.5-turbo  # Cheaper, faster, less capable
```

## Best Practices

### 1. Start with Minimal LLM Usage

Begin with explicit selectors and fallback mode, add LLM only where needed:

```javascript
// Phase 1: Fallback mode with explicit selectors
UI_PROBE_FALLBACK_MODE=true

// Phase 2: Enable LLM for specific tests
if (testRequiresIntelligence) {
  UI_PROBE_FALLBACK_MODE=false
}

// Phase 3: Full LLM for all complex tests
```

### 2. Cache Aggressively

```bash
LLM_CACHE_ENABLED=true
LLM_CACHE_TTL=7200  # 2 hours for stable sites
```

### 3. Monitor Costs Weekly

Set up alerts:
- Daily spend > $5
- Weekly spend > $30
- Monthly approaching $100

### 4. Use Journey Recording

Record workflows once with LLM, replay without:

```javascript
// Record once (uses LLM)
await ui_probe.journey_record_start({ name: 'User Signup' });
await ui_probe.run_flow({ goal: 'Sign up as new user' });
await ui_probe.journey_record_stop();

// Replay 1000x (no LLM cost)
for (let i = 0; i < 1000; i++) {
  await ui_probe.journey_play({ journeyId });
}
```

**Savings**: 99% cost reduction for repeated workflows

### 5. Use Appropriate Models

```bash
# Complex workflows - best understanding
LLM_MODEL=gpt-4-turbo-preview

# Simple forms - faster and cheaper
LLM_MODEL=gpt-3.5-turbo

# Balance of cost and quality
LLM_MODEL=gpt-4-turbo-preview
LLM_CACHE_ENABLED=true
```

## Advanced Configuration

### Multiple API Keys for Load Distribution

```bash
# Primary key
OPENAI_API_KEY=sk-proj-primary...

# Fallback keys (UI-Probe will rotate)
OPENAI_API_KEY_2=sk-proj-secondary...
OPENAI_API_KEY_3=sk-proj-tertiary...
```

### Per-Test LLM Configuration

```javascript
// Override LLM settings per test
await ui_probe.run_flow({
  goal: 'Complex workflow',
  llmConfig: {
    model: 'gpt-4-turbo-preview',
    maxTokens: 2000,
    temperature: 0.1,  // More deterministic
    cacheEnabled: true
  }
});
```

### Cost Tracking Integration

```javascript
// Track costs per test
const result = await ui_probe.run_flow({ goal: 'Signup' });

console.log(`Test cost: $${result.metrics.llmCost}`);
console.log(`Tokens used: ${result.metrics.tokens}`);
console.log(`API calls: ${result.metrics.apiCalls}`);
```

## Summary

### Key Takeaways

1. **LLM is required** for intelligent features (form inference, natural language, self-healing)
2. **Fallback mode available** for basic testing without API costs
3. **Costs are predictable**: ~$0.01-0.10 per intelligent test
4. **Multiple optimization strategies** can reduce costs by 50-80%
5. **Get API key from**: OpenAI or Anthropic (5-10 minutes setup)

### Quick Decision Guide

**Use LLM if:**
- Testing unfamiliar websites
- UI changes frequently
- Team has non-technical testers
- Natural language is valuable

**Use Fallback Mode if:**
- Testing stable applications
- Explicit selectors available
- Cost is primary concern
- CI/CD with high test volume

### Next Steps

1. Get API key (5 minutes): https://platform.openai.com/api-keys
2. Add to `.env` file (1 minute)
3. Run first intelligent test (see [Quick Start](../README.md#quick-start-5-minutes))
4. Monitor costs (weekly)
5. Optimize based on usage patterns

For more help, see:
- [README.md](../README.md) - Quick start guide
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues
- [API_REFERENCE.md](./API_REFERENCE.md) - Complete API docs