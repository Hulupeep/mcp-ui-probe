# Quick Start Guide

Get UI-Probe running with Claude Desktop in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))
- Claude Desktop installed

## Step 1: Install Playwright Browsers

```bash
# One-time setup (downloads ~470MB)
npx playwright install chromium
```

## Step 2: Configure Claude Desktop

### macOS
```bash
# Open Claude config
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### Linux
```bash
# Open Claude config (adjust path if needed)
code ~/.config/Claude/claude_desktop_config.json
```

### Windows
```powershell
# Open Claude config
notepad %APPDATA%\Claude\claude_desktop_config.json
```

### Add This Configuration

```json
{
  "mcpServers": {
    "ui-probe": {
      "command": "npx",
      "args": ["-y", "mcp-ui-probe@latest", "start"],
      "env": {
        "OPENAI_API_KEY": "sk-your-openai-key-here",
        "UI_PROBE_FALLBACK_MODE": "false"
      }
    }
  }
}
```

**Replace** `sk-your-openai-key-here` with your actual OpenAI API key.

## Step 3: Restart Claude Desktop

Completely quit and relaunch Claude Desktop:

```bash
# macOS: Cmd+Q then reopen
# Linux: Close window then reopen
# Windows: File > Exit then reopen
```

## Step 4: Verify It Works

In Claude Desktop, type:

```
Navigate to https://example.com and tell me what you see
```

Claude should use the UI-Probe tools to navigate and analyze the page.

## What You Can Do Now

### Navigate to websites
```
Go to https://github.com and check if it's loading correctly
```

### Test forms
```
Navigate to https://example.com/signup and analyze the signup form
```

### Click buttons
```
Go to https://example.com and click the "Get Started" button
```

### Run complete flows
```
Navigate to https://example.com/login and test the login form with test credentials
```

## Troubleshooting

### "No MCP tools available"

1. Check your `claude_desktop_config.json` syntax (use [JSONLint](https://jsonlint.com/))
2. Verify OpenAI API key is valid
3. Completely restart Claude Desktop (not just close the window)

### "Request timed out" errors

See [TIMEOUT_FIXES.md](./TIMEOUT_FIXES.md) for solutions. The latest version includes:
- Automatic retry with exponential backoff
- 60-second timeouts on API calls
- Graceful fallback to basic mode

### "Browser launch failed"

```bash
# Install Playwright browsers
npx playwright install chromium
```

### Test the server manually

```bash
# This should start without errors
npx mcp-ui-probe start

# You should see:
# 🚀 Starting MCP UI Probe server...
# ✅ LLM available (OPENAI) - all features enabled
```

## Two Different Servers

**MCP Server** (for Claude Desktop):
```bash
npx mcp-ui-probe start
```
- Used by Claude Desktop via MCP protocol
- Configured in `claude_desktop_config.json`
- STDIO-based, not HTTP

**Test Server** (for development):
```bash
npx mcp-ui-probe test-server --port 8081
```
- Built-in test pages at http://localhost:8081
- Separate from MCP server
- For manual testing only

## Cost Management

UI-Probe uses OpenAI's GPT-4 for intelligent features. Set cost limits:

```json
{
  "env": {
    "OPENAI_API_KEY": "sk-...",
    "UI_PROBE_MAX_COST": "50",
    "UI_PROBE_WARN_COST": "10"
  }
}
```

Check your usage:
```
Show me UI-Probe usage statistics
```

## Next Steps

- Read [MCP_CLIENT_SETUP.md](./MCP_CLIENT_SETUP.md) for advanced configuration
- See [TIMEOUT_FIXES.md](./TIMEOUT_FIXES.md) for timeout troubleshooting
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues

## Example Use Cases

### Test a signup flow
```
User: Navigate to https://example.com/signup and test the signup form with a random email

Claude will:
1. Navigate to the page
2. Analyze the form structure
3. Generate test data
4. Fill out the form
5. Submit it
6. Report the results
```

### Check for broken links
```
User: Go to https://example.com and check if the "Contact" link works

Claude will:
1. Navigate to the homepage
2. Find the Contact link
3. Click it
4. Verify the destination page loaded
```

### Screenshot and analyze
```
User: Navigate to https://example.com and describe what you see

Claude will:
1. Navigate to the page
2. Analyze the UI structure
3. Describe forms, buttons, and content
```

That's it! You're ready to use UI-Probe with Claude Desktop.
