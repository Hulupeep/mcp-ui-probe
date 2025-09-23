# Getting Started with MCP UI Probe

## For Claude Desktop Users

### What You'll Be Able to Do

Once set up, you can ask Claude things like:
- "Test if users can sign up on my website"
- "Check if the checkout process works"
- "Verify the contact form sends messages"
- "Make sure form validation is working"

And Claude will automatically run the tests and report back!

### Step 1: Prerequisites

Before starting, make sure you have:

1. **Node.js installed** (version 18 or higher)
   - Check by typing `node --version` in your terminal
   - If not installed, download from [nodejs.org](https://nodejs.org)

2. **Claude Desktop with MCP support**
   - Make sure you have the latest version

3. **A website to test**
   - Can be local (http://localhost:3000)
   - Or remote (https://yoursite.com)

### Step 2: Install MCP UI Probe

#### Option A: Quick Install (Recommended)

```bash
# Open Terminal (Mac) or Command Prompt (Windows)
# Run this command:
npx create-mcp-ui-probe

# Follow the prompts:
# - Installation directory: ./mcp-ui-probe
# - Auto-start server: Yes
# - Install examples: Yes
```

#### Option B: Manual Install

```bash
# 1. Create a directory
mkdir mcp-ui-probe
cd mcp-ui-probe

# 2. Clone the repository
git clone https://github.com/Hulupeep/mcp-ui-probe.git .

# 3. Install dependencies
npm install

# 4. Build the project
npm run build
```

### Step 3: Start the Testing Server

```bash
# In the mcp-ui-probe directory, run:
npm start

# You should see:
# ✅ MCP UI Testing Server started on port 3000
# ✅ Monitoring dashboard available at http://localhost:3001
# ✅ Health check passed
# 📊 Waiting for test requests...
```

**Keep this terminal open!** The server needs to stay running.

### Step 4: Configure Claude Desktop

1. **Find Claude's configuration file:**
   - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Add the MCP UI Probe server:**

```json
{
  "mcpServers": {
    "ui-tester": {
      "command": "node",
      "args": ["/path/to/mcp-ui-probe/dist/index.js"],
      "env": {
        "MCP_PORT": "3000",
        "MONITORING_PORT": "3001"
      }
    }
  }
}
```

Or use the automatic configuration:

```bash
# Run this command in the mcp-ui-probe directory
npm run configure-claude
```

3. **Restart Claude Desktop** for changes to take effect

### Step 5: Verify Everything Works

1. **Check the server is running:**
   Open your browser and go to: `http://localhost:3001`
   You should see the monitoring dashboard.

2. **In Claude, type:**
   ```
   Can you test if example.com is working?
   ```

   Claude should respond with something like:
   ```
   I'll test example.com for you. Let me check if the site is accessible and functioning.

   [Running test...]

   ✅ Test Results:
   - Site is accessible
   - Homepage loads successfully
   - Found 2 forms (search, newsletter signup)
   - No JavaScript errors detected
   - Page load time: 1.2 seconds
   ```

### Step 6: Your First Real Test

Now try testing your own website:

```
You: Can you test if users can sign up on my site at localhost:3000?

Claude: I'll test the signup functionality on your local site. Let me run a comprehensive test.

[Executes test]

✅ Signup Test Results:
- Found signup form at /register
- Successfully filled all required fields:
  • Email: test1234@example.com
  • Password: SecurePass123!
  • Name: John Doe
- Form submitted successfully
- Confirmation message displayed: "Account created"
- No validation errors
- Total time: 2.3 seconds

The signup process is working correctly!
```

## For Developers Using Code

### Quick Example

Create a file `test.js`:

```javascript
// Load the MCP client
const { MCPUIProbe } = require('mcp-ui-probe');

// Initialize the tester
const tester = new MCPUIProbe({
  serverUrl: 'http://localhost:3000',
  verbose: true  // See what's happening
});

// Run a test
async function runTest() {
  const result = await tester.test({
    goal: "Sign up for an account",
    url: "https://myapp.com/signup"
  });

  if (result.success) {
    console.log("✅ Test passed!");
    console.log(`Account created: ${result.data.email}`);
  } else {
    console.log("❌ Test failed:");
    console.log(result.errors);
  }
}

runTest();
```

Run it:
```bash
node test.js
```

### Understanding the Response

When you run a test, you get back detailed information:

```javascript
{
  "success": true,
  "runId": "test-12345",
  "url": "https://example.com/signup",
  "goal": "Sign up for an account",
  "steps": [
    {
      "action": "navigate",
      "target": "https://example.com/signup",
      "result": "success",
      "duration": 523
    },
    {
      "action": "fill",
      "field": "email",
      "value": "test1234@example.com",
      "result": "success"
    },
    {
      "action": "fill",
      "field": "password",
      "value": "SecurePass123!",
      "result": "success"
    },
    {
      "action": "click",
      "button": "Sign Up",
      "result": "success"
    },
    {
      "action": "verify",
      "expected": "Account created",
      "found": true,
      "result": "success"
    }
  ],
  "errors": [],
  "screenshots": [
    "http://localhost:3001/screenshots/test-12345-final.png"
  ],
  "duration": 3421
}
```

## Common First-Time Issues

### Issue: "Cannot connect to server"

**Solution:**
1. Make sure the server is running (`npm start`)
2. Check the port isn't blocked by firewall
3. Try `http://127.0.0.1:3000` instead of `localhost`

### Issue: "No forms found on page"

**Solution:**
```javascript
// Be more specific with hints
await tester.test({
  goal: "Sign up for account",
  url: "https://site.com",
  hints: {
    buttonText: "Get Started",  // Help it find the right button
    formLocation: "modal"       // Tell it where to look
  }
});
```

### Issue: "Test runs but nothing happens"

**Solution:**
1. Open the monitoring dashboard: `http://localhost:3001`
2. Watch the live execution to see what's happening
3. Check the logs for any errors

## Next Steps

### 1. Try Different Tests

```javascript
// Test form validation
await tester.test({
  goal: "Make sure email validation works",
  url: "https://mysite.com/signup"
});

// Test a purchase flow
await tester.test({
  goal: "Buy the cheapest item in the store",
  url: "https://shop.com"
});

// Test search functionality
await tester.test({
  goal: "Search for 'blue shoes' and check results appear",
  url: "https://store.com"
});
```

### 2. Explore Advanced Features

- **Visual Testing**: Compare screenshots over time
- **Performance Testing**: Monitor page load times
- **Accessibility Testing**: Check ARIA compliance
- **Cross-browser Testing**: Run on different browsers

### 3. Integrate with CI/CD

Add to your GitHub Actions:

```yaml
- name: UI Tests
  run: |
    npm start &
    sleep 5
    npm run test:e2e
```

## Getting Help

- **Dashboard**: Always check `http://localhost:3001` first
- **Logs**: Look in `logs/mcp-ui-probe.log`
- **Debug Mode**: Set `DEBUG=mcp:*` environment variable
- **Community**: Join our Discord for help

## Video Tutorials

- [5-Minute Setup](https://youtube.com/watch?v=xxx)
- [Testing Your First Form](https://youtube.com/watch?v=yyy)
- [Understanding AI Decisions](https://youtube.com/watch?v=zzz)

---

**Ready to start?** Go back to [Step 2](#step-2-install-mcp-ui-probe) and begin your installation!