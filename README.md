# UI-Probe: Test Any Website in Plain English

## The Problem

Website testing is broken. You write hundreds of lines of code that breaks the moment a developer changes a button class from `btn-primary` to `button-primary`. Your tests fail not because the app is broken, but because someone moved a div or renamed an ID.

## The Solution

**UI-Probe** is an **assistant-first, Claude/MCP-native web app tester**.

UI-Probe lets you test websites by describing what you want to do in plain English. No code. No selectors. Just describe it like you'd tell a human.

## ⚡ Not the First, But a Different Take

Tools like **Testim**, **Mabl**, and **Rainforest QA** already bring codeless/AI testing to market. They’re powerful, but often **enterprise-heavy, SaaS-locked, and tuned for QA engineers**.

**UI-Probe takes a different path:**

- **Assistant-first** → Runs natively inside Claude via MCP. You just talk to your assistant and watch it work.
- **Plain English by default** → No scripts, no recorders. Just tell it what you want tested.
- **Beginner-friendly** → PMs, designers, and non-devs can use it right away.
- **Open-source + lightweight** → Clone, run, hack. No vendor lock-in.
- **From testing → to doing** → Today: check your web flows. Tomorrow: actually run them.

### From Testing → to Doing

UI-Probe doesn’t stop at testing. The same way you say:

- “✅ Test if users can sign up”

…you can also say:

- “✅ Actually sign me up for an account”
- “✅ Buy a blue shirt from the shop”
- “✅ Order me a ham + mustard sandwich from sandwich.com and deliver it”

So what starts as a **QA helper** can also become your **personal web agent** — able to test, repeat, and even perform real tasks for you.

UI Probe is not just testing — it's a **universal intention layer for the web**  made simple.

### What Makes UI-Probe Different

- **Built-in test playground** - Test pages included to try before deploying to your project
- **Real-time monitoring** - Watch tests run with live feedback
- **Claude-native** - Designed specifically for Claude Code CLI, not retrofitted
- **Actually works for non-devs** - PMs, designers, QA can use it immediately
- **Open source** - No vendor lock-in, customize as needed
- **Semantic AI Resolution** - Smart hybrid that uses Playwright's semantic selectors first, then falls back to LLM intelligence only when needed. This means your tests find "Technology" checkboxes even when `value="tech"`, without burning API calls on simple matches
- **No Code Required** - Unlike raw Playwright MCP where Claude must write test scripts, UI-Probe works immediately without any programming
- **Deterministic JSON Responses** - Every action returns structured JSON that enables conditional logic and automation:

```json
{
  "success": true,
  "data": {
    "clicked": true,
    "selector": "button:has-text(\"Submit Form\")",
    "currentUrl": "http://localhost:8083/test/forms",
    "pageTitle": "Forms Testing - UI-Probe"
  }
}
```

This means you can build intelligent workflows:
```bash
# If form submission fails, try alternative flow
if response.success == false:
  navigate to backup_url
  retry with different_data
```

```bash
# Instead of this nightmare:
await driver.findElement(By.xpath("//div[@id='login-form']//input[@name='email']")).sendKeys("test@example.com");
await driver.findElement(By.css(".btn-submit.primary")).click();

# You can use natural language:
"Test the signup form"

# Or explicit commands when you need precision:
fill_form {"email": "test@example.com"}
click_button "Sign Up"
```

## For Complete Beginners

Never written code? Perfect! UI-Probe is designed for you:

1. **Install it** (one-time setup, 5 minutes)
2. **Tell it what to test** in plain English
3. **Get clear results** - "✅ Account created" or "❌ The signup button is hidden"

### Example for Non-Developers

Want to test your website's contact form every day? Just type:

```bash
# In Claude, you can be natural:
"Test the contact form on my homepage"

# Claude figures out the URL from context, or you can be explicit:
fill_form "https://mysite.com/contact" {"message": "Testing!"}
```

That's it. No programming required.

## For Developers

UI-Probe gives you:
- **Self-healing tests** - Automatically adapts when UI changes
- **80% less code** - One line instead of dozens
- **AI-powered intelligence** - Uses GPT-4/Claude to understand pages
- **Clear error messages** - "Button is hidden by cookie banner" vs "ElementNotInteractableException"

## Quick Start (5 Minutes)

### 🎯 TL;DR - Get Running Quickly
```bash
npx mcp-ui-probe setup                                                      # 1. Install browsers (one-time)
echo "OPENAI_API_KEY=sk-..." > .env                                        # 2. Add API key (optional but recommended)
curl -sSL https://raw.githubusercontent.com/Hulupeep/mcp-ui-probe/main/scripts/claude-setup.sh | bash  # 3. Connect to Claude
claude                                                                       # 4. Start using!
```

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org) - just click "Next" through installer)
- Claude Code CLI or any terminal
- OpenAI or Anthropic API key for best results (optional - works without but poorer performance)

### System Requirements
- **OS**: Windows, macOS, or Linux
- **Node.js**: Version 18 or higher
- **Disk Space**: ~500MB for Playwright browsers (one-time download)
- **RAM**: 2GB minimum, 4GB recommended

### Option 1: Use with npx (Easiest - Works Everywhere!)

#### Step 1: Initial Setup (One-Time Only)
```bash
# Install Playwright browsers needed for web testing (~500MB, takes 2-3 minutes)
npx mcp-ui-probe setup
```

#### Step 2: Enable AI Intelligence (Optional but Recommended)

For best results with intelligent form understanding, set your API key:

```bash
# Create a .env file in your current directory
echo "OPENAI_API_KEY=your-key-here" > .env
# OR for Anthropic
echo "ANTHROPIC_API_KEY=your-key-here" > .env
```

**Note:** UI-Probe works without this, but AI features significantly improve:
- Form field understanding
- Error message clarity
- Natural language processing
- Smart element detection

#### Step 3: Connect to Claude Code CLI

**Why this extra step?** Claude Code CLI can't find `npx` by itself because it doesn't have access to your shell's PATH. You need to tell Claude exactly where npx is located on your computer.

**Option A: Automatic Setup (Easiest - does everything for you):**
```bash
# This script will:
# 1. Find where npx is installed on your computer
# 2. Add UI-Probe to Claude with the correct path
# 3. Verify everything is configured properly
curl -sSL https://raw.githubusercontent.com/Hulupeep/mcp-ui-probe/main/scripts/claude-setup.sh | bash
```

After running this, just restart Claude and UI-Probe will be ready to use!

**Option B: Manual Setup (if automatic doesn't work):**

**Step 1: Find your npx path**
```bash
# On macOS/Linux:
which npx
# Example output: /usr/local/bin/npx or ~/.nvm/versions/node/v20.11.0/bin/npx

# On Windows:
where npx
# Example output: C:\Program Files\nodejs\npx.cmd
```

**Step 2: Add to Claude with the full path**
```bash
# Use YOUR path from Step 1:
claude mcp add ui-probe "/full/path/to/npx" "mcp-ui-probe@latest" "start"

# Real examples:
# Standard Node:
claude mcp add ui-probe "/usr/local/bin/npx" "mcp-ui-probe@latest" "start"

# Using NVM:
claude mcp add ui-probe "$HOME/.nvm/versions/node/v22.11.0/bin/npx" "mcp-ui-probe@latest" "start"

# Windows:
claude mcp add ui-probe "C:\Program Files\nodejs\npx.cmd" "mcp-ui-probe@latest" "start"
```

#### Step 4: Start Using UI-Probe in Claude!

```bash
# Start Claude Code CLI
claude

# UI-Probe tools are now available! Try:
# - Navigate to websites
# - Analyze page elements
# - Fill and submit forms
# - Run complete test flows
```

#### Step 5: (Optional) Try the Test Playground

Want to see UI-Probe in action before testing your own sites?

```bash
# Start the built-in test server with example forms
npx mcp-ui-probe test-server   # Runs on http://localhost:8081/test
npx mcp-ui-probe test-server --port 3000   # Use custom port if 8081 is busy

# Visit http://localhost:8081/test in your browser to see the playground
# Then in Claude, try: run_flow "Sign up as new user" "http://localhost:8081/test"
```

### Option 2: Install from Source

```bash
# Clone it (this downloads the code)
git clone https://github.com/Hulupeep/mcp-ui-probe.git
cd mcp-ui-probe

# Install it (this sets everything up)
npm install

# CRITICAL: Install browsers (one-time, takes 2-3 minutes)
npx playwright install

# Add to Claude:
claude mcp add ui-probe "node" "/path/to/mcp-ui-probe/dist/index.js"
```

### Start Testing!

```bash
# In Claude, just describe what you want:
"Test if users can sign up on example.com"

# Or be specific:
run_flow "Go to https://example.com/signup and create an account"
```

## How UI-Probe Works in Claude

### Natural Language (Default - Just Talk Normally!)

UI-Probe understands what you want to do:

```bash
# Just describe what you want - UI-Probe figures it out:
"Test if users can sign up on example.com"
"Check if the checkout process works"
"Fill out the contact form with test data"
"Click the submit button"
```

### Explicit Commands (When You Need Precise Control)

Sometimes you need to be specific about exactly what to do:

```bash
# Use explicit commands for precise control:
navigate "https://staging.myapp.com/login"           # Go to exact URL
fill_form "https://myapp.com/contact" {"message": "Test"}  # Fill specific fields
click_button "Submit Order"                          # Click exact button text
assert_element "div.success" "visible"               # Check specific element
```

**Best Practice:** Start with natural language. If UI-Probe needs clarification or you need precise control, switch to explicit commands.

## Common Tasks

### Test a Login Form
```bash
# Natural language (recommended to start):
"Test if users can log in to myapp.com"
"Check the login flow"

# Explicit commands (for precise control):
navigate "https://myapp.com/login"
fill_form {"email": "test@example.com", "password": "password123"}
click_button "Sign In"
verify_page {"expectedContent": ["Dashboard", "Welcome"]}
```

### Test a Purchase
```bash
# Natural language:
"Buy a blue shirt from shop.com"
"Test the checkout process with a test credit card"

# Explicit commands:
navigate "https://shop.com"
click_button "Shirts"
click_button "Blue Cotton Tee"
click_button "Add to Cart"
fill_form {"card": "4111111111111111", "exp": "12/25", "cvv": "123"}
click_button "Complete Order"
```

### Test Form Validation
```bash
# Test what happens with bad data:
fill_form "https://myapp.com/signup" {"email": "not-an-email"}
# UI-Probe tells you: "❌ Email validation error appeared"
```

### Check if Something Exists
```bash
assert_element "https://myapp.com" "Free shipping" "visible"
# Returns: "✅ Found 'Free shipping' on page"
```

## What Makes UI-Probe Different

### Traditional Testing Tools
- Write code with specific selectors
- Tests break when UI changes
- Cryptic error messages
- Need programming knowledge
- Hundreds of lines of code

### UI-Probe
- Describe in plain English
- Self-healing when UI changes
- Clear, human-friendly errors
- No programming needed
- One line does it all

## Real-World Examples

### E-commerce Site
```bash
# Complete purchase flow
"Buy the cheapest laptop on the site"

# UI-Probe automatically:
# - Finds the shop
# - Searches for laptops
# - Sorts by price
# - Adds to cart
# - Fills checkout
# - Completes purchase
```

### SaaS Application
```bash
# Test free trial signup
"Sign up for a free trial with a company email"

# UI-Probe:
# - Navigates to signup
# - Detects it's a business form
# - Fills company fields
# - Uses appropriate test data
# - Verifies trial activated
```

### Banking App
```bash
# Test money transfer
"Transfer $50 from checking to savings"

# UI-Probe:
# - Logs in securely
# - Navigates to transfers
# - Fills amount
# - Selects accounts
# - Confirms transfer
```

## Built-in Test Playground

UI-Probe includes a comprehensive test playground to try before deploying to your project:

```bash
# Start the test server (runs on port 8081)
npm run test:server

# Visit http://localhost:8081/test in your browser to see the playground
```

### Available Test Pages:

- **Main Test Page** (`/test`) - Complete sign-up form with validation
- **Forms Testing** (`/test/forms`) - Every input type (text, select, radio, checkbox, etc.)
- **Navigation Testing** (`/test/navigation`) - Multi-page navigation and routing
- **Dynamic Content** (`/test/dynamic`) - JavaScript-driven UI updates
- **Validation Scenarios** (`/test/validation`) - Error handling and edge cases

### Test in Claude:

```bash
# Analyze form structure
analyze_ui "http://localhost:8081/test/forms"

# Fill and submit forms
fill_form "http://localhost:8081/test/forms" {"firstName": "John", "email": "john@example.com"}

# Run complete flows
run_flow(goal="Sign up as new user", url="http://localhost:8081/test")

## Configuration

### Basic (.env file)
```bash
# Make UI-Probe smarter
OPENAI_API_KEY=sk-...

# See the browser window
HEADLESS=false

# Show detailed logs
DEBUG=true
```

### Advanced Options
```bash
# Timeout for slow sites (milliseconds)
TIMEOUT=60000

# Retry failed operations
MAX_RETRIES=5

# Take screenshots on failure
SCREENSHOT_ON_FAILURE=true
```

## Troubleshooting

### "Failed to connect" or "Connection failed" in Claude Code CLI

**Problem:** Claude shows ui-probe as "failed" or can't connect when you run `claude mcp list`.

**Solution:** Claude Code CLI needs the full path to npx, not just "npx".

1. **Find your npx location:**
   ```bash
   which npx  # Mac/Linux
   where npx  # Windows
   ```

2. **Remove the broken configuration:**
   ```bash
   claude mcp remove ui-probe
   ```

3. **Add with the full path:**
   ```bash
   # Use YOUR actual path from step 1
   claude mcp add ui-probe "/path/from/step1/npx" "mcp-ui-probe@latest" "start"
   ```

4. **Start a new Claude Code session**
   ```bash
   claude  # The MCP server will now connect properly
   ```

**Common npx locations:**
- Standard Node.js: `/usr/local/bin/npx`
- NVM (Node Version Manager): `~/.nvm/versions/node/vXX.XX.X/bin/npx`
- Homebrew (Mac): `/opt/homebrew/bin/npx`
- Windows: `C:\Program Files\nodejs\npx.cmd`

### "Port already in use" when starting test server

**Solution:** Use a different port:
```bash
npx mcp-ui-probe test-server --port 3000
```

### "Navigation failed"
The site can't be reached. Check:
1. Is the URL correct?
2. Is the site running? (for localhost)
3. Run `npx playwright install` (if you haven't)

### "Element not found"
The button/form/link isn't there. Try:
1. `analyze_ui "URL"` to see what's on the page
2. `wait_for "URL" "element" "visible"` for slow-loading content
3. Be more specific: "the blue submit button" vs just "submit"

### Form won't fill
Custom form elements. Try:
1. `analyze_ui` to see what UI-Probe detects
2. Use `click` for custom dropdowns
3. Use `run_flow` for complex interactions

## Smart Features

### Automatic Test Data
UI-Probe generates appropriate test data:
- Valid emails that pass validation
- Strong passwords that meet requirements
- Phone numbers in the right format
- Realistic names and addresses
- Test credit cards (4111111111111111)

### Self-Healing Tests
When developers change:
- Class names → UI-Probe still finds the button
- IDs → Still works
- Page structure → Adapts automatically
- Text labels → Understands context

### Clear Error Messages
```
❌ Traditional: "WebDriverException: unknown error: Element is not clickable at point (780, 532)"

✅ UI-Probe: "The submit button is hidden behind a cookie consent banner. Try dismissing the banner first."
```

## API Reference

| Command | What it does | Example |
|---------|--------------|---------|
| `navigate` | Go to a page | `navigate "https://site.com"` |
| `analyze_ui` | See what's on the page | `analyze_ui "https://site.com"` |
| `fill_form` | Fill out a form | `fill_form "URL" {"field": "value"}` |
| `run_flow` | Do multiple steps | `run_flow "Sign up and verify email"` |
| `click` | Click something | `click "URL" "button text"` |
| `assert_element` | Check if something exists | `assert_element "URL" "text" "visible"` |
| `wait_for` | Wait for something | `wait_for "URL" "Loading..." "hidden"` |

## Comparison with playwright-mcp

### Quick Summary

**UI-Probe** and **playwright-mcp** are complementary tools, not competitors:

- **playwright-mcp**: Low-level infrastructure tool providing primitive browser commands for AI agents
- **UI-Probe**: High-level testing application with plain English interface for end users

### Key Differences

| Aspect | playwright-mcp | UI-Probe |
|--------|---------------|----------|
| **Target User** | Developers building AI agents | Non-technical users (PMs, designers, QA) |
| **Interface** | Element-based (`browser_click`, `browser_type`) | Intent-based (`run_flow "Sign up"`) |
| **Self-Healing** | No - breaks if DOM changes | Yes - uses AI to adapt to changes |
| **Test Data** | User must provide | Auto-generates valid data |
| **Setup** | Single npx command | Clone repo + npm install |
| **Code Required** | Yes - Claude writes test scripts | No - works immediately |
| **Response Format** | Raw browser events | Structured JSON for automation |

### Critical Advantage: No Code Generation Required

With **playwright-mcp**, Claude must write and execute test code:
```javascript
// Claude has to generate this for every test
await page.goto('http://example.com');
await page.fill('#email', 'test@example.com');
await page.click('button[type="submit"]');
// Error handling, retries, validation...
```

With **UI-Probe**, just describe what you want:
```bash
"Test the login form"
# That's it - no code generation needed
```

### Deterministic JSON for Automation

Every UI-Probe action returns predictable JSON that enables conditional logic:

```javascript
// UI-Probe response - always structured the same way
{
  "success": true,
  "data": {
    "formSubmitted": true,
    "validationErrors": [],
    "nextUrl": "/dashboard"
  }
}

// This enables intelligent automation:
if (!response.success) {
  // Handle failure automatically
  useAlternativeFlow();
}
```

### The Bottom Line

- Use **playwright-mcp** if you're a developer building an AI agent that needs browser control
- Use **UI-Probe** if you want to test websites without writing code

Think of playwright-mcp as the engine and UI-Probe as the user-friendly car built around it.

**→ For detailed comparison, see [docs/comparison.md](docs/comparison.md)**

## Contributing

We love contributions! See [CONTRIBUTING.md](docs/CONTRIBUTING.md).

## Support

- **Docs:** [Full documentation](docs/)
- **Examples:** [More examples](examples/)
- **Issues:** [Report problems](https://github.com/yourusername/mcp-ui-probe/issues)
- **Discussions:** [Ask questions](https://github.com/yourusername/mcp-ui-probe/discussions)

## License

MIT - Use it however you want!

---

**Stop writing code that breaks. Start testing like a human.**

Ready? [Install now](#quick-start-5-minutes) or [see examples](#common-tasks)