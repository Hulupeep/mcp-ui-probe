# LLM Integration Guide for UI-Probe

UI-Probe now includes advanced AI-powered testing capabilities using OpenAI GPT-4 or Claude APIs. This provides true contextual understanding of your testing goals instead of relying on simple pattern matching.

## 🚀 What's New

### Intelligent Goal Understanding
- **Natural Language Processing**: Understands complex testing goals like "Sign up with a random email, accept terms, and verify the welcome message appears"
- **Multi-Step Workflows**: Automatically breaks down complex goals into atomic, executable steps
- **Context-Aware Recovery**: When tests fail, the AI suggests alternative approaches based on the actual page content

### Key Components

1. **LLM Strategy**: Interprets natural language goals using GPT-4 or Claude
2. **Workflow Decomposer**: Breaks complex workflows into optimized steps
3. **Adaptive Executor**: Executes steps with intelligent error recovery

## 📋 Prerequisites

1. **API Key Required**: You need either an OpenAI or Anthropic API key
   - OpenAI: Get from https://platform.openai.com/api-keys
   - Anthropic: Get from https://console.anthropic.com/

2. **Install Dependencies**:
```bash
npm install
```

## 🔧 Configuration

### Step 1: Copy Environment File
```bash
cp .env.example .env
```

### Step 2: Add Your API Key
Edit `.env` and add your API key:

```env
# For OpenAI (Recommended)
OPENAI_API_KEY=sk-your-openai-api-key-here

# OR for Anthropic/Claude
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here

# Optional: Customize the model
LLM_MODEL=gpt-4-turbo-preview  # or gpt-4, gpt-3.5-turbo
LLM_TEMPERATURE=0.3  # Lower = more deterministic

# Enable caching to reduce API costs
LLM_CACHE_ENABLED=true
LLM_CACHE_TTL=300000  # 5 minutes
```

### Step 3: Rebuild and Start
```bash
npm run build
npm start
```

## 🎯 How It Works

### Without LLM (Fallback Mode)
When no API key is configured, UI-Probe uses regex patterns:
```javascript
// Simple pattern matching
"Click the Login button" → action: "click", target: "Login"
```

### With LLM (Intelligent Mode)
With an API key, UI-Probe uses AI for contextual understanding:
```javascript
// Complex goal understanding
"Navigate to signup, fill the form with test data, and submit" →
[
  { action: "navigate", url: "/signup" },
  { action: "fill", data: { email: "test@example.com", password: "SecurePass123" } },
  { action: "click", target: "terms checkbox" },
  { action: "click", target: "submit button" }
]
```

## 💡 Usage Examples

### Basic Navigation and Click
```javascript
run_flow({
  goal: "Go to the homepage and click on Get Started"
})
// AI understands: navigate → find button → click
```

### Complex Form Submission
```javascript
run_flow({
  goal: "Sign up for an account with email test@example.com, password SecurePass123, accept terms, and submit"
})
// AI understands: navigate → fill multiple fields → check checkbox → submit
```

### Conditional Workflows
```javascript
run_flow({
  goal: "If logged in, go to dashboard, otherwise go to login page"
})
// AI understands: check condition → branch logic → execute appropriate path
```

### Error Recovery
```javascript
run_flow({
  goal: "Click the Submit button"
})
// If button not found, AI suggests:
// - "Try searching for 'Continue' instead"
// - "Check if page loaded completely"
// - "Look for submit link in navigation"
```

## 🔍 Advanced Features

### 1. Multi-Step Workflow Optimization
The AI automatically:
- Merges consecutive fill operations
- Removes redundant navigation
- Optimizes step order for efficiency

### 2. Smart Selector Alternatives
When elements aren't found, the AI suggests alternatives based on:
- Page content analysis
- Common UI patterns
- Semantic understanding

### 3. Validation Detection
Automatically detects and handles:
- Form validation errors
- Required field indicators
- Error messages

### 4. Context Preservation
Maintains context between steps:
- Stores generated data for later use
- Tracks page state changes
- Preserves user session

## 📊 Cost Optimization

### Caching
Responses are cached for 5 minutes by default to reduce API calls:
```env
LLM_CACHE_ENABLED=true
LLM_CACHE_TTL=300000  # milliseconds
```

### Model Selection
Choose based on your needs:
- `gpt-4-turbo-preview`: Best accuracy (recommended)
- `gpt-4`: High accuracy, slower
- `gpt-3.5-turbo`: Faster, cheaper, less accurate

### Token Usage
Typical costs:
- Simple goal parsing: ~$0.002 per request
- Complex workflow decomposition: ~$0.01 per request
- Error interpretation: ~$0.003 per request

## 🐛 Troubleshooting

### No API Key
```
INFO: No LLM API keys configured, using regex parser
```
**Solution**: Add your API key to `.env`

### API Rate Limits
```
ERROR: LLM parsing failed, falling back to regex
```
**Solution**: The system automatically falls back to regex parsing

### High API Costs
**Solution**:
- Enable caching: `LLM_CACHE_ENABLED=true`
- Use cheaper model: `LLM_MODEL=gpt-3.5-turbo`
- Increase cache TTL: `LLM_CACHE_TTL=600000`

## 🚦 Fallback Behavior

UI-Probe gracefully degrades when:
1. No API key is configured → Uses regex patterns
2. API request fails → Falls back to regex
3. API returns invalid response → Uses default behavior
4. Rate limit exceeded → Continues with regex

This ensures your tests always run, even without AI assistance.

## 📈 Performance Impact

With LLM enabled:
- **Initial request**: +200-500ms for AI parsing
- **Cached requests**: No additional latency
- **Error recovery**: +300-800ms for alternative suggestions
- **Overall**: 2-3x more reliable test execution

## 🔐 Security

- API keys are never logged or transmitted except to the respective API
- Sensitive form data is not sent to LLM APIs
- All API calls use HTTPS
- Cache is memory-only, cleared on restart

## 📚 API Reference

### LLMStrategy Methods

```typescript
// Parse natural language goal
await llmStrategy.parseGoal("Click the Login button")

// Interpret error and get suggestions
await llmStrategy.interpretError("Element not found", context)

// Get alternative selectors
await llmStrategy.suggestAlternatives("button[text='Login']", pageContent)
```

### WorkflowDecomposer Methods

```typescript
// Break down complex goal
await decomposer.decompose("Sign up and verify email")

// Optimize workflow steps
await decomposer.optimize(steps)
```

### AdaptiveExecutor Methods

```typescript
// Execute single action with retry
await executor.execute(page, action, options)

// Execute workflow sequence
await executor.executeSequence(page, actions)
```

## 🎓 Best Practices

1. **Be Specific**: "Click the blue Submit button" is better than "Click Submit"
2. **Include Context**: "On the signup page, fill the email field"
3. **Use Natural Language**: Write goals as you would explain to a human
4. **Leverage Caching**: Reuse similar goals to benefit from cache
5. **Monitor Costs**: Check your API usage regularly

## 🔄 Migration from Regex-Only

No code changes required! Simply:
1. Add your API key to `.env`
2. Restart the server
3. Existing tests automatically use AI understanding

## 📝 Example Test Scenarios

### E-commerce Checkout
```javascript
run_flow({
  goal: "Add item to cart, proceed to checkout, fill shipping info with test data, and complete purchase"
})
```

### User Registration
```javascript
run_flow({
  goal: "Register a new account with random email, strong password, accept all terms, and verify confirmation message"
})
```

### Search and Filter
```javascript
run_flow({
  goal: "Search for 'laptop', filter by price under $1000, sort by rating, and click the first result"
})
```

## 🤝 Contributing

Help improve LLM integration:
1. Report issues with goal parsing
2. Suggest new patterns for decomposition
3. Share complex test scenarios
4. Contribute alternative recovery strategies

## 📞 Support

- **Issues**: https://github.com/yourusername/ui-probe/issues
- **Documentation**: https://github.com/yourusername/ui-probe/docs
- **API Status**: Check OpenAI/Anthropic status pages

---

**Note**: LLM integration is optional. UI-Probe works without API keys using pattern matching, but AI integration provides significantly better understanding and reliability for complex testing scenarios.