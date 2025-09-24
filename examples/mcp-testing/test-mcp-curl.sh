#!/bin/bash

echo "🧪 Testing MCP Protocol with UI-Probe"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Start MCP server in background
echo -e "${BLUE}Starting MCP server...${NC}"
npx mcp-ui-probe@latest start > server.log 2>&1 &
SERVER_PID=$!
sleep 3

# Function to send JSON-RPC message
send_request() {
    local method=$1
    local params=$2
    local id=$3

    echo -e "\n${GREEN}→ Testing: $method${NC}"

    # Create the JSON-RPC request
    local request="{\"jsonrpc\":\"2.0\",\"method\":\"$method\",\"params\":$params,\"id\":$id}"

    echo "Request: $request"
    echo "$request" | nc localhost 3000
    echo ""
}

# Test 1: Initialize
echo -e "\n${BLUE}1. Initialize Connection${NC}"
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"0.1.0","capabilities":{}},"id":1}' | nc localhost 3000

sleep 1

# Test 2: List Tools
echo -e "\n${BLUE}2. List Available Tools${NC}"
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}' | nc localhost 3000

sleep 1

# Test 3: Navigate
echo -e "\n${BLUE}3. Navigate to Test Page${NC}"
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"navigate","arguments":{"url":"http://localhost:8081/test"}},"id":3}' | nc localhost 3000

sleep 2

# Test 4: Analyze UI
echo -e "\n${BLUE}4. Analyze Page UI${NC}"
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"analyze_ui","arguments":{}},"id":4}' | nc localhost 3000

sleep 1

# Cleanup
echo -e "\n${GREEN}✅ Tests complete!${NC}"
echo "Stopping server..."
kill $SERVER_PID 2>/dev/null

echo -e "\nServer logs saved to: server.log"