# MCP UI Probe Examples

**IMPORTANT**: This package is NOT on npm. You must clone it from GitHub first:

```bash
# Clone the repository
git clone https://github.com/Hulupeep/mcp-ui-probe.git
cd mcp-ui-probe
npm install
npm run build
```

## Running Examples

1. **Start the MCP server first:**
   ```bash
   # In the mcp-ui-probe directory
   npm start
   ```

2. **Run an example:**
   ```bash
   # In another terminal, from the mcp-ui-probe directory
   node examples/quick-test.js
   ```

## Key Points to Remember

- **ALWAYS provide the full URL** - the AI doesn't guess where to test
- URLs must include the protocol (http:// or https://)
- The MCP server must be running before running examples
- This is not an npm package - you must clone from GitHub

## Example Files

- `quick-test.js` - Basic example showing URL requirement
- `form-testing.js` - Testing specific forms
- `multi-step.js` - Multi-step workflow testing

Each example clearly shows that you MUST provide the URL for the AI to know where to test.