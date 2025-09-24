#!/bin/bash

echo "🚀 UI-Probe Claude Code CLI Setup"
echo "=================================="
echo ""

# Find npx
NPX_PATH=$(which npx)

if [ -z "$NPX_PATH" ]; then
    echo "❌ Error: npx not found. Please install Node.js first."
    echo "   Visit: https://nodejs.org"
    exit 1
fi

echo "✅ Found npx at: $NPX_PATH"
echo ""

# Check if ui-probe is already configured
if claude mcp list 2>/dev/null | grep -q "ui-probe"; then
    echo "⚠️  ui-probe is already configured. Removing old configuration..."
    claude mcp remove ui-probe
    echo ""
fi

# Add to Claude
echo "📝 Adding ui-probe to Claude Code CLI..."
echo "Running: claude mcp add ui-probe \"$NPX_PATH\" \"mcp-ui-probe@latest\" \"start\""
claude mcp add ui-probe "$NPX_PATH" "mcp-ui-probe@latest" "start"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Success! UI-Probe has been added to Claude Code CLI."
    echo ""
    echo "Next steps:"
    echo "1. Start Claude Code CLI: claude"
    echo "2. Check MCP status: claude mcp list"
    echo "3. Test with: npx mcp-ui-probe test-server"
    echo ""
    echo "If you see 'Failed to connect' in Claude:"
    echo "  - Start a new Claude session"
    echo "  - Check that Node.js is properly installed"
else
    echo ""
    echo "❌ Failed to add ui-probe to Claude."
    echo ""
    echo "Try manually with:"
    echo "  claude mcp add ui-probe \"$NPX_PATH\" \"mcp-ui-probe@latest\" \"start\""
fi