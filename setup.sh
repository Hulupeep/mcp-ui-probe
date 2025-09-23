#!/bin/bash

# MCP UI Probe - Complete Setup Script
echo "================================"
echo "MCP UI Probe Setup"
echo "================================"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18+ required (you have $(node -v))"
    exit 1
fi
echo "✅ Node.js $(node -v) detected"

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Install Playwright browsers
echo "🌐 Installing Playwright browsers (470MB)..."
npx playwright install

# Check if running with sudo
if [ "$EUID" -eq 0 ]; then
   echo "🔧 Installing system dependencies..."
   apt-get update
   apt-get install -y libgstreamer-plugins-bad1.0-0 libavif16
else
   echo "⚠️  System dependencies need sudo. Run one of these:"
   echo "    sudo npx playwright install-deps"
   echo "    sudo apt-get install libgstreamer-plugins-bad1.0-0 libavif16"
   echo ""
   read -p "Do you want to install system dependencies now? (requires sudo) [y/N]: " -n 1 -r
   echo
   if [[ $REPLY =~ ^[Yy]$ ]]; then
       sudo npx playwright install-deps
   else
       echo "⏭️  Skipping system dependencies. Install them later with:"
       echo "    sudo npx playwright install-deps"
   fi
fi

echo ""
echo "================================"
echo "✅ Setup complete!"
echo "================================"
echo ""
echo "To add to Claude Code, run:"
echo "  claude mcp add --scope project ui-probe node $(pwd)/dist/index.js"
echo ""
echo "Then test with:"
echo "  claude \"Test if search works on https://google.com\""