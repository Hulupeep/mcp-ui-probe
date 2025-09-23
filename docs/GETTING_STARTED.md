# Getting Started with MCP UI Probe

## For Claude Code CLI Users (Primary Guide)

### What You'll Be Able to Do

Once set up, you can tell Claude Code things like:

```bash
# You MUST always provide the URL - the AI doesn't guess!
"Test if users can sign up on https://mysite.com/register"
"Check if the checkout works at https://shop.com/cart"
"Verify the contact form at https://example.com/contact"
"Test login on localhost:3000/login"
```

**IMPORTANT**: Always provide both:
1. **What to test** (signup, login, checkout, etc.)
2. **Where to test it** (the complete URL including http:// or https://)

### Step 1: Prerequisites

Before starting, make sure you have:

1. **Node.js installed** (version 18 or higher)
   - Check: `node --version`
   - Install from: [nodejs.org](https://nodejs.org)

2. **Claude Code CLI** installed and working
   - You should be able to run `claude` commands

3. **A website to test**
   - Must be accessible via URL
   - Can be local: `http://localhost:3000`
   - Or remote: `https://yoursite.com`

### Step 2: Install MCP UI Probe

#### Option A: Quick Install (Recommended)

```bash
# Clone and setup in one command
git clone https://github.com/Hulupeep/mcp-ui-probe.git
cd mcp-ui-probe
npm install
npm run build
```

#### Option B: Install as Package

```bash
# In your project directory
npm install mcp-ui-probe

# Or globally
npm install -g mcp-ui-probe
```

### Step 3: Start the Testing Server

```bash
# In the mcp-ui-probe directory
npm start

# You should see:
# ✅ MCP UI Testing Server started on port 3000
# ✅ Monitoring dashboard available at http://localhost:3001
# 📊 Waiting for test requests...
```

**Keep this terminal open!** The server needs to stay running.

### Step 4: Configure Claude Code

Create or update `.claude/mcp_settings.json` in your project:

```json
{
  "servers": {
    "ui-tester": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-ui-probe/dist/index.js"],
      "env": {
        "MCP_PORT": "3000",
        "MONITORING_PORT": "3001",
        "BROWSER_HEADLESS": "true"
      }
    }
  }
}
```

Or use the automatic setup:

```bash
# In the mcp-ui-probe directory
npm run setup-claude
```

### Step 5: Verify Everything Works

1. **Check the monitoring dashboard:**
   - Open browser: `http://localhost:3001`
   - Should see the dashboard interface

2. **Test with Claude Code CLI:**
   ```bash
   # Test a public site (always include the URL!)
   claude "Test if the search works on https://example.com"
   ```

3. **Check server logs:**
   - You should see activity in the terminal running `npm start`

### Step 6: Your First Real Tests

#### Testing Your Local Development Site

```bash
# MUST include localhost URL
claude "Test if users can sign up on http://localhost:3000/register"

# Claude will:
# 1. Navigate to http://localhost:3000/register
# 2. Find the signup form
# 3. Fill it with test data
# 4. Submit and check results
```

#### Testing a Production Site

```bash
# Always provide the full URL
claude "Test the login process on https://myapp.com/login"

# Claude will:
# 1. Go to the exact URL you provided
# 2. Find the login form
# 3. Test with generated credentials
# 4. Report success or failure
```

#### Testing Multi-Step Processes

```bash
# Specify the starting URL
claude "Starting from https://shop.com/products,
        find a laptop under $1000 and add it to cart"

# Claude will:
# 1. Start at /products page
# 2. Find and filter laptops
# 3. Select one under $1000
# 4. Add to cart
# 5. Verify it was added
```

## Understanding URL Requirements

### ✅ Correct Usage - Always Provide URLs

```bash
# GOOD - URL is specified
"Test signup at https://app.com/register"
"Check if login works on http://localhost:3000/login"
"Verify checkout on https://shop.com/cart"

# GOOD - Clear starting point for navigation
"Starting from https://app.com, navigate to signup and test it"
"Go to https://shop.com and search for blue shirts"
```

### ❌ Wrong Usage - Missing URLs

```bash
# BAD - No URL provided
"Test signup"  # Where? The AI doesn't know!
"Check if login works"  # On which site?
"Verify the checkout process"  # What URL?

# BAD - Incomplete URLs
"Test signup on myapp"  # Missing protocol
"Check localhost"  # Missing port and protocol
"Test example.com"  # Missing protocol (http:// or https://)
```

## Common Claude Code CLI Patterns

### Pattern 1: Direct Form Testing
```bash
# Provide exact form URL
claude "Test the contact form at https://mysite.com/contact"
```

### Pattern 2: Navigation Testing
```bash
# Start from homepage, navigate to form
claude "Starting from https://mysite.com,
        click on 'Contact Us' and test the form"
```

### Pattern 3: Validation Testing
```bash
# Test specific validation rules
claude "Test if email validation works correctly
        on the signup form at https://app.com/register"
```

### Pattern 4: Multi-Step Workflows
```bash
# Complete purchase flow
claude "On https://shop.com, search for 'laptop',
        add the first result to cart,
        and proceed to checkout"
```

## Examples for Different Scenarios

### Local Development
```bash
# Testing on localhost (include port!)
claude "Test user registration on http://localhost:3000/signup"
claude "Verify API integration on http://localhost:8080/dashboard"
claude "Check form validation on http://127.0.0.1:5000/contact"
```

### Staging Environment
```bash
# Testing staging sites
claude "Test new feature on https://staging.myapp.com/feature"
claude "Verify deployment on https://test.example.com"
```

### Production Testing
```bash
# Careful testing on production
claude "Verify the contact form still works on https://myapp.com/contact
        but don't submit real data"
```

### With Specific Constraints
```bash
# Test with specific requirements
claude "Test signup on https://app.com/register
        using a UK phone number and London address"

claude "Test checkout on https://shop.com
        with express shipping to California"
```

## Debugging Common Issues

### Issue: "Cannot find form"

**Problem**: AI can't locate the form on the page

**Solution**: Be more specific with the URL and location:
```bash
# Instead of:
claude "Test signup"

# Use:
claude "Test the signup form at https://app.com/register
        (it's in a modal that opens when you click 'Get Started')"
```

### Issue: "URL not accessible"

**Problem**: The site can't be reached

**Solutions**:
```bash
# Check if site is running
curl http://localhost:3000  # Should return HTML

# For local development, ensure correct URL format
# ✅ Correct
"http://localhost:3000"
"http://127.0.0.1:3000"

# ❌ Wrong
"localhost:3000"  # Missing protocol
"www.localhost:3000"  # Invalid format
```

### Issue: "Test runs on wrong page"

**Problem**: AI navigates to unexpected page

**Solution**: Provide explicit URL and context:
```bash
# Be very specific
claude "Test ONLY the newsletter signup at https://app.com/footer
        (not the main registration form)"
```

## Monitoring Your Tests

While tests run, you can:

1. **Watch Live Execution**: Open `http://localhost:3001`
2. **See AI Decisions**: Understand why each action was taken
3. **View Screenshots**: See what the AI sees
4. **Check Timing**: Monitor performance metrics

## Advanced Usage

### Running Multiple Tests
```bash
# Test multiple forms in sequence
claude "First test login at https://app.com/login,
        then test signup at https://app.com/register,
        finally test password reset at https://app.com/forgot"
```

### Conditional Testing
```bash
# Test with conditions
claude "If https://shop.com has a sale banner,
        test purchasing a discounted item,
        otherwise test regular purchase"
```

### Performance Testing
```bash
# Check performance while testing
claude "Test how quickly the signup form at https://app.com/register
        loads and can be submitted"
```

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/ui-tests.yml
- name: Start MCP UI Probe
  run: |
    cd mcp-ui-probe
    npm start &
    sleep 5

- name: Run UI Tests
  run: |
    claude "Test critical user flows on https://staging.myapp.com/signup"
    claude "Verify checkout process on https://staging.myapp.com/shop"
```

## Next Steps

1. **Try different sites**: Test your local development, staging, and production
2. **Explore the dashboard**: Watch tests execute at `http://localhost:3001`
3. **Read the Claude Code Guide**: [CLAUDE_CODE_GUIDE.md](CLAUDE_CODE_GUIDE.md)
4. **Check examples**: Look at `examples/` directory for code samples

## Getting Help

- **Dashboard**: Check `http://localhost:3001` for live execution details
- **Logs**: Server logs show what's happening
- **GitHub Issues**: [Report problems](https://github.com/Hulupeep/mcp-ui-probe/issues)
- **Examples**: See `examples/` folder for working code

---

**Remember**: The AI is smart about finding elements and understanding pages, but it ALWAYS needs to know the URL. Never assume it will guess where to go!