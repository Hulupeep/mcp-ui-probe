#!/bin/bash

echo "🧪 Simple MCP UI-Probe Test"
echo "=========================="
echo ""

# First, test if the MCP server starts
echo "1. Testing MCP server startup..."
timeout 5 npx mcp-ui-probe@latest start 2>&1 | head -20

echo ""
echo "2. Testing with stdio communication..."
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"0.1.0","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}},"id":1}' | npx mcp-ui-probe@latest start 2>&1 | head -5

echo ""
echo "3. Testing test server pages..."
curl -s http://localhost:8081/test | grep -q "Test" && echo "✅ /test page works" || echo "❌ /test page failed"
curl -s http://localhost:8081/test/forms | grep -q "form" && echo "✅ /test/forms page works" || echo "❌ /test/forms page failed"

echo ""
echo "4. Testing direct tool access (if server is running)..."
# This assumes the MCP server exposes an HTTP endpoint (it might not)
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' 2>/dev/null || echo "Note: Direct HTTP access might not be supported"

echo ""
echo "✅ Test complete!"
echo ""
echo "To test interactively, run:"
echo "  npx mcp-ui-probe@latest start"
echo "Then send JSON-RPC messages via stdin"