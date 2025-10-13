# Quick Start for OpenAI Codex Team

## TL;DR - Run This Now

```bash
# 1. Build
cd MCP-UI-Probe/mcp-ui-probe
npm run build

# 2. Run deterministic test (NO LLM, NO API KEY)
node dist/cli.js run --scenario scenarios/verifiable-clinical.yaml

# That's it! Exit code 0 = pass, 1 = fail
```

## What Changed

**Before (what you tried):**
- `node dist/index.js` - MCP server with LLM
- `node -r dotenv/config test-runner.cjs` - MCP transport
- Result: Timeouts, brittleness, LLM required

**Now (deterministic CLI):**
- `node dist/cli.js run --scenario <file>` - Direct CLI
- No MCP server, no LLM, no timeouts
- Result: Fast, deterministic, CI-ready

## Your Verifiable Workflows

Two scenarios ready for your use:

### 1. Clinical Persona
```bash
node dist/cli.js run \
  --scenario scenarios/verifiable-clinical.yaml \
  --base-url http://localhost:3100
```

### 2. Storm Persona
```bash
node dist/cli.js run \
  --scenario scenarios/verifiable-storm.yaml \
  --base-url http://localhost:3100
```

## CI/CD Integration

```yaml
# .github/workflows/test.yml
- name: Test verifiable workflows
  run: |
    node dist/cli.js run --scenario scenarios/verifiable-clinical.yaml
    node dist/cli.js run --scenario scenarios/verifiable-storm.yaml
```

## Key Differences from MCP Approach

| Feature | MCP Server | Deterministic CLI |
|---------|-----------|------------------|
| Command | `node dist/index.js` | `node dist/cli.js run` |
| API Key | Required | Not required |
| Speed | Slow (60s timeouts) | Fast (direct actions) |
| Output | Logs | JSON + exit codes |
| CI Ready | No | Yes |

## More Info

- Complete guide: `docs/CODEX_CLI_USAGE.md`
- Full documentation: `docs/CLI_DETERMINISTIC_MODE.md`
- Example scenarios: `scenarios/*.yaml`

## Support

The deterministic CLI addresses all the issues you reported:
- ✅ No more MCP timeouts (-32001 errors)
- ✅ No LLM brittleness
- ✅ Deterministic selector matching
- ✅ Works with your testId-based components
- ✅ CI/CD ready with exit codes
- ✅ JSON output for parsing

No OpenAI API key needed.
