# MCP Client Setup Guide

This guide shows how to connect MCP clients (Claude Desktop, etc.) to the UI-Probe MCP server.

## Critical: Server vs Test Environment

UI-Probe has **two separate servers**:

### 1. MCP Server (for Claude Desktop and MCP clients)
```bash
npx mcp-ui-probe start
```
- **Purpose**: Exposes MCP tools for Claude Desktop and other clients
- **Protocol**: STDIO-based MCP protocol
- **Access**: Via MCP client configuration
- **DO NOT** run this in a browser - it's for MCP clients only

### 2. Test/Playground Server (for browser testing)
```bash
npx mcp-ui-probe test-server --port 8081
```
- **Purpose**: Built-in test pages for development/testing
- **Protocol**: HTTP server
- **Access**: `http://localhost:8081`
- **Separate** from MCP server

## Claude Desktop Integration

### macOS Setup

1. **Locate your Claude Desktop config file**:
```bash
code ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

2. **Add UI-Probe MCP server**:
```json
{
  "mcpServers": {
    "ui-probe": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-ui-probe@latest",
        "start"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-your-openai-key-here",
        "UI_PROBE_FALLBACK_MODE": "false",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

3. **Restart Claude Desktop** completely:
```bash
# Quit Claude Desktop completely
# Then relaunch it
```

4. **Verify connection** in Claude Desktop:
   - Look for the 🔌 icon indicating MCP tools are available
   - Type: "What MCP tools do you have access to?"
   - You should see UI-Probe tools listed

### Linux Setup

1. **Locate your Claude Desktop config**:
```bash
# Location varies by installation method
# Common locations:
~/.config/Claude/claude_desktop_config.json
~/.config/claude-desktop/config.json
```

2. **Use the same configuration** as macOS (above)

3. **Ensure npx is in PATH**:
```bash
which npx
# Should show: /usr/bin/npx or similar
```

### Windows Setup

1. **Locate your Claude Desktop config**:
```bash
%APPDATA%\Claude\claude_desktop_config.json
```

2. **Add UI-Probe with Windows paths**:
```json
{
  "mcpServers": {
    "ui-probe": {
      "command": "npx.cmd",
      "args": [
        "-y",
        "mcp-ui-probe@latest",
        "start"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-your-openai-key-here",
        "UI_PROBE_FALLBACK_MODE": "false",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## Verification Steps

### 1. Test npx Command Directly

Before configuring Claude Desktop, verify the server starts:

```bash
# Start MCP server manually
npx mcp-ui-probe start

# You should see:
# 🚀 Starting MCP UI Probe server...
# ✅ LLM available (OPENAI) - all features enabled
# MCP UI Probe server started
```

**Troubleshooting if it fails**:
- Check Node.js version: `node --version` (requires 18+)
- Check npx works: `npx --version`
- Verify OpenAI key: `echo $OPENAI_API_KEY`

### 2. Check Claude Desktop Logs

When Claude Desktop starts with MCP server configured:

**macOS**:
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

**Linux**:
```bash
tail -f ~/.local/share/Claude/logs/mcp*.log
```

**Windows**:
```powershell
Get-Content "$env:APPDATA\Claude\logs\mcp*.log" -Wait -Tail 50
```

Look for:
- `[ui-probe] Server started successfully`
- `[ui-probe] Tools registered: 25`
- Any error messages about API keys or dependencies

### 3. Test in Claude Desktop

Once configured, test in Claude:

```
User: "Use UI-Probe to navigate to https://example.com"

Claude should respond with tool usage showing:
- mcp__ui-probe__navigate being called
- Success/failure result
```

**If Claude doesn't see the tools**:
1. Completely quit and restart Claude Desktop
2. Check the MCP logs for errors
3. Verify your config JSON is valid (use https://jsonlint.com/)
4. Try the manual verification steps below

## Advanced Configuration

### Environment Variables

You can configure UI-Probe behavior through environment variables:

```json
{
  "mcpServers": {
    "ui-probe": {
      "command": "npx",
      "args": ["-y", "mcp-ui-probe@latest", "start"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "UI_PROBE_FALLBACK_MODE": "false",

        "LLM_REQUEST_TIMEOUT": "60000",
        "LLM_MAX_RETRIES": "2",

        "LOG_LEVEL": "debug",
        "HEADLESS": "true",
        "BROWSER_TYPE": "chromium",

        "NAVIGATION_TIMEOUT": "30000",
        "ELEMENT_TIMEOUT": "5000",

        "UI_PROBE_COST_LIMITS": "true",
        "UI_PROBE_WARN_COST": "10",
        "UI_PROBE_MAX_COST": "100"
      }
    }
  }
}
```

### Multiple API Keys

If you have both OpenAI and Anthropic keys:

```json
{
  "env": {
    "OPENAI_API_KEY": "sk-...",
    "ANTHROPIC_API_KEY": "sk-ant-...",
    "LLM_PROVIDER": "openai"
  }
}
```

### Development Mode

For debugging with verbose logging:

```json
{
  "env": {
    "LOG_LEVEL": "debug",
    "UI_PROBE_DEBUG": "true",
    "HEADLESS": "false"
  }
}
```

## Other MCP Clients

### Cline/Continue VSCode Extension

1. **Install the extension** in VSCode

2. **Configure MCP server** in settings:
```json
{
  "mcp.servers": {
    "ui-probe": {
      "command": "npx",
      "args": ["-y", "mcp-ui-probe@latest", "start"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Custom MCP Client

If building your own MCP client:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

// Spawn UI-Probe MCP server
const serverProcess = spawn('npx', ['mcp-ui-probe', 'start'], {
  env: {
    ...process.env,
    OPENAI_API_KEY: 'sk-...'
  }
});

// Connect MCP client
const transport = new StdioClientTransport({
  command: serverProcess
});

const client = new Client({
  name: 'my-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);

// List available tools
const tools = await client.listTools();
console.log('Available tools:', tools);

// Call a tool
const result = await client.callTool({
  name: 'navigate',
  arguments: {
    url: 'https://example.com'
  }
});
```

## Troubleshooting MCP Connection

### Issue: "MCP server not starting"

**Symptoms**:
- Claude Desktop doesn't show MCP tools
- Logs show connection errors
- Server process terminates immediately

**Solutions**:

1. **Check Playwright installation**:
```bash
npx playwright install chromium
```

2. **Verify API key is valid**:
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-your-key"
```

3. **Test server manually**:
```bash
# Start server with debug logging
LOG_LEVEL=debug npx mcp-ui-probe start
```

4. **Check for port conflicts**:
```bash
# UI-Probe uses STDIO, not ports, but test server uses 8081
lsof -i :8081
```

### Issue: "Tools visible but timing out"

**Symptoms**:
- Claude sees UI-Probe tools
- Tool calls return "Request timed out" (-32001)
- Operations never complete

**Solutions**:

1. **This should be fixed** by the timeout improvements! But if persists:
```json
{
  "env": {
    "LLM_REQUEST_TIMEOUT": "120000",
    "LLM_MAX_RETRIES": "3"
  }
}
```

2. **Check OpenAI API status**:
https://status.openai.com/

3. **Enable debug logging**:
```json
{
  "env": {
    "LOG_LEVEL": "debug"
  }
}
```

### Issue: "Fallback mode accidentally enabled"

**Symptoms**:
- Basic operations work
- But intelligent features fail
- LLM not being called

**Solution**:
```json
{
  "env": {
    "UI_PROBE_FALLBACK_MODE": "false",
    "OPENAI_API_KEY": "sk-your-actual-key"
  }
}
```

## Separate Test Server Usage

When you need to test the bundled playground:

```bash
# Terminal 1: Start test server
npx mcp-ui-probe test-server --port 8081

# Terminal 2: Use Claude Desktop with MCP server
# (Already configured via claude_desktop_config.json)
```

The test server runs independently on HTTP, while the MCP server uses STDIO for Claude Desktop.

## Performance Tips

### 1. Keep MCP Server Running

The MCP server starts with Claude Desktop and stays running. Don't restart it frequently.

### 2. Use Cost Monitoring

Enable cost limits to avoid surprises:
```json
{
  "env": {
    "UI_PROBE_COST_LIMITS": "true",
    "UI_PROBE_MAX_COST": "50"
  }
}
```

### 3. Enable LLM Caching

Reduce API calls:
```json
{
  "env": {
    "LLM_CACHE_ENABLED": "true",
    "LLM_CACHE_TTL": "300000"
  }
}
```

## Monitoring and Logs

### View MCP Server Logs

**While server is running**:
```bash
# macOS/Linux
tail -f ~/Library/Logs/Claude/mcp-ui-probe.log

# Or enable console output
LOG_LEVEL=debug npx mcp-ui-probe start 2>&1 | tee ui-probe.log
```

### Check Usage Statistics

Use the `usage_stats` tool from Claude:
```
User: "Show me UI-Probe usage statistics"

Claude will call mcp__ui-probe__usage_stats and show:
- Total LLM calls
- Total tokens used
- Total cost
- Cost breakdown by operation
```

## Security Considerations

### 1. API Key Protection

**Never commit API keys to git**:
```bash
# Add to .gitignore
echo "claude_desktop_config.json" >> .gitignore
```

**Use environment variables** instead:
```json
{
  "env": {
    "OPENAI_API_KEY": "${OPENAI_API_KEY}"
  }
}
```

### 2. Cost Limits

Always set cost limits:
```json
{
  "env": {
    "UI_PROBE_MAX_COST": "100"
  }
}
```

### 3. Network Security

UI-Probe runs browser automation - be cautious with:
- Testing on production sites
- Sites with real payment information
- Sites with sensitive data

Use test environments when possible.

## Getting Help

If you encounter issues:

1. **Check the logs** (see Monitoring section above)
2. **Enable debug mode** (`LOG_LEVEL=debug`)
3. **Test manually** (`npx mcp-ui-probe start`)
4. **Verify configuration** (JSON syntax, API keys)
5. **Review timeout fixes** (see `TIMEOUT_FIXES.md`)

## Summary: Correct Setup

✅ **DO THIS**:
- Configure Claude Desktop with `npx mcp-ui-probe start`
- Set `UI_PROBE_FALLBACK_MODE=false`
- Provide valid `OPENAI_API_KEY`
- Use timeout fixes (automatic in latest version)
- Run test server separately if needed

❌ **DON'T DO THIS**:
- Don't enable fallback mode (disables LLM features)
- Don't run MCP server in browser
- Don't mix up test server with MCP server
- Don't skip Playwright installation
- Don't forget to restart Claude Desktop after config changes
