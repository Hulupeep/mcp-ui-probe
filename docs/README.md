# MCP-UI-Probe Documentation

## For OpenAI Codex Team - Start Here

If you're from the OpenAI Codex team looking for the deterministic CLI solution:

1. **[QUICK_START_CODEX.md](./QUICK_START_CODEX.md)** - Start here (2 min read)
   - Copy-paste commands to test immediately
   - What changed from MCP server approach
   - Your verifiable workflows ready to run

2. **[CODEX_FEEDBACK.md](./CODEX_FEEDBACK.md)** - Complete explanation
   - All your reported issues addressed
   - MCP vs CLI comparison
   - CI/CD integration examples
   - Troubleshooting guide

3. **[CODEX_CLI_USAGE.md](./CODEX_CLI_USAGE.md)** - Comprehensive guide
   - All CLI options documented
   - Creating custom scenarios
   - Advanced features

4. **[CLI_DETERMINISTIC_MODE.md](./CLI_DETERMINISTIC_MODE.md)** - Full technical reference
   - All 8 action types
   - Complete API reference
   - Example scenarios

## Quick Test

```bash
cd MCP-UI-Probe/mcp-ui-probe
npm run build
node dist/cli.js run --scenario scenarios/verifiable-clinical.yaml
```

Exit code 0 = success, 1 = failure. No OpenAI API key needed.

---

## All Documentation Files

### Codex-Specific Documentation
- **QUICK_START_CODEX.md** - 2-minute quick start for Codex team
- **CODEX_FEEDBACK.md** - Addresses all reported MCP timeout issues
- **CODEX_CLI_USAGE.md** - Complete usage guide
- **CLI_DETERMINISTIC_MODE.md** - Full technical reference

### General Documentation
- **QUICK_START.md** - General quick start guide
- **MCP_CLIENT_SETUP.md** - MCP server setup (legacy)
- **TROUBLESHOOTING.md** - General troubleshooting
- **comparison.md** - Commercial tool comparison

### Project Documentation (Root)
- **README.md** - Main project README
- **INSTALL.md** - Installation guide
- **CLAUDE.md** - Claude Code configuration
- **design.md** - System design
- **prd.md** - Product requirements

### Implementation Documentation (Root)
- **IMPLEMENTATION_SUMMARY.md** - Implementation summary
- **best.md** - Best practices
- **CODE_REVIEW_REPORT.md** - Code review findings
- **COST_MONITORING_IMPLEMENTATION.md** - Cost monitoring
- **LLM_REQUIREMENTS.md** - LLM integration

## Scenario Files

See `../scenarios/` directory:
- **verifiable-clinical.yaml** - Clinical persona workflow
- **verifiable-storm.yaml** - Storm persona workflow
- **simple-login.yaml** - Generic login example

## Key Differences: MCP vs CLI

| Feature | MCP Server | Deterministic CLI |
|---------|-----------|------------------|
| Command | `node dist/index.js` | `node dist/cli.js run` |
| API Key | Required | Not required |
| Speed | Slow (timeouts) | Fast |
| Output | Logs | JSON + exit codes |
| CI Ready | No | Yes |

## Support

For Codex team: Start with **QUICK_START_CODEX.md**

For general use: Start with **QUICK_START.md**
