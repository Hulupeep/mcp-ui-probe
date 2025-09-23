# MCP UI Probe - Test Any Website Like a Human Would 🤖

**Stop writing code to test websites. Just tell the AI what to do in plain English.**

🎉 **NEW: AI-Powered Testing with GPT-4/Claude** - Add your OpenAI or Anthropic API key for intelligent test understanding! See [LLM Integration Guide](docs/LLM-INTEGRATION.md) for details.

## What Is This? (In Simple Terms)

MCP UI Probe is a tool that lets you test websites by describing what you want to do AND where to do it:
- *"Sign up for an account **on https://myapp.com/register**"*
- *"Buy a product **at https://shop.com**"*
- *"Fill out the contact form **on https://example.com/contact**"*

**KEY POINT**: You MUST always provide the URL - the AI doesn't guess which website to test!

Instead of writing complicated test code with specific button IDs and form names, you tell it what a human would do and WHERE to do it.

## 🚨 Critical: How It Works

**The AI needs TWO things from you:**
1. **WHAT to test** - "sign up", "buy product", "fill form"
2. **WHERE to test it** - The complete URL like "https://mysite.com/signup"

```bash
# ✅ CORRECT - Includes action AND location
claude "Test signup on https://myapp.com/register"

# ❌ WRONG - Missing the URL
claude "Test signup"  # AI responds: "Where? What URL?"
```

**The AI does NOT guess URLs!** You must always tell it exactly where to go.

## Who Is This For?

- **Developers** tired of fixing broken tests every time the UI changes
- **QA Teams** who want to test like real users, not like robots
- **Product Managers** who want to verify features work without writing code
- **Anyone** who needs to test websites automatically

## Requirements

✅ **What You Need:**
- Node.js 18 or higher ([Download here](https://nodejs.org))
- A website to test (must be running and accessible via URL)
- Playwright browsers installed (automatic during setup)
- System dependencies for browsers (installed with sudo)
- 5 minutes to set up

❌ **What You DON'T Need:**
- Knowledge of CSS selectors
- Programming experience for basic tests
- Understanding of test frameworks

## Installation - Step by Step

### 1️⃣ Install MCP UI Probe

**IMPORTANT**: This is NOT on npm yet. You must clone from GitHub.

```bash
# Clone the repository (do this OUTSIDE your project folder)
cd ~  # or wherever you keep tools
git clone https://github.com/Hulupeep/mcp-ui-probe.git
cd mcp-ui-probe

# Install dependencies and build
npm install
npm run build

# CRITICAL: Install Playwright browsers (required for UI testing!)
npx playwright install

# Install system dependencies (requires sudo)
sudo apt-get install libgstreamer-plugins-bad1.0-0 libavif16
# OR use Playwright's installer:
sudo npx playwright install-deps
```

**DO NOT** run `npm init` in your existing project - that will mess up your package.json!

### 2️⃣ Start the Testing Server

```bash
# Start the MCP server
npm start

# You should see:
# ✅ MCP UI Testing Server started
```

### 3️⃣ Verify It's Working

Open a new terminal and run the health check:

```bash
# Check if server is running
curl http://localhost:3000/health

# Should return:
# {"status": "healthy", "version": "0.1.0"}
```

The MCP server is now ready to receive test commands.

## How to Use It - Real Examples

### With Claude Code CLI (Primary Method)

**IMPORTANT**: You must ALWAYS provide the URL. The AI doesn't guess where to test!

```bash
# ✅ CORRECT - Always include the full URL
claude "Test if users can sign up on https://example.com/signup"
claude "Check if login works at http://localhost:3000/login"
claude "Verify checkout on https://shop.com/cart"

# ❌ WRONG - Missing URL (AI doesn't know where to go!)
claude "Test signup"  # Where? No URL provided!
claude "Check login"  # What site? Missing URL!
```

**Real Example with Claude Code CLI:**
```bash
You: Test if users can sign up on https://myapp.com/register

Claude: I'll test the signup flow on https://myapp.com/register.
[Navigates to exact URL provided]
[Finds signup form]
[Fills with test data]
[Submits and verifies]

Result: ✅ Successfully created account
- Found signup form at /register
- Filled email: test1234@example.com
- Generated secure password: SecurePass123!
- Submitted form
- Account created successfully
```

### With Code (For Developers)

```javascript
// simple-test.js
const { MCPClient } = require('mcp-ui-probe/client');

async function testMyWebsite() {
  // Connect to the testing server
  const tester = new MCPClient('http://localhost:3000');

  // Test in plain English
  const result = await tester.test({
    goal: "Sign up for a new account",
    url: "https://myapp.com/signup"
  });

  // Check if it worked
  if (result.success) {
    console.log("✅ Test passed!");
  } else {
    console.log("❌ Test failed:", result.errors);
  }
}

testMyWebsite();
```

Run it:
```bash
node simple-test.js
```

## Real-World Examples

### Example 1: Test E-Commerce Purchase

```bash
# With Claude Code CLI - MUST include URL!
claude "Buy a blue t-shirt in size medium at https://shop.example.com"

# It automatically:
# 1. Goes to https://shop.example.com
# 2. Finds products → navigates to t-shirts
# 3. Selects "blue" color and "medium" size
# 4. Adds to cart
# 5. Goes to checkout
# 6. Fills in test payment details
# 7. Completes the purchase
```

### Example 2: Test Form Validation

```bash
# Always specify WHERE to test
claude "Make sure the signup form validates email addresses on https://app.example.com/register"

# It automatically:
# 1. Navigates to https://app.example.com/register
# 2. Tries invalid emails (no @, wrong format)
# 3. Checks error messages appear
# 4. Tries valid email
# 5. Verifies form accepts it
```

### Example 3: Test Multi-Step Process

```bash
# Provide the starting URL
claude "Complete the job application process starting at https://careers.example.com/apply"

# It automatically handles:
# 1. Navigating to the application page
# 2. Personal information form
# 3. Resume upload (uses test file)
# 4. Question responses
# 5. Review and submit
```

## Quick Start Examples

### 📝 Test a Contact Form

Create a file `test-contact.js`:

```javascript
const { testWebsite } = require('mcp-ui-probe');

testWebsite({
  goal: "Send a message through the contact form",
  url: "https://yoursite.com/contact",
  data: {
    message: "This is a test message"
  }
}).then(result => {
  console.log(result.success ? "✅ Sent!" : "❌ Failed!");
});
```

### 🛒 Test Checkout Flow

```javascript
testWebsite({
  goal: "Complete checkout as a guest",
  url: "https://shop.com/cart",
  constraints: {
    userType: "guest",
    paymentMethod: "credit_card",
    shipping: "express"
  }
});
```

### 👤 Test User Registration

```javascript
testWebsite({
  goal: "Register a new user account",
  url: "https://app.com/signup",
  expectation: "Should receive welcome email"
});
```

## How It Works (Simple Explanation)

```mermaid
graph LR
    A[You: "Sign up for account"] --> B[AI Looks at Page]
    B --> C[Finds Signup Form]
    C --> D[Figures Out Fields]
    D --> E[Fills With Test Data]
    E --> F[Submits & Checks Result]
    F --> G[Reports Success/Failure]
```

1. **You say what to do** → "Create an account"
2. **AI examines the page** → Finds forms, buttons, fields
3. **Understands the UI** → "This is an email field, this is password"
4. **Generates smart test data** → Valid emails, strong passwords
5. **Executes the test** → Fills forms, clicks buttons
6. **Reports results** → Success or failure with details

## Common Questions

### ❓ What kinds of websites can I test?

Any website that:
- ✅ Is accessible via URL (http://... or https://...)
- ✅ Has forms, buttons, or interactive elements
- ✅ Works in a browser

Including:
- Local development (http://localhost:3000)
- Staging environments
- Production websites
- Password-protected sites (with credentials)

### ❓ Do I need to write selectors like `#submit-btn`?

**No!** That's the whole point. Instead of:
```javascript
// ❌ Old way - breaks when UI changes
await page.click('#submit-btn-2');
await page.fill('input[name="email"]', 'test@example.com');
```

You just say:
```javascript
// ✅ New way - works even when UI changes
"Sign up with email test@example.com"
```

### ❓ What test data does it use?

It generates realistic test data automatically:
- **Emails**: `test1234@example.com`
- **Names**: `John Smith`, `Jane Doe`
- **Phones**: Valid format for detected country
- **Addresses**: Real-looking addresses
- **Credit Cards**: Test card numbers (4111111111111111)

### ❓ Can I see what it's doing?

Yes! Open `http://localhost:3001` while tests run to see:
- Live step-by-step execution
- Screenshots of each action
- Timing and performance data
- Any errors encountered

## Troubleshooting

### 🔧 Server won't start

```bash
# Check if port 3000 is in use
lsof -i :3000  # Mac/Linux
netstat -an | findstr :3000  # Windows

# Use a different port
MCP_PORT=3005 npm start
```

### 🔧 Can't connect to website

```bash
# Make sure your website is running
curl https://your-website.com

# For local sites, use the right URL
# ✅ Correct: http://localhost:3000
# ❌ Wrong: localhost:3000
# ❌ Wrong: www.localhost:3000
```

### 🔧 Test can't find forms

```javascript
// Be more specific about your goal
await tester.test({
  goal: "Fill out the newsletter signup form in the footer",  // More specific
  url: "https://site.com",
  hints: {
    formLocation: "footer",
    formType: "newsletter"
  }
});
```

## What Makes This Different?

| Traditional Testing | MCP UI Probe |
|-------------------|--------------|
| Write code with exact selectors | Describe in plain English |
| Breaks when UI changes | Self-heals when UI changes |
| Need to know HTML/CSS | Works like a human would |
| Maintain hundreds of test files | One simple goal statement |
| Hours to write tests | Minutes to describe goals |

## Getting Help

### 📚 Documentation
- [Complete Usage Guide](docs/USAGE_GUIDE.md) - Detailed instructions
- [API Reference](docs/API_REFERENCE.md) - All available commands
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues
- [Examples](examples/) - Ready-to-run test examples

### 💬 Support
- GitHub Issues: [Report problems](https://github.com/Hulupeep/mcp-ui-probe/issues)
- Discord: [Join our community](https://discord.gg/mcp-ui-probe)
- Email: support@example.com

## Try It Right Now!

1. **Start the server** (if not already running):
```bash
npm start
```

2. **Create a test file** `quick-test.js`:
```javascript
const { quickTest } = require('mcp-ui-probe');

quickTest("Sign up on google.com");
// (This will try to find and fill a signup form on Google)
```

3. **Run it**:
```bash
node quick-test.js
```

4. **Watch the magic happen** 🎉

---

**Stop writing brittle test code. Start testing like a human.** 🚀

Ready to save hours every week? [Get started now](#installation---step-by-step) or [see more examples](examples/).