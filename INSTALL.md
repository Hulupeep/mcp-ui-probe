# Complete Installation Guide for MCP UI Probe

## Prerequisites

1. **Node.js 18+** - Check with `node --version`
2. **Git** - To clone the repository
3. **Sudo access** - For system dependencies

## Step-by-Step Installation

### 1. Clone the Repository

```bash
cd ~  # or wherever you keep your tools
git clone https://github.com/Hulupeep/mcp-ui-probe.git
cd mcp-ui-probe
```

### 2. Install Node Dependencies

```bash
npm install
```

### 3. Build the Project

```bash
npm run build
```

### 4. Install Playwright Browsers (CRITICAL!)

This step downloads the actual browser binaries that Playwright uses:

```bash
npx playwright install
```

This will download:
- Chromium (~174MB)
- Firefox (~96MB)
- WebKit (~94MB)

### 5. Install System Dependencies

Browsers need certain system libraries to run. Install them with:

```bash
# Option A: Use Playwright's installer (recommended)
sudo npx playwright install-deps

# Option B: Install manually (if Option A fails)
sudo apt-get install libgstreamer-plugins-bad1.0-0 libavif16
```

### 6. Verify Installation

Test that browsers can launch:

```bash
npx playwright test --list
```

### 7. Add to Claude Code

From your project directory:

```bash
cd /path/to/your/project
claude mcp add --scope project ui-probe node /absolute/path/to/mcp-ui-probe/dist/index.js
```

### 8. Test It Works

```bash
# Restart Claude Code
claude

# Test a website (always provide URL!)
claude "Test if search works on https://google.com"
```

## Troubleshooting

### "Navigation failed" Error
**Cause**: Playwright browsers not installed
**Fix**: Run `npx playwright install`

### "Missing dependencies" Error
**Cause**: System libraries not installed
**Fix**: Run `sudo npx playwright install-deps`

### MCP Server "Failed to connect"
**Cause**: Wrong path or multiple configurations
**Fix**:
```bash
claude mcp remove ui-probe -s local
claude mcp remove ui-probe -s project
claude mcp add --scope project ui-probe node /full/path/to/mcp-ui-probe/dist/index.js
```

## Quick Setup Script

Create a file `setup.sh`:

```bash
#!/bin/bash
echo "Setting up MCP UI Probe..."

# Install dependencies
npm install

# Build project
npm run build

# Install Playwright browsers
npx playwright install

# Install system dependencies
echo "Installing system dependencies (requires sudo)..."
sudo npx playwright install-deps

echo "✅ Setup complete!"
echo "Now add to Claude Code with:"
echo "claude mcp add --scope project ui-probe node $(pwd)/dist/index.js"
```

Make it executable and run:
```bash
chmod +x setup.sh
./setup.sh
```