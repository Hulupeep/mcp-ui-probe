# UI-Probe: Test Any Website in Plain English

## The Problem

Website testing is broken. You write hundreds of lines of code that breaks the moment a developer changes a button class from `btn-primary` to `button-primary`. Your tests fail not because the app is broken, but because someone moved a div or renamed an ID.

## The Solution

UI-Probe lets you test websites by describing what you want to do in plain English. No code. No selectors. Just describe it like you'd tell a human.

```bash
# Instead of this nightmare:
await driver.findElement(By.xpath("//div[@id='login-form']//input[@name='email']")).sendKeys("test@example.com");
await driver.findElement(By.css(".btn-submit.primary")).click();

# Just say this:
run_flow "Sign up for an account"
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

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org) - just click "Next" through installer)
- Claude Code CLI or any terminal

### Step 1: Install UI-Probe

```bash
# Clone it (this downloads the code)
git clone https://github.com/yourusername/mcp-ui-probe.git
cd mcp-ui-probe

# Install it (this sets everything up)
npm install

# CRITICAL: Install browsers (one-time, takes 2-3 minutes)
npx playwright install
```

### Step 2: Add to Claude

```bash
# Tell Claude about UI-Probe
claude mcp add ui-probe "node" "/path/to/mcp-ui-probe/dist/index.js"

# Restart Claude to load it
```

### Step 3: Enable AI (Optional but Recommended)

```bash
# In the mcp-ui-probe folder
echo "OPENAI_API_KEY=your-key-here" > .env
```

This makes UI-Probe smarter at understanding your commands.

### Step 4: Test Something!

```bash
# In Claude, just describe what you want:
"Test if users can sign up on example.com"

# Or be specific:
run_flow "Go to https://example.com/signup and create an account"
```

## How URLs Work in Claude

Claude is smart about URLs:

```bash
# Natural language - Claude figures it out:
"Test the login on my homepage"
"Check if the contact form works"
"Sign up for a new account"

# Explicit - when you need a specific URL:
navigate "https://staging.myapp.com/login"
fill_form "https://myapp.com/contact" {"message": "Hi!"}
```

**Tip:** Start natural. If Claude asks "What URL?", then be specific.

## Common Tasks

### Test a Login Form
```bash
# Natural way:
"Test if users can log in"

# Explicit way:
run_flow "Go to https://myapp.com/login, enter test@example.com and password123, click login"
```

### Test a Purchase
```bash
# Natural:
"Buy a blue shirt from the shop"

# Explicit:
run_flow "Go to https://shop.com, search for blue shirt, add first result to cart, checkout with test card 4111111111111111"
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

## Built-in Test Pages

UI-Probe includes test pages to try:

```bash
# Start test server
npm run test:server

# Then test it:
analyze_ui "http://localhost:8080/test/forms"
fill_form "http://localhost:8080/test/forms" {"name": "Test User"}
```

Test pages include:
- Forms with every input type
- Dynamic JavaScript content
- Validation scenarios
- Navigation examples

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