# Getting Started with UI-Probe in Claude Code CLI

This guide walks you through setting up UI-Probe to test websites using plain English commands in Claude Code CLI.

## Quick Overview

UI-Probe lets you test websites by describing what you want in plain English:

```bash
# Instead of writing code with complex selectors...
# You just describe what you want to test:
run_flow "Go to https://myapp.com/signup and create an account"
```

## Prerequisites

Before you begin, ensure you have:

1. **Node.js 18+** - [Download here](https://nodejs.org)
2. **Git** - For cloning the repository
3. **Claude Code CLI** - Should be installed and working
4. **5-10 minutes** - For initial setup

## Step-by-Step Installation

### Step 1: Clone UI-Probe

```bash
# Navigate to where you keep your tools (NOT inside your project)
cd ~  # or any directory outside your project

# Clone the repository
git clone https://github.com/yourusername/mcp-ui-probe.git

# Enter the directory
cd mcp-ui-probe
```

### Step 2: Install and Build

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

### Step 3: Install Browser Automation (CRITICAL!)

This step is **essential** - UI-Probe needs real browsers to test websites:

```bash
# Download Playwright browsers (470MB, one-time)
npx playwright install

# If you see permission errors, also run:
sudo npx playwright install-deps
```

⚠️ **Important:** Skipping this step will cause all tests to fail with "Navigation failed" errors!

### Step 4: Configure Claude Code CLI

Now tell Claude Code about UI-Probe:

```bash
# Navigate to YOUR PROJECT directory (where you want to test)
cd /path/to/your/project

# Add UI-Probe as an MCP server (use absolute path)
claude mcp add ui-probe "node" "/absolute/path/to/mcp-ui-probe/dist/index.js"

# Example if you cloned to home directory:
claude mcp add ui-probe "node" "$HOME/mcp-ui-probe/dist/index.js"
```

### Step 5: Restart Claude Code

After adding the MCP server:

1. Exit your current Claude Code session (Ctrl+C or type `exit`)
2. Start a new Claude Code session
3. UI-Probe tools are now available!

### Step 6: (Optional) Enable AI Features

For better natural language understanding, add your OpenAI API key:

```bash
# Navigate to mcp-ui-probe directory
cd ~/mcp-ui-probe

# Create .env file with your API key
echo "OPENAI_API_KEY=sk-your-key-here" > .env
```

This enables:
- Smarter interpretation of commands
- Better form filling
- Clearer error messages

## Verify Installation

Let's confirm everything is working:

### Test 1: Basic Analysis

In Claude Code CLI, type:

```
analyze_ui "https://example.com"
```

Expected output:
```
📊 UI Analysis for https://example.com

Found 2 forms:
  - newsletter_signup (footer)
  - search_form (header)

Found 5 buttons:
  - "More information" (main content)
  - "Subscribe" (newsletter)
  ...

Found 3 input fields:
  - email_field (newsletter)
  - search_field (header)
  ...
```

### Test 2: Navigation

```
navigate "https://google.com"
```

Expected output:
```
✅ Successfully navigated to https://google.com
Page title: Google
Load time: 0.8s
```

### Test 3: Simple Interaction

```
run_flow "Go to https://example.com and click the 'More information' link"
```

## Basic Commands

Here are the main commands you'll use in Claude Code CLI:

### navigate
Go to a specific webpage:
```bash
navigate "https://your-site.com"
```

### analyze_ui
Understand what's on a page:
```bash
analyze_ui "https://your-site.com"
```
Shows all forms, buttons, inputs, and interactive elements.

### fill_form
Intelligently fill out forms:
```bash
fill_form "https://your-site.com/contact" {"message": "Test message"}
```
Automatically fills all fields, using your overrides where specified.

### run_flow
Execute complete test scenarios:
```bash
run_flow "Go to https://site.com/login, sign in with test@example.com and password123, verify dashboard loads"
```

### assert_element
Verify content exists:
```bash
assert_element "https://site.com" "Welcome message" "visible"
```

### wait_for
Handle dynamic content:
```bash
wait_for "https://site.com" "Loading spinner" "hidden" 10
```

## Real-World Examples

### Example 1: Test User Registration

```bash
run_flow "Navigate to https://myapp.com/signup, fill out the registration form, submit it, and verify account creation"
```

UI-Probe will:
1. Navigate to the signup page
2. Identify all form fields
3. Generate appropriate test data (valid email, strong password, etc.)
4. Fill and submit the form
5. Verify success

### Example 2: Test E-Commerce Purchase

```bash
run_flow "Go to https://shop.com, search for 'laptop', add the first result to cart, and proceed to checkout"
```

UI-Probe will:
1. Navigate to the shop
2. Find and use the search feature
3. Select a product
4. Add to cart
5. Navigate through checkout

### Example 3: Test Form Validation

```bash
fill_form "https://myapp.com/contact" {"email": "invalid-email", "phone": "123"}
```

UI-Probe will:
1. Fill the form with invalid data
2. Submit it
3. Report validation errors clearly

## Testing Your Own Sites

### Local Development

```bash
# Make sure your dev server is running first!
# In your project: npm run dev (or similar)

# Then in Claude Code CLI:
analyze_ui "http://localhost:3000"
run_flow "Sign up for an account at http://localhost:3000/register"
```

### Staging Environment

```bash
run_flow "Test the new feature at https://staging.myapp.com/feature"
```

### Production (Careful!)

```bash
# Test without submitting real data
run_flow "Navigate to https://myapp.com/contact and verify the form loads correctly without submitting"
```

## Common Patterns

### Multi-Step User Journey
```bash
run_flow "Go to https://app.com, click login, enter demo@example.com and Demo123!, click submit, verify dashboard appears"
```

### Form with Specific Data
```bash
fill_form "https://app.com/profile" {
  "company": "ACME Corp",
  "phone": "555-0100"
}
# Other fields filled automatically
```

### Conditional Testing
```bash
run_flow "Go to https://shop.com, if there's a sale banner, click it and verify discount prices appear"
```

### Testing Search
```bash
run_flow "Go to https://docs.site.com, search for 'installation', verify results contain setup guide"
```

## Troubleshooting

### "Navigation failed" Error

**Cause:** Playwright browsers not installed or URL incorrect

**Fix:**
```bash
# Install browsers
cd ~/mcp-ui-probe
npx playwright install

# Verify URL is accessible
curl https://your-url.com
```

### "Tool not found" in Claude Code

**Cause:** MCP server not loaded

**Fix:**
1. Check config: `claude mcp list`
2. Restart Claude Code
3. Re-add if needed: `claude mcp add ui-probe "node" "/path/to/mcp-ui-probe/dist/index.js"`

### "Element not found" Error

**Cause:** Element doesn't exist or isn't visible yet

**Fix:**
```bash
# First, see what's on the page
analyze_ui "https://your-site.com"

# Use wait_for for dynamic content
wait_for "https://your-site.com" "Button text" "visible" 10
```

### Form Not Filling Correctly

**Cause:** Custom dropdowns or non-standard inputs

**Fix:**
```bash
# Analyze the form structure
analyze_ui "https://your-site.com/form"

# Be specific in commands
run_flow "Click the country dropdown and select United States"
```

## Best Practices

### 1. Start Simple
Begin with basic commands before complex flows:
```bash
# First: Navigate
navigate "https://myapp.com"

# Then: Analyze
analyze_ui "https://myapp.com"

# Finally: Interact
run_flow "Complete signup at https://myapp.com/register"
```

### 2. Use analyze_ui First
Before writing tests, understand what UI-Probe sees:
```bash
analyze_ui "https://your-site.com/form"
```

### 3. Be Specific When Needed
```bash
# Too vague
click "https://site.com" "Submit"

# Better
click "https://site.com" "Submit button in the contact form"
```

### 4. Test Incrementally
Build up complex tests step by step:
```bash
# Step 1: Can we navigate?
navigate "https://app.com"

# Step 2: Can we find the form?
analyze_ui "https://app.com/signup"

# Step 3: Can we fill it?
fill_form "https://app.com/signup" {}

# Step 4: Complete flow
run_flow "Complete signup process at https://app.com/signup"
```

## Advanced Configuration

### Environment Variables (.env)

Create a `.env` file in the mcp-ui-probe directory:

```bash
# AI Integration
OPENAI_API_KEY=sk-...        # For GPT-4
ANTHROPIC_API_KEY=sk-ant-... # For Claude

# Browser Settings
HEADLESS=false               # Show browser window
DEBUG=true                   # Verbose logging

# Performance
TIMEOUT=30000                # Default timeout (ms)
CACHE_TTL=300000            # Cache responses for 5 min
```

### Custom Test Data

Override automatic data generation:

```javascript
fill_form "https://site.com/form" {
  "email": "specific@test.com",
  "company": "Test Corp"
  // Other fields auto-filled
}
```

## Testing the Test Suite

UI-Probe includes test pages for verification:

```bash
# Terminal 1: Start test server
cd ~/mcp-ui-probe
npm run test:server

# Terminal 2: In Claude Code CLI
analyze_ui "http://localhost:8080/test/forms"
fill_form "http://localhost:8080/test/forms" {}
run_flow "Complete all tests at http://localhost:8080/test"
```

Test pages available:
- `/test/forms` - Various form types
- `/test/navigation` - Links and buttons
- `/test/dynamic` - JavaScript content
- `/test/validation` - Form validation

## Next Steps

Now that UI-Probe is working:

1. **Test your sites** - Start with simple pages, then complex flows
2. **Read the [Usage Guide](USAGE.md)** - Detailed command documentation
3. **Check [Examples](../examples/)** - Real-world test scenarios
4. **Enable AI** - Add your API key for better understanding
5. **Join the community** - Share tests and get help

## Getting Help

- **This guide** - You're reading it!
- **[Usage Guide](USAGE.md)** - Detailed documentation
- **[Examples](../examples/)** - Code samples
- **[GitHub Issues](https://github.com/yourusername/mcp-ui-probe/issues)** - Report problems
- **[API Reference](API_REFERENCE.md)** - Complete command list

---

Remember: UI-Probe makes testing as simple as describing what a human would do. No more brittle selectors or complex code!