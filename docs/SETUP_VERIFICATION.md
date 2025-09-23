# Setup Verification Guide

## Verifying Your Installation

After running `npm install`, `npm run build`, and `npx playwright install`, here's how to verify everything is working:

### 1. Check Build Output

After `npm run build`, you should see a `dist/` directory created:

```bash
ls -la dist/
# Should show:
# - index.js (main server file)
# - server/ (server components)
# - drivers/ (browser drivers)
# - monitoring/ (monitoring components)
```

### 2. Start the MCP Server

```bash
npm start

# You should see:
# info: Starting MCP UI Probe server...
# info: MCP UI Probe server started
```

This means the MCP server is running and ready to accept commands via stdio.

### 3. Using with Claude Code CLI

The MCP server communicates through stdio (standard input/output), which is how Claude Code CLI will interact with it.

To use it with Claude Code:

1. **Configure Claude Code** (create `.claude/mcp_settings.json`):
```json
{
  "servers": {
    "ui-tester": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-ui-probe/dist/index.js"]
    }
  }
}
```

2. **Test with Claude Code CLI**:
```bash
# Remember: ALWAYS provide the URL
claude "Test if the search works on https://example.com"
```

### 4. Optional: Monitoring Dashboard

If port 3001 is available, you can run the monitoring dashboard:

```bash
# Run monitoring on a different port if 3001 is in use
MONITORING_PORT=3005 npm run monitoring

# Or if port 3001 is free:
npm run monitoring
```

Then visit `http://localhost:3005` (or your chosen port) in your browser.

### 5. Troubleshooting

#### Server won't start
- Check Node.js version: `node --version` (should be 18+)
- Check if `dist/` directory exists after build
- Look for error messages in the console

#### "Navigation failed" or "Browser not found"
- Run `npx playwright install` to download browsers
- Check browsers installed: `ls ~/.cache/ms-playwright/`
- Run `sudo npx playwright install-deps` for system libraries

#### Can't connect from Claude Code
- Make sure the path in `mcp_settings.json` is absolute, not relative
- Verify the server starts without errors
- Check that `dist/index.js` exists

#### Monitoring dashboard issues
- If port 3001 is in use, try a different port: `MONITORING_PORT=3006 npm run monitoring`
- The monitoring dashboard is optional - the MCP server works without it

## What "Nothing Happened" Means

When you run the setup commands and see no errors, that's SUCCESS!

- `npm install` - Downloaded dependencies (no output = success)
- `npm run build` - Compiled TypeScript to JavaScript (no output = success)
- `npx playwright install` - Downloaded browser binaries (~470MB total)
- `sudo npx playwright install-deps` - Installed system dependencies
- `npm start` - Starts the MCP server (waits for commands)

⚠️ **Critical**: If you skip `npx playwright install`, the server will start but ALL tests will fail with "Navigation failed" errors!

The server is now ready and waiting for Claude Code to send it test commands!