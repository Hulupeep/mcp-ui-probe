# Claude Code CLI Guide for MCP UI Probe

## How It Works with URLs

**IMPORTANT**: The AI doesn't guess URLs. You must always provide:
1. The **goal** (what to test)
2. The **URL** (where to test it)

## Claude Code CLI Examples

When using Claude Code CLI (not Desktop), here's how to interact with the MCP UI Testing server:

### Basic Command Structure

```bash
# You MUST provide both the action AND the URL
"Test signup on https://example.com/register"
"Check if login works at https://myapp.com/login"
"Verify checkout process on https://shop.com/cart"
```

### Example 1: Testing a Local Development Site

```bash
# In Claude Code CLI
You: Test if users can create an account on my local site at localhost:3000

Claude will execute:
{
  "tool": "run_flow",
  "arguments": {
    "goal": "create an account",
    "url": "http://localhost:3000"  # URL is required!
  }
}

Result:
✅ Found signup form at /signup
✅ Created account with test@example.com
✅ Verification email would be sent
```

### Example 2: Testing a Specific Form

```bash
# Be specific about WHAT to test and WHERE
You: Test the newsletter signup form at the bottom of https://mysite.com

Claude will:
1. Navigate to https://mysite.com
2. Scroll to find newsletter form at bottom
3. Fill and submit with test email
4. Verify success message appears
```

### Example 3: Multi-Step Process with Starting URL

```bash
You: Complete a purchase starting from https://shop.com/products/laptop

Claude will:
1. Start at the specific product page
2. Add to cart
3. Proceed to checkout
4. Fill shipping/payment
5. Complete order
```

### Example 4: Testing with Specific Constraints

```bash
You: Test registration on https://app.com/signup but use a UK phone number and address

Claude executes:
{
  "tool": "run_flow",
  "arguments": {
    "goal": "register new account",
    "url": "https://app.com/signup",
    "constraints": {
      "country": "UK",
      "phoneFormat": "+44",
      "addressCountry": "United Kingdom"
    }
  }
}
```

## URL Navigation Patterns

### Pattern 1: Direct URL to Form
```bash
# If you know the exact form URL
You: Test signup at https://app.com/register

The AI goes directly to /register and finds the form
```

### Pattern 2: Navigate from Homepage
```bash
# Starting from homepage
You: Starting from https://app.com, find and test the signup process

The AI will:
1. Load homepage
2. Look for "Sign Up", "Register", "Get Started" buttons
3. Click to navigate to signup page
4. Test the form
```

### Pattern 3: Multi-Page Flow
```bash
# E-commerce example
You: Buy a blue shirt starting from https://shop.com

The AI will:
1. Start at homepage
2. Navigate to shirts category
3. Filter/search for blue
4. Select a shirt
5. Add to cart
6. Complete checkout
```

## Common Claude Code CLI Patterns

### Testing Form Validation
```bash
You: Test if the signup form at https://app.com/register properly validates email addresses

Claude will:
1. Navigate to exact URL
2. Try invalid emails: "notanemail", "missing@", "@nodomain.com"
3. Verify error messages appear
4. Try valid email
5. Verify acceptance
```

### Testing Search Functionality
```bash
You: Search for "laptop" on https://electronics.com and verify results appear

Claude will:
1. Go to homepage
2. Find search box
3. Type "laptop"
4. Submit search
5. Verify results contain laptop products
```

### Testing Protected Areas
```bash
You: First login at https://app.com/login with test@example.com/password123,
     then test the profile update form at https://app.com/profile

Claude will:
1. Navigate to login URL
2. Login with credentials
3. Navigate to profile URL
4. Test profile update form
```

## URL Requirements

### ✅ Valid URLs the AI Can Test

```bash
https://production-site.com       # Production sites
https://staging.app.com           # Staging environments
http://localhost:3000             # Local development
http://192.168.1.100:8080        # Local network
https://app.ngrok.io             # Tunneled local sites
https://user:pass@protected.com  # Basic auth sites
```

### ❌ Invalid URLs that Won't Work

```bash
myapp.com                        # Missing protocol
www.site.com                     # Missing protocol
localhost                        # Missing protocol and port
/signup                          # Relative path only
file:///path/to/file.html       # Local file paths
```

## Setting Up for Claude Code CLI

### 1. Start the MCP Server

```bash
# In your project directory
npm start

# Server runs on port 3000
# Monitor dashboard on port 3001
```

### 2. Configure Claude Code

Create `.claude/mcp_settings.json` in your project:

```json
{
  "servers": {
    "ui-tester": {
      "command": "node",
      "args": ["./node_modules/mcp-ui-probe/dist/index.js"],
      "env": {
        "MCP_PORT": "3000"
      }
    }
  }
}
```

### 3. Use in Claude Code CLI

```bash
# Now you can use natural language with URLs
You: Test if users can sign up on my app at localhost:3000/register

You: Check if the checkout works on https://mystore.com starting with
     an item already in cart

You: Verify that form validation works on https://app.com/contact
```

## Advanced Scenarios

### Scenario 1: Testing Different User Paths

```bash
You: Test three different paths on https://app.com:
1. New user signup at /register
2. Existing user login at /login
3. Password reset at /forgot-password
```

### Scenario 2: Testing with Specific Data

```bash
You: Test signup at https://app.com/register using:
- Email: specific.test@mycompany.com
- Company name: ACME Corp
- Use California address
```

### Scenario 3: Performance Testing

```bash
You: Test how fast the signup form at https://app.com/register
     loads and can be submitted
```

## Debugging URL Issues

### If the AI Can't Find Your Form

```bash
# Be more specific about the location
You: Test the signup form at https://app.com/register
     (it's in a modal that opens when you click "Get Started")

# Or provide navigation hints
You: Go to https://app.com, click the "Sign Up" button in the top right,
     then test the registration form that appears
```

### If Testing the Wrong Page

```bash
# Provide explicit URL and context
You: Test ONLY the contact form at https://app.com/contact
     (not the newsletter signup)
```

## Integration with CI/CD

```yaml
# .github/workflows/ui-test.yml
- name: Run UI Tests with Claude Code
  run: |
    # Start MCP server
    npm start &
    sleep 5

    # Run tests via CLI
    npx claude-code test "Test signup at https://staging.app.com/register"
    npx claude-code test "Test login at https://staging.app.com/login"
    npx claude-code test "Test checkout at https://staging.app.com/shop"
```

## Best Practices

1. **Always provide the full URL** including protocol (http:// or https://)
2. **Be specific about what to test** ("signup form" vs "newsletter signup")
3. **Specify the starting point** for multi-step processes
4. **Use constraints** for specific test data requirements
5. **Monitor the dashboard** at http://localhost:3001 to see what's happening

## Quick Reference

```bash
# Basic test
"Test [what] at [full URL]"

# With navigation
"Starting from [URL], find and test [what]"

# With specific data
"Test [what] at [URL] using [constraints]"

# Multi-step
"At [URL], do [step1], then [step2], then [step3]"
```

Remember: The AI is smart about finding elements and understanding pages, but it needs to know WHERE to look. Always provide the URL!